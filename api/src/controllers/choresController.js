const { pool } = require("../db/pool");
const { currentSchoolYearStart } = require("../utils/schoolYear");
const { rangesOverlap } = require("../utils/houseFees");
const {
  monthsBetween,
  periodsForMonth,
  periodForDateWithNext,
  sessionKeyForPeriod,
} = require("../utils/chores");
const {
  DEFAULT_DUTIES,
  DEFAULT_GRID_ROWS,
  DEFAULT_CONFIG,
  DEFAULT_CAPTAINS,
  DEFAULT_GRID,
} = require("../utils/choreDefaults");
const {
  scheduleQuerySchema,
  currentQuerySchema,
  configUpsertSchema,
  seedSchema,
} = require("../validation/chores");

// "1A(L)" / "1A(U)" on the printed sheet: lower and upper bed of a double.
function bedLabel(roomCode, bed, bedsInRoom) {
  if (bedsInRoom <= 1) return roomCode;
  return `${roomCode}(${bed === 1 ? "L" : "U"})`;
}

async function loadSettings() {
  const { rows } = await pool.query(
    `SELECT split_day, manager_notes FROM chore_config WHERE id = 1`
  );
  return rows[0] ?? { ...DEFAULT_CONFIG };
}

async function loadDuties() {
  const { rows } = await pool.query(
    `SELECT duty_no, name, description FROM chore_duties ORDER BY duty_no ASC`
  );
  return rows.map((r) => ({ ...r, duty_no: Number(r.duty_no) }));
}

// The rows of the schedule: every bed in the house, in the order House Config
// lists the rooms. Bedrooms and their capacity are configured there, not here —
// this only reads them.
//
// Capacity is per year/session; the greater of a room's capacities for the year
// wins, so a room let as a double in winter keeps both rows all year. A year
// with no rates configured falls back to the room's largest capacity ever
// configured, then to a single, rather than silently dropping beds from the
// schedule.
async function loadBeds(year) {
  const [roomsRes, ratesRes] = await Promise.all([
    pool.query(
      `SELECT id, room_code, floor, sort_order
       FROM house_rooms WHERE is_active = TRUE
       ORDER BY sort_order ASC, room_code ASC`
    ),
    pool.query(
      `SELECT room_id,
              MAX(capacity) FILTER (WHERE school_year = $1) AS year_capacity,
              MAX(capacity) AS ever_capacity
       FROM house_room_rates GROUP BY room_id`,
      [year]
    ),
  ]);

  const capacityByRoom = new Map(
    ratesRes.rows.map((r) => [
      Number(r.room_id),
      Number(r.year_capacity ?? r.ever_capacity ?? 1) || 1,
    ])
  );

  const beds = [];
  for (const room of roomsRes.rows) {
    const capacity = capacityByRoom.get(Number(room.id)) ?? 1;
    for (let bed = 1; bed <= capacity; bed++) {
      beds.push({
        room_id: Number(room.id),
        room_code: room.room_code,
        floor: room.floor,
        sort_order: room.sort_order,
        bed,
        capacity,
        bed_label: bedLabel(room.room_code, bed, capacity),
      });
    }
  }
  return beds;
}

// The stored schedule, keyed `${room}|${bed}|${period}`. There is one schedule,
// reused every year.
async function loadGrid() {
  const { rows } = await pool.query(
    `SELECT room_id, bed, period_index, duty_no FROM chore_grid`
  );
  return new Map(
    rows.map((r) => [
      `${Number(r.room_id)}|${Number(r.bed)}|${Number(r.period_index)}`,
      Number(r.duty_no),
    ])
  );
}

async function loadCaptains() {
  const { rows } = await pool.query(
    `SELECT c.captain_key, c.name, c.description, c.brother_id, c.sort_order,
            b.first_name, b.last_name
     FROM chore_captains c
     LEFT JOIN brothers b ON b.id = c.brother_id
     ORDER BY c.sort_order ASC NULLS LAST, c.name ASC`
  );
  return rows;
}

// Assignments for every (school year, session) the requested months touch, so a
// range crossing Apr 30 resolves occupants on both sides of it.
async function loadOccupancy(keys) {
  const unique = [...new Set(keys.map((k) => `${k.school_year}|${k.session_type}`))];
  if (!unique.length) return [];

  const years = unique.map((k) => Number(k.split("|")[0]));
  const sessions = [...new Set(unique.map((k) => k.split("|")[1]))];

  const { rows } = await pool.query(
    `SELECT a.school_year, a.session_type, a.room_id, a.bed, a.occupancy, a.brother_id,
            a.start_date::text AS start_date, a.end_date::text AS end_date,
            b.first_name, b.last_name
     FROM house_assignments a
     JOIN brothers b ON b.id = a.brother_id
     WHERE a.school_year = ANY($1::int[]) AND a.session_type = ANY($2::text[])`,
    [years, sessions]
  );
  return rows.map((r) => ({ ...r, room_id: Number(r.room_id), bed: Number(r.bed) }));
}

function occupantResolver(assignments) {
  return (bedRow, period) =>
    assignments.find(
      (a) =>
        a.room_id === bedRow.room_id &&
        // A buy-out occupies every bed in the room, so its holder covers both
        // rows of the schedule.
        (a.occupancy === "full_room" || a.bed === bedRow.bed) &&
        Number(a.school_year) === period.school_year &&
        a.session_type === period.session_type &&
        rangesOverlap(a.start_date, a.end_date, period.start_date, period.end_date)
    ) ?? null;
}

// Every period between two dates, with the stored duty and the current occupant
// of each bed filled in.
async function buildSchedule(fromDate, toDate) {
  const [settings, duties] = await Promise.all([loadSettings(), loadDuties()]);
  const months = monthsBetween(fromDate, toDate);

  const periods = months.flatMap((m) =>
    periodsForMonth(m.year, m.month, settings.split_day).map((p) => ({
      ...p,
      ...sessionKeyForPeriod(p),
    }))
  );

  // A range crossing September touches two school years, and each can have its
  // own bed layout.
  const years = [...new Set(periods.map((p) => p.school_year))];
  const [grid, assignments, ...bedLists] = await Promise.all([
    loadGrid(),
    loadOccupancy(periods),
    ...years.map((y) => loadBeds(y)),
  ]);
  const bedsByYear = new Map(years.map((y, i) => [y, bedLists[i]]));

  const occupantFor = occupantResolver(assignments);
  const dutyByNo = new Map(duties.map((d) => [d.duty_no, d]));

  const filled = periods.map((period) => {
    const entries = [];
    for (const bedRow of bedsByYear.get(period.school_year) ?? []) {
      const dutyNo = grid.get(`${bedRow.room_id}|${bedRow.bed}|${period.period_index}`);
      if (dutyNo == null) continue;
      const duty = dutyByNo.get(dutyNo) ?? null;
      const occupant = occupantFor(bedRow, period);
      entries.push({
        room_id: bedRow.room_id,
        room_code: bedRow.room_code,
        // The bedroom's position in House Config, so the page can lay the beds
        // out in house order rather than duty order.
        sort_order: bedRow.sort_order,
        bed: bedRow.bed,
        bed_label: bedRow.bed_label,
        duty_no: dutyNo,
        duty_name: duty?.name ?? null,
        duty_description: duty?.description ?? null,
        brother_id: occupant?.brother_id ?? null,
        first_name: occupant?.first_name ?? null,
        last_name: occupant?.last_name ?? null,
        is_vacant: !occupant,
      });
    }
    entries.sort(
      (a, b) => a.duty_no - b.duty_no || a.room_code.localeCompare(b.room_code) || a.bed - b.bed
    );
    return { ...period, entries };
  });

  return { settings, duties, periods: filled };
}

// The schedule for a date range. Defaults to the current school year.
async function getSchedule(req, res) {
  const q = scheduleQuerySchema.parse(req.query);
  const year = q.year ?? currentSchoolYearStart();
  const from = q.from ?? `${year}-09-01`;
  const to = q.to ?? `${year + 1}-08-31`;

  const { settings, duties, periods } = await buildSchedule(from, to);
  return res.status(200).json({ year, from, to, settings, duties, periods });
}

// What the chores page opens on: who is on duty now, who is up next.
async function getCurrent(req, res) {
  const q = currentQuerySchema.parse(req.query);
  const today = q.date ?? new Date().toISOString().slice(0, 10);
  const settings = await loadSettings();
  const { current, next } = periodForDateWithNext(today, settings.split_day);

  const { duties, periods } = await buildSchedule(current.start_date, next.start_date);
  const find = (p) => periods.find((x) => x.start_date === p.start_date) ?? { ...p, entries: [] };

  const captains = await loadCaptains();

  return res.status(200).json({
    today,
    settings,
    duties,
    current: find(current),
    next: find(next),
    captains,
  });
}

// Everything the config page edits, in one call. `beds` is read-only — bedrooms
// and their capacity come from House Config. `grid` is a sparse list of cells;
// a bed with no cell for a period is off duty that period.
async function getChoreConfig(req, res) {
  const [settings, duties, beds, gridRes, captains] = await Promise.all([
    loadSettings(),
    loadDuties(),
    // Capacity is configured per year, so the bed list is read from the current
    // one. The schedule itself has no year.
    loadBeds(currentSchoolYearStart()),
    pool.query(
      `SELECT room_id, bed, period_index, duty_no FROM chore_grid
       ORDER BY room_id ASC, bed ASC, period_index ASC`
    ),
    loadCaptains(),
  ]);

  return res.status(200).json({
    settings,
    duties,
    beds,
    grid: gridRes.rows.map((r) => ({
      room_id: Number(r.room_id),
      bed: Number(r.bed),
      period_index: Number(r.period_index),
      duty_no: Number(r.duty_no),
    })),
    captains,
    is_configured: duties.length > 0 && beds.length > 0 && gridRes.rows.length > 0,
  });
}

// Whole-config save: the page edits drafts of every table and posts them back.
async function saveChoreConfig(req, res) {
  const payload = configUpsertSchema.parse(req.body);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO chore_config (id, split_day, manager_notes)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET
         split_day = EXCLUDED.split_day,
         manager_notes = EXCLUDED.manager_notes`,
      [payload.settings.split_day, payload.settings.manager_notes ?? null]
    );

    const dutyNos = payload.duties.map((d) => d.duty_no);
    await client.query(`DELETE FROM chore_duties WHERE NOT (duty_no = ANY($1::int[]))`, [dutyNos]);
    for (const duty of payload.duties) {
      await client.query(
        `INSERT INTO chore_duties (duty_no, name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (duty_no) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description`,
        [duty.duty_no, duty.name, duty.description ?? null]
      );
    }

    // The grid is sent whole, so a cleared cell is an absent one.
    await client.query(`DELETE FROM chore_grid`);
    for (const cell of payload.grid) {
      await client.query(
        `INSERT INTO chore_grid (room_id, bed, period_index, duty_no)
         VALUES ($1, $2, $3, $4)`,
        [cell.room_id, cell.bed, cell.period_index, cell.duty_no]
      );
    }

    const captainKeys = payload.captains.map((c) => c.captain_key);
    await client.query(`DELETE FROM chore_captains WHERE NOT (captain_key = ANY($1::text[]))`, [
      captainKeys,
    ]);
    for (const captain of payload.captains) {
      await client.query(
        `INSERT INTO chore_captains (captain_key, name, description, brother_id, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (captain_key) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           brother_id = EXCLUDED.brother_id,
           sort_order = EXCLUDED.sort_order`,
        [
          captain.captain_key,
          captain.name,
          captain.description ?? null,
          captain.brother_id ?? null,
          captain.sort_order ?? null,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return getChoreConfig(req, res);
}

// Lays down the printed schedule: duties, the grid itself, and the captaincies.
// `reset` replaces what is there; otherwise only gaps are filled.
async function seedChoreConfig(req, res) {
  const { reset } = seedSchema.parse(req.body ?? {});
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (reset) {
      await client.query(`DELETE FROM chore_grid`);
      await client.query(`DELETE FROM chore_duties`);
      await client.query(`DELETE FROM chore_captains`);
    }

    for (const duty of DEFAULT_DUTIES) {
      await client.query(
        `INSERT INTO chore_duties (duty_no, name, description)
         VALUES ($1, $2, $3) ON CONFLICT (duty_no) DO NOTHING`,
        [duty.duty_no, duty.name, duty.description]
      );
    }

    // DEFAULT_GRID's rows line up with DEFAULT_GRID_ROWS, which name a bedroom
    // and a bed. A bed the house doesn't have (a room let as a single) simply
    // gets no cells.
    for (let row = 0; row < DEFAULT_GRID.length; row++) {
      const gridRow = DEFAULT_GRID_ROWS[row];
      if (!gridRow) continue;
      for (let period = 0; period < DEFAULT_GRID[row].length; period++) {
        const dutyNo = DEFAULT_GRID[row][period];
        if (dutyNo == null) continue;
        await client.query(
          `INSERT INTO chore_grid (room_id, bed, period_index, duty_no)
           SELECT r.id, $2, $3, $4 FROM house_rooms r WHERE r.room_code = $1
           ON CONFLICT (room_id, bed, period_index) DO NOTHING`,
          [gridRow.room_code, gridRow.bed, period, dutyNo]
        );
      }
    }

    await client.query(
      `INSERT INTO chore_config (id, split_day, manager_notes)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET
         manager_notes = COALESCE(chore_config.manager_notes, EXCLUDED.manager_notes)`,
      [DEFAULT_CONFIG.split_day, DEFAULT_CONFIG.manager_notes]
    );

    for (const captain of DEFAULT_CAPTAINS) {
      await client.query(
        `INSERT INTO chore_captains (captain_key, name, description, sort_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (captain_key) DO NOTHING`,
        [captain.captain_key, captain.name, captain.description, captain.sort_order]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return getChoreConfig(req, res);
}

module.exports = {
  getSchedule,
  getCurrent,
  getChoreConfig,
  saveChoreConfig,
  seedChoreConfig,
};
