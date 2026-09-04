const { pool } = require("./pool");
const crypto = require("crypto");
const { env } = require("../config/env");

async function setupTables() {
  function quoteIdent(value) {
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  async function columnExists(tableName, columnName) {
    const res = await pool.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
        LIMIT 1
      `,
      [String(tableName), String(columnName)]
    );
    return Boolean(res.rows?.[0]);
  }

  async function addColumnIfMissing(tableName, columnName, columnDefSql) {
    if (await columnExists(tableName, columnName)) return;
    await pool.query(`ALTER TABLE ${quoteIdent(tableName)} ADD COLUMN ${quoteIdent(columnName)} ${columnDefSql};`);
  }

  async function indexExists(indexName) {
    const res = await pool.query(
      `
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = $1
        LIMIT 1
      `,
      [String(indexName)]
    );
    return Boolean(res.rows?.[0]);
  }

  async function createIndexIfMissing(indexName, createIndexSql) {
    if (await indexExists(indexName)) return;
    await pool.query(createIndexSql);
  }

  async function constraintExists(tableName, constraintName) {
    const res = await pool.query(
      `
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = $1 AND c.conname = $2
        LIMIT 1
      `,
      [String(tableName), String(constraintName)]
    );
    return Boolean(res.rows?.[0]);
  }

  async function addConstraintIfMissing(tableName, constraintName, addConstraintSql) {
    if (await constraintExists(tableName, constraintName)) return;
    await pool.query(addConstraintSql);
  }

  // Note: CREATE TABLE IF NOT EXISTS will not modify an existing schema.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brothers (
      id SERIAL PRIMARY KEY,
      last_name TEXT,
      first_name TEXT,
      email TEXT,
      phone TEXT,
      pledge_class TEXT,
      graduation NUMERIC,
      office TEXT,
      status TEXT
    );
  `);

  // NOTE: Member types are represented via `brothers.status` (e.g. "Pledge") rather than a separate column.

  // Home address. Every part is optional — most of the roster has none, and the
  // alumni import that brought these in has gaps. Kept as loose columns rather
  // than one free-text blob so mail-merges can address an envelope.
  // See neon-brother-address.sql.
  await addColumnIfMissing("brothers", "address_line1", "TEXT");
  await addColumnIfMissing("brothers", "address_line2", "TEXT");
  await addColumnIfMissing("brothers", "city", "TEXT");
  // Province, state, county — whatever the country calls it.
  await addColumnIfMissing("brothers", "province", "TEXT");
  await addColumnIfMissing("brothers", "postal_code", "TEXT");
  await addColumnIfMissing("brothers", "country", "TEXT");
  // A second email address, common on the alumni records.
  // See neon-brother-address.sql.
  await addColumnIfMissing("brothers", "email_secondary", "TEXT");

  // When a brother went alumni, so history stays answerable after the fact.
  // `status` is current state: once it flips to Alumni it can no longer say who
  // was active in a past year, which retroactively shrank the budget's dues
  // count and hid brothers who had already paid. A brother counts as active in
  // any school year he was present for part of.
  // See neon-brother-alumni-year.sql.
  await addColumnIfMissing("brothers", "alumni_date", "DATE");

  // Seed from `graduation` for existing departed brothers: a graduation year of
  // 2026 means the last active school year was 2025-26, so date it to that
  // spring. It is an expected year rather than a recorded event, but it is the
  // only per-brother signal about past years and it beats reconstructing the
  // roster by hand.
  //
  // Capped at today because `graduation` is a forecast: someone who left early
  // is already departed while his expected graduation is still years away, and
  // an uncapped seed would count him as an active dues payer for every year up
  // to it. Whatever the real date was, it was not in the future.
  //
  // Blanks only, so a corrected value survives a later boot.
  await pool.query(`
    UPDATE brothers
    SET alumni_date = LEAST(make_date(graduation::int, 5, 1), CURRENT_DATE)
    WHERE alumni_date IS NULL
      AND status <> 'Active'
      AND graduation IS NOT NULL
      AND graduation BETWEEN 1900 AND 2200;
  `);

  // Repair rows the first cut of the seed above dated into the future.
  await pool.query(`
    UPDATE brothers
    SET alumni_date = CURRENT_DATE
    WHERE alumni_date > CURRENT_DATE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dues (
      id NUMERIC,
      first_instalment_date DATE,
      first_instalment_amount NUMERIC,
      second_instalment_date DATE,
      second_instalment_amount NUMERIC,
      third_instalment_date DATE,
      third_instalment_amount NUMERIC,
      fourth_instalment_date DATE,
      fourth_instalment_amount NUMERIC
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dues_payments (
      id SERIAL PRIMARY KEY,
      brother_id INTEGER NOT NULL,
      paid_at DATE NOT NULL,
      amount NUMERIC NOT NULL,
      memo TEXT,
      CONSTRAINT dues_payments_brother_fk FOREIGN KEY (brother_id) REFERENCES brothers(id) ON DELETE CASCADE
    );
  `);

  // Dues configuration (yearly plan + instalment schedule)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dues_plans (
      year INTEGER PRIMARY KEY,
      total_amount NUMERIC NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dues_plan_instalments (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      label TEXT,
      due_date DATE NOT NULL,
      amount NUMERIC NOT NULL,
      CONSTRAINT dues_plan_instalments_year_fk FOREIGN KEY (year) REFERENCES dues_plans(year) ON DELETE CASCADE
    );
  `);

  // New (category-based) dues configuration.
  // `year` is the school-year start (e.g. 2024 => 2024-2025)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dues_plan_categories (
      year INTEGER NOT NULL,
      category TEXT NOT NULL,
      total_amount NUMERIC NOT NULL,
      PRIMARY KEY (year, category)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dues_plan_category_instalments (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      category TEXT NOT NULL,
      label TEXT,
      due_date DATE NOT NULL,
      amount NUMERIC NOT NULL,
      CONSTRAINT dues_plan_category_instalments_plan_fk
        FOREIGN KEY (year, category) REFERENCES dues_plan_categories(year, category) ON DELETE CASCADE
    );
  `);

  // Payments should be attributable to a dues year for statements.
  await addColumnIfMissing("dues_payments", "dues_year", "INTEGER");

  await createIndexIfMissing(
    "dues_payments_brother_year_idx",
    `CREATE INDEX dues_payments_brother_year_idx ON dues_payments (brother_id, dues_year);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS revenue_categories (
      id SERIAL PRIMARY KEY,
      name TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS revenue (
      id SERIAL PRIMARY KEY,
      date DATE,
      description TEXT,
      category_id NUMERIC,
      amount NUMERIC
    );
  `);

  // Attribute revenue entries to a school year (same concept as dues_year).
  await addColumnIfMissing("revenue", "school_year", "INTEGER");

  // Track revenue by payment stream for bookkeeping.
  await addColumnIfMissing("revenue", "cash_amount", "NUMERIC");
  await addColumnIfMissing("revenue", "square_amount", "NUMERIC");
  await addColumnIfMissing("revenue", "etransfer_amount", "NUMERIC");
  // Cheques are a distinct stream from e-transfers for reconciliation: they
  // clear on their own schedule. See neon-revenue-cheque.sql.
  await addColumnIfMissing("revenue", "cheque_amount", "NUMERIC");

  await createIndexIfMissing(
    "revenue_school_year_idx",
    `CREATE INDEX revenue_school_year_idx ON revenue (school_year, date DESC);`
  );

  // Backfill for existing rows created before school_year existed.
  await pool.query(`
    UPDATE revenue
    SET school_year = CASE
      WHEN date IS NULL THEN NULL
      WHEN EXTRACT(MONTH FROM date) >= 9 THEN EXTRACT(YEAR FROM date)::int
      ELSE (EXTRACT(YEAR FROM date)::int - 1)
    END
    WHERE school_year IS NULL;
  `);

  // Backfill payment stream amounts for old rows that only used `amount`.
  // Default: treat legacy amount as cash (and set others to 0) unless already set.
  await pool.query(`
    UPDATE revenue
    SET
      cash_amount = COALESCE(cash_amount, amount, 0),
      square_amount = COALESCE(square_amount, 0),
      etransfer_amount = COALESCE(etransfer_amount, 0),
      cheque_amount = COALESCE(cheque_amount, 0)
    WHERE cash_amount IS NULL OR square_amount IS NULL OR etransfer_amount IS NULL
       OR cheque_amount IS NULL;
  `);

  // Expenses + categories
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expense_categories (
      id SERIAL PRIMARY KEY,
      name TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      date DATE,
      description TEXT,
      category_id NUMERIC,
      amount NUMERIC,
      reimburse_brother_id INTEGER,
      cheque_number TEXT,
      school_year INTEGER,
      CONSTRAINT expenses_brother_fk FOREIGN KEY (reimburse_brother_id) REFERENCES brothers(id) ON DELETE SET NULL
    );
  `);

  // Workflow fields for submissions/approvals/disbursements.
  await addColumnIfMissing("expenses", "status", "TEXT");
  await addColumnIfMissing("expenses", "submitted_by_name", "TEXT");
  await addColumnIfMissing("expenses", "receipt_url", "TEXT");
  await addColumnIfMissing("expenses", "submitted_at", "TIMESTAMPTZ");
  await addColumnIfMissing("expenses", "approved_at", "TIMESTAMPTZ");
  await addColumnIfMissing("expenses", "paid_at", "TIMESTAMPTZ");

  // Default/backfill existing entries (entered by treasurer) as approved.
  await pool.query(`
    UPDATE expenses
    SET status = COALESCE(status, 'approved')
    WHERE status IS NULL;
  `);

  await createIndexIfMissing(
    "expenses_school_year_idx",
    `CREATE INDEX expenses_school_year_idx ON expenses (school_year, date DESC);`
  );

  await createIndexIfMissing(
    "expenses_status_cheque_idx",
    `CREATE INDEX expenses_status_cheque_idx ON expenses (status, cheque_number);`
  );

  // Backfill school_year for existing expense rows.
  await pool.query(`
    UPDATE expenses
    SET school_year = CASE
      WHEN date IS NULL THEN NULL
      WHEN EXTRACT(MONTH FROM date) >= 9 THEN EXTRACT(YEAR FROM date)::int
      ELSE (EXTRACT(YEAR FROM date)::int - 1)
    END
    WHERE school_year IS NULL;
  `);

  // Meeting minutes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_minutes (
      id SERIAL PRIMARY KEY,
      meeting_date DATE NOT NULL,
      title TEXT,
      school_year INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await createIndexIfMissing(
    "meeting_minutes_date_idx",
    `CREATE INDEX meeting_minutes_date_idx ON meeting_minutes (meeting_date DESC);`
  );

  await createIndexIfMissing(
    "meeting_minutes_school_year_idx",
    `CREATE INDEX meeting_minutes_school_year_idx ON meeting_minutes (school_year, meeting_date DESC);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_attendance (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER NOT NULL,
      brother_id INTEGER,
      member_name TEXT,
      status TEXT NOT NULL,
      late_arrival_time TEXT,
      excused_reason TEXT,
      CONSTRAINT meeting_attendance_meeting_fk FOREIGN KEY (meeting_id) REFERENCES meeting_minutes(id) ON DELETE CASCADE,
      CONSTRAINT meeting_attendance_brother_fk FOREIGN KEY (brother_id) REFERENCES brothers(id) ON DELETE SET NULL
    );
  `);

  await addColumnIfMissing("meeting_attendance", "late_arrival_time", "TEXT");
  await addColumnIfMissing("meeting_attendance", "excused_reason", "TEXT");

  await createIndexIfMissing(
    "meeting_attendance_meeting_idx",
    `CREATE INDEX meeting_attendance_meeting_idx ON meeting_attendance (meeting_id);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_officer_notes (
      id SERIAL PRIMARY KEY,
      meeting_id INTEGER NOT NULL,
      officer_key TEXT NOT NULL,
      notes TEXT,
      CONSTRAINT meeting_officer_notes_meeting_fk FOREIGN KEY (meeting_id) REFERENCES meeting_minutes(id) ON DELETE CASCADE
    );
  `);

  await createIndexIfMissing(
    "meeting_officer_notes_meeting_idx",
    `CREATE INDEX meeting_officer_notes_meeting_idx ON meeting_officer_notes (meeting_id);`
  );

  // Backfill school_year for existing minutes.
  await pool.query(`
    UPDATE meeting_minutes
    SET school_year = CASE
      WHEN meeting_date IS NULL THEN NULL
      WHEN EXTRACT(MONTH FROM meeting_date) >= 9 THEN EXTRACT(YEAR FROM meeting_date)::int
      ELSE (EXTRACT(YEAR FROM meeting_date)::int - 1)
    END
    WHERE school_year IS NULL;
  `);

  // Workdays (attendance drives initial earnings)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workdays (
      id SERIAL PRIMARY KEY,
      workday_date DATE NOT NULL,
      title TEXT,
      school_year INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Which Chapter Bonus month this workday counts for (YYYY-MM). Can differ from workday_date month.
  await addColumnIfMissing("workdays", "bonus_month", "TEXT");
  await pool.query(`
    UPDATE workdays
    SET bonus_month = COALESCE(bonus_month, TO_CHAR(workday_date, 'YYYY-MM'))
    WHERE bonus_month IS NULL AND workday_date IS NOT NULL;
  `);

  await createIndexIfMissing(
    "workdays_bonus_month_idx",
    `CREATE INDEX workdays_bonus_month_idx ON workdays (bonus_month, workday_date DESC);`
  );

  await createIndexIfMissing(
    "workdays_date_idx",
    `CREATE INDEX workdays_date_idx ON workdays (workday_date DESC);`
  );

  await createIndexIfMissing(
    "workdays_school_year_idx",
    `CREATE INDEX workdays_school_year_idx ON workdays (school_year, workday_date DESC);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workday_attendance (
      id SERIAL PRIMARY KEY,
      workday_id INTEGER NOT NULL,
      brother_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      CONSTRAINT workday_attendance_workday_fk FOREIGN KEY (workday_id) REFERENCES workdays(id) ON DELETE CASCADE,
      CONSTRAINT workday_attendance_brother_fk FOREIGN KEY (brother_id) REFERENCES brothers(id) ON DELETE SET NULL,
      CONSTRAINT workday_attendance_unique UNIQUE (workday_id, brother_id)
    );
  `);

  // Attendance details:
  // - Actives: coveralls + nametag tracked for Present/Late
  // - Everyone: makeup completion date tracked for Missing/Excused
  await addColumnIfMissing("workday_attendance", "coveralls", "BOOLEAN");
  await addColumnIfMissing("workday_attendance", "nametag", "BOOLEAN");
  await addColumnIfMissing("workday_attendance", "makeup_completed_at", "DATE");
  // What the makeup actually is — "kitchen deep clean", "help at rush BBQ".
  // Assigned from the makeups page, free text because the tasks are ad hoc.
  await addColumnIfMissing("workday_attendance", "makeup_assignment", "TEXT");

  // Snapshot-in-time fields so attendance isn't affected by later brother edits/deletes.
  await addColumnIfMissing("workday_attendance", "member_first_name", "TEXT");
  await addColumnIfMissing("workday_attendance", "member_last_name", "TEXT");
  await addColumnIfMissing("workday_attendance", "brother_status_at_workday", "TEXT");

  // Allow brother_id to become NULL when a brother is deleted.
  await pool.query(`
    ALTER TABLE workday_attendance
    ALTER COLUMN brother_id DROP NOT NULL;
  `);

  // Ensure FK is SET NULL even if table was created earlier with CASCADE.
  await pool.query(`
    ALTER TABLE workday_attendance
    DROP CONSTRAINT IF EXISTS workday_attendance_brother_fk;
  `);
  await pool.query(`
    ALTER TABLE workday_attendance
    ADD CONSTRAINT workday_attendance_brother_fk
    FOREIGN KEY (brother_id) REFERENCES brothers(id) ON DELETE SET NULL;
  `);

  // Drop old unique constraint and replace with a unique index that only applies when brother_id is present.
  await pool.query(`
    ALTER TABLE workday_attendance
    DROP CONSTRAINT IF EXISTS workday_attendance_unique;
  `);
  await createIndexIfMissing(
    "workday_attendance_workday_brother_uniq",
    `
      CREATE UNIQUE INDEX workday_attendance_workday_brother_uniq
      ON workday_attendance (workday_id, brother_id)
      WHERE brother_id IS NOT NULL;
    `
  );

  // Backfill snapshot fields from current brothers table (best-effort).
  await pool.query(`
    UPDATE workday_attendance a
    SET
      member_first_name = COALESCE(a.member_first_name, b.first_name),
      member_last_name = COALESCE(a.member_last_name, b.last_name),
      brother_status_at_workday = COALESCE(a.brother_status_at_workday, b.status)
    FROM brothers b
    WHERE a.brother_id = b.id;
  `);

  // Migrate old status names
  await pool.query(`
    UPDATE workday_attendance
    SET status = 'Missing'
    WHERE status = 'Absent';
  `);

  await createIndexIfMissing(
    "workday_attendance_workday_idx",
    `CREATE INDEX workday_attendance_workday_idx ON workday_attendance (workday_id);`
  );

  // NOTE: workday earning rates are tracked month-to-month under Chapter Bonus (`chapter_bonus_workday_rates`).

  // Minutes sections + motions (added later; keep schema evolvable)
  await addColumnIfMissing("meeting_minutes", "communications", "TEXT");
  await addColumnIfMissing("meeting_minutes", "old_business", "TEXT");
  await addColumnIfMissing("meeting_minutes", "new_business", "TEXT");
  await addColumnIfMissing("meeting_minutes", "betterment", "TEXT");

  // Motions
  await addColumnIfMissing("meeting_minutes", "motion_accept_moved_by_brother_id", "INTEGER");
  await addColumnIfMissing("meeting_minutes", "motion_accept_seconded_by_brother_id", "INTEGER");
  await addColumnIfMissing("meeting_minutes", "motion_end_moved_by_brother_id", "INTEGER");
  await addColumnIfMissing("meeting_minutes", "motion_end_seconded_by_brother_id", "INTEGER");

  // Chapter Bonus: deductions with photo evidence, tracked per month.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chapter_bonus_deductions (
      id SERIAL PRIMARY KEY,
      month TEXT NOT NULL, -- YYYY-MM
      amount NUMERIC NOT NULL,
      violation_type TEXT NOT NULL,
      comments TEXT,
      photo_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await createIndexIfMissing(
    "chapter_bonus_deductions_month_idx",
    `CREATE INDEX chapter_bonus_deductions_month_idx ON chapter_bonus_deductions (month, created_at DESC);`
  );

  // Chapter Bonus rules (configurable penalties + stacking tiers per month)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chapter_bonus_violation_rules (
      id SERIAL PRIMARY KEY,
      violation_type TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chapter_bonus_violation_rule_tiers (
      id SERIAL PRIMARY KEY,
      rule_id INTEGER NOT NULL,
      tier_number INTEGER NOT NULL,
      amount NUMERIC NOT NULL,
      CONSTRAINT chapter_bonus_rule_tiers_rule_fk FOREIGN KEY (rule_id) REFERENCES chapter_bonus_violation_rules(id) ON DELETE CASCADE,
      CONSTRAINT chapter_bonus_rule_tiers_unique UNIQUE (rule_id, tier_number)
    );
  `);

  await createIndexIfMissing(
    "chapter_bonus_rule_tiers_rule_idx",
    `CREATE INDEX chapter_bonus_rule_tiers_rule_idx ON chapter_bonus_violation_rule_tiers (rule_id, tier_number);`
  );

  // Chapter Bonus: month-based workday earning rates (rates can change month-to-month).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chapter_bonus_workday_rates (
      month TEXT PRIMARY KEY, -- YYYY-MM
      active_rate NUMERIC NOT NULL DEFAULT 0,
      pledge_rate NUMERIC NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Expanded workday earnings config (per category).
  await addColumnIfMissing("chapter_bonus_workday_rates", "active_present_rate", "NUMERIC");
  await addColumnIfMissing("chapter_bonus_workday_rates", "active_late_rate", "NUMERIC");
  await addColumnIfMissing("chapter_bonus_workday_rates", "active_coveralls_rate", "NUMERIC");
  await addColumnIfMissing("chapter_bonus_workday_rates", "active_coveralls_nametag_rate", "NUMERIC");
  await addColumnIfMissing("chapter_bonus_workday_rates", "pledge_present_rate", "NUMERIC");
  await addColumnIfMissing("chapter_bonus_workday_rates", "pledge_late_rate", "NUMERIC");

  // Backfill new columns from legacy simple rates (best-effort defaults).
  await pool.query(`
    UPDATE chapter_bonus_workday_rates
    SET
      active_present_rate = COALESCE(active_present_rate, active_rate),
      active_late_rate = COALESCE(active_late_rate, active_rate),
      active_coveralls_rate = COALESCE(active_coveralls_rate, active_rate),
      active_coveralls_nametag_rate = COALESCE(active_coveralls_nametag_rate, active_rate),
      pledge_present_rate = COALESCE(pledge_present_rate, pledge_rate),
      pledge_late_rate = COALESCE(pledge_late_rate, pledge_rate)
  `);

  // ------------------------------------------------------------
  // Auth / Users / Roles (Phase 1)
  // ------------------------------------------------------------
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      brother_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_login_at TIMESTAMPTZ,
      CONSTRAINT users_brother_fk FOREIGN KEY (brother_id) REFERENCES brothers(id) ON DELETE SET NULL
    );
  `);

  await createIndexIfMissing(
    "users_email_idx",
    `CREATE INDEX users_email_idx ON users (email);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_key TEXT NOT NULL,
      PRIMARY KEY (user_id, role_key),
      CONSTRAINT user_roles_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Offices (dynamic list). `office_key` is stored normalized (lowercase).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS offices (
      office_key TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Role permissions: configured via admin UI (seeded from defaults on first run).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_key TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      PRIMARY KEY (role_key, permission_key)
    );
  `);

  // Office tenure history: replaces the single brothers.office column.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brother_offices (
      id          SERIAL PRIMARY KEY,
      brother_id  INTEGER NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
      office_key  TEXT NOT NULL REFERENCES offices(office_key) ON DELETE RESTRICT,
      start_date  DATE NOT NULL,
      end_date    DATE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await createIndexIfMissing(
    "brother_offices_brother_idx",
    `CREATE INDEX brother_offices_brother_idx ON brother_offices (brother_id);`
  );
  await createIndexIfMissing(
    "brother_offices_office_idx",
    `CREATE INDEX brother_offices_office_idx ON brother_offices (office_key);`
  );

  // Seed/sync offices (runs every boot to capture legacy offices from Brothers).
  // - ensure default roles exist
  // - ensure alumni pseudo-role exists (used when brother status is Alumnus)
  // - ensure any existing brothers.office values exist (preserve casing as display_name)
  try {
    const { ROLE_PERMISSIONS } = require("../utils/permissions");
    const roleKeys = Object.keys(ROLE_PERMISSIONS ?? {}).map((k) => String(k).toLowerCase());

    // Canonical chapter offices (always seeded regardless of role definitions)
    const DEFAULT_OFFICES = [
      ["alpha",   "Alpha"],
      ["beta",    "Beta"],
      ["pi",      "Pi"],
      ["sigma",   "Sigma"],
      ["tau",     "Tau"],
      ["iota",    "Iota"],
      ["psi",     "Psi"],
      ["theta",   "Theta"],
      ["chi",     "Chi"],
      ["gamma",   "Gamma"],
      ["upsilon", "Upsilon"],
      ["omega",   "Omega"],
      ["zeta",    "Zeta"],
      ["rho",     "Rho"],
      ["phi",     "Phi"],
      ["omicron", "Omicron"],
      ["rush_committee",   "Rush Committee"],
      ["social_committee", "Social Committee"],
    ];
    const defaultOfficeKeys = DEFAULT_OFFICES.map(([k]) => k);
    const seedKeys = Array.from(new Set([...roleKeys, ...defaultOfficeKeys, "alumni"]));
    const seedDisplayMap = new Map([...DEFAULT_OFFICES]);
    for (const k of seedKeys) {
      const existsRes = await pool.query(`SELECT 1 FROM offices WHERE office_key = $1 LIMIT 1`, [k]);
      if (existsRes.rows?.[0]) continue;
      const display = seedDisplayMap.get(k) ?? (k.charAt(0).toUpperCase() + k.slice(1));
      await pool.query(`INSERT INTO offices (office_key, display_name) VALUES ($1, $2)`, [k, display]);
    }

    const broOfficesRes = await pool.query(
      `
        SELECT DISTINCT
          LOWER(TRIM(office)) AS office_key,
          TRIM(office) AS display_name
        FROM brothers
        WHERE office IS NOT NULL AND TRIM(office) <> ''
      `
    );
    for (const r of broOfficesRes.rows ?? []) {
      const office_key = String(r.office_key ?? "").trim().toLowerCase();
      const display_name = String(r.display_name ?? "").trim();
      if (!office_key || !display_name) continue;
      const existsRes = await pool.query(`SELECT 1 FROM offices WHERE office_key = $1 LIMIT 1`, [office_key]);
      if (existsRes.rows?.[0]) continue;
      await pool.query(`INSERT INTO offices (office_key, display_name) VALUES ($1, $2)`, [office_key, display_name]);
    }
  } catch {
    // ignore seed/sync failures
  }

  // Migrate legacy brothers.office -> brother_offices (one-time, idempotent).
  // For brothers with a non-null office that have no existing brother_offices row, create one
  // with start_date = CURRENT_DATE so they immediately become active under the new system.
  try {
    await pool.query(`
      INSERT INTO brother_offices (brother_id, office_key, start_date)
      SELECT b.id, LOWER(TRIM(b.office)), CURRENT_DATE
      FROM brothers b
      WHERE b.office IS NOT NULL
        AND TRIM(b.office) <> ''
        AND EXISTS (SELECT 1 FROM offices o WHERE o.office_key = LOWER(TRIM(b.office)))
        AND NOT EXISTS (
          SELECT 1 FROM brother_offices bo WHERE bo.brother_id = b.id
        )
    `);
  } catch {
    // ignore migration failures (e.g. table not yet ready on first run)
  }

  // Seed role_permissions from code defaults if empty.
  // (We avoid ON CONFLICT for older Postgres versions.)
  const { ROLE_PERMISSIONS } = require("../utils/permissions");
  const rpCountRes = await pool.query(`SELECT COUNT(*)::int AS c FROM role_permissions;`);
  const rpCount = rpCountRes.rows?.[0]?.c ?? 0;
  if (rpCount === 0) {
    for (const [roleKey, perms] of Object.entries(ROLE_PERMISSIONS ?? {})) {
      for (const p of perms ?? []) {
        await pool.query(`INSERT INTO role_permissions (role_key, permission_key) VALUES ($1, $2);`, [roleKey, p]);
      }
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_permission_overrides (
      user_id INTEGER NOT NULL,
      permission_key TEXT NOT NULL,
      effect TEXT NOT NULL, -- 'allow' | 'deny'
      created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by_user_id INTEGER,
      PRIMARY KEY (user_id, permission_key),
      CONSTRAINT user_perm_overrides_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT user_perm_overrides_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await addColumnIfMissing("user_permission_overrides", "created_at", "TIMESTAMPTZ DEFAULT NOW()");
  await addColumnIfMissing("user_permission_overrides", "created_by_user_id", "INTEGER");
  await addConstraintIfMissing(
    "user_permission_overrides",
    "user_perm_overrides_creator_fk",
    `
      ALTER TABLE user_permission_overrides
      ADD CONSTRAINT user_perm_overrides_creator_fk
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    `
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      id SERIAL PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      brother_id INTEGER,
      roles_json TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by_user_id INTEGER,
      CONSTRAINT invite_tokens_brother_fk FOREIGN KEY (brother_id) REFERENCES brothers(id) ON DELETE SET NULL,
      CONSTRAINT invite_tokens_creator_fk FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await addColumnIfMissing("invite_tokens", "revoked_at", "TIMESTAMPTZ");

  await createIndexIfMissing(
    "invite_tokens_email_idx",
    `CREATE INDEX invite_tokens_email_idx ON invite_tokens (email, created_at DESC);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      user_agent TEXT,
      ip TEXT,
      CONSTRAINT refresh_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await createIndexIfMissing(
    "refresh_tokens_user_idx",
    `CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id, created_at DESC);`
  );

  // ------------------------------------------------------------
  // Audit logging (Phase 2)
  // ------------------------------------------------------------
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      occurred_at TIMESTAMPTZ DEFAULT NOW(),
      actor_user_id INTEGER,
      actor_email TEXT,
      ip TEXT,
      user_agent TEXT,
      method TEXT,
      path TEXT,
      status INTEGER,
      action TEXT,
      target_type TEXT,
      target_id TEXT,
      details_json TEXT,
      CONSTRAINT audit_log_actor_fk FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
  await createIndexIfMissing(
    "audit_log_actor_idx",
    `CREATE INDEX audit_log_actor_idx ON audit_log (actor_user_id, occurred_at DESC);`
  );
  await createIndexIfMissing(
    "audit_log_action_idx",
    `CREATE INDEX audit_log_action_idx ON audit_log (action, occurred_at DESC);`
  );

  // Meeting votes: live in-meeting polls created by the Sigma.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_votes (
      id                 SERIAL PRIMARY KEY,
      meeting_id         INTEGER NOT NULL REFERENCES meeting_minutes(id) ON DELETE CASCADE,
      question           TEXT NOT NULL,
      allow_multiple     BOOLEAN NOT NULL DEFAULT false,
      is_anonymous       BOOLEAN NOT NULL DEFAULT false,
      status             TEXT NOT NULL DEFAULT 'open',
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      closed_at          TIMESTAMPTZ
    );
  `);
  await createIndexIfMissing(
    "meeting_votes_meeting_idx",
    `CREATE INDEX meeting_votes_meeting_idx ON meeting_votes (meeting_id, created_at DESC);`
  );
  await addColumnIfMissing("meeting_votes", "results_visible", "BOOLEAN NOT NULL DEFAULT false");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_vote_options (
      id            SERIAL PRIMARY KEY,
      vote_id       INTEGER NOT NULL REFERENCES meeting_votes(id) ON DELETE CASCADE,
      option_text   TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0
    );
  `);
  await createIndexIfMissing(
    "meeting_vote_options_vote_idx",
    `CREATE INDEX meeting_vote_options_vote_idx ON meeting_vote_options (vote_id, display_order);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_vote_responses (
      id         SERIAL PRIMARY KEY,
      vote_id    INTEGER NOT NULL REFERENCES meeting_votes(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (vote_id, user_id)
    );
  `);
  await createIndexIfMissing(
    "meeting_vote_responses_vote_idx",
    `CREATE INDEX meeting_vote_responses_vote_idx ON meeting_vote_responses (vote_id);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meeting_vote_response_selections (
      id          SERIAL PRIMARY KEY,
      response_id INTEGER NOT NULL REFERENCES meeting_vote_responses(id) ON DELETE CASCADE,
      option_id   INTEGER NOT NULL REFERENCES meeting_vote_options(id) ON DELETE CASCADE,
      UNIQUE (response_id, option_id)
    );
  `);

  // Shift scheduling: setup, cleanup, and party shifts.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shift_events (
      id                  SERIAL PRIMARY KEY,
      shift_type          TEXT NOT NULL,
      event_date          DATE NOT NULL,
      title               TEXT,
      school_year         INTEGER,
      notes               TEXT,
      party_start_time    TEXT,
      party_end_time      TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      created_by_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL
    );
  `);
  await createIndexIfMissing(
    "shift_events_type_date_idx",
    `CREATE INDEX shift_events_type_date_idx ON shift_events (shift_type, event_date DESC);`
  );
  await createIndexIfMissing(
    "shift_events_school_year_idx",
    `CREATE INDEX shift_events_school_year_idx ON shift_events (school_year, event_date DESC);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shift_assignments (
      id              SERIAL PRIMARY KEY,
      shift_event_id  INTEGER NOT NULL REFERENCES shift_events(id) ON DELETE CASCADE,
      brother_id      INTEGER NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
      status          TEXT NOT NULL DEFAULT 'assigned',
      makeup_completed_at DATE,
      UNIQUE (shift_event_id, brother_id)
    );
  `);
  await createIndexIfMissing(
    "shift_assignments_event_idx",
    `CREATE INDEX shift_assignments_event_idx ON shift_assignments (shift_event_id);`
  );
  await createIndexIfMissing(
    "shift_assignments_brother_idx",
    `CREATE INDEX shift_assignments_brother_idx ON shift_assignments (brother_id);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shift_party_duties (
      id              SERIAL PRIMARY KEY,
      shift_event_id  INTEGER NOT NULL REFERENCES shift_events(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      display_order   INTEGER NOT NULL DEFAULT 0,
      UNIQUE (shift_event_id, name)
    );
  `);
  await createIndexIfMissing(
    "shift_party_duties_event_idx",
    `CREATE INDEX shift_party_duties_event_idx ON shift_party_duties (shift_event_id);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS shift_party_slots (
      id              SERIAL PRIMARY KEY,
      shift_event_id  INTEGER NOT NULL REFERENCES shift_events(id) ON DELETE CASCADE,
      duty_id         INTEGER NOT NULL REFERENCES shift_party_duties(id) ON DELETE CASCADE,
      slot_start      TEXT NOT NULL,
      brother_id      INTEGER REFERENCES brothers(id) ON DELETE SET NULL,
      status          TEXT NOT NULL DEFAULT 'unassigned',
      makeup_completed_at DATE,
      UNIQUE (shift_event_id, duty_id, slot_start)
    );
  `);
  await createIndexIfMissing(
    "shift_party_slots_event_idx",
    `CREATE INDEX shift_party_slots_event_idx ON shift_party_slots (shift_event_id);`
  );

  // Same free-text makeup assignment as workday_attendance, for both the
  // setup/cleanup roster and the party duty slots.
  await addColumnIfMissing("shift_assignments", "makeup_assignment", "TEXT");
  await addColumnIfMissing("shift_party_slots", "makeup_assignment", "TEXT");

  // Seed shift-related offices (psi, gamma, zeta, theta) alongside existing role seeding.
  try {
    const shiftOffices = [
      { key: "psi", display: "Psi" },
      { key: "gamma", display: "Gamma" },
      { key: "zeta", display: "Zeta" },
      { key: "theta", display: "Theta" },
    ];
    for (const { key, display } of shiftOffices) {
      const exists = await pool.query(`SELECT 1 FROM offices WHERE office_key = $1 LIMIT 1`, [key]);
      if (!exists.rows?.[0]) {
        await pool.query(`INSERT INTO offices (office_key, display_name) VALUES ($1, $2)`, [key, display]);
      }
    }
  } catch {
    // ignore if offices table not ready
  }

  // Budget allocations: treasurer sets budgeted amounts per category per year.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_expense_allocations (
      school_year     INTEGER NOT NULL,
      category_id     INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
      budgeted_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (school_year, category_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_revenue_allocations (
      school_year     INTEGER NOT NULL,
      category_id     INTEGER NOT NULL REFERENCES revenue_categories(id) ON DELETE CASCADE,
      budgeted_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (school_year, category_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_reconciliation (
      school_year         INTEGER PRIMARY KEY,
      cash_amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
      emergency_reserve   NUMERIC(10,2) NOT NULL DEFAULT 0,
      bank_balance        NUMERIC(10,2) NOT NULL DEFAULT 0,
      accounts_receivable NUMERIC(10,2) NOT NULL DEFAULT 0
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS budget_dues_config (
      school_year                  INTEGER PRIMARY KEY,
      dues_rate_active             NUMERIC(10,2) NOT NULL DEFAULT 0,
      dues_rate_pledge             NUMERIC(10,2) NOT NULL DEFAULT 0,
      estimated_pledges            INTEGER NOT NULL DEFAULT 15,
      chapter_bonus_monthly_rate   NUMERIC(10,2) NOT NULL DEFAULT 500
    );
  `);
  await addColumnIfMissing("budget_dues_config", "chapter_bonus_monthly_rate", "NUMERIC(10,2) NOT NULL DEFAULT 500");

  // Room draw legacy point adjustments.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_draw_legacy_points (
      id                SERIAL PRIMARY KEY,
      brother_id        INTEGER NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
      points            NUMERIC NOT NULL,
      reason            TEXT NOT NULL,
      added_by_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at        TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // ── Chapter house (Bannerman House) ────────────────────────────────────────
  // Residence fees are held in a separate bank account from the social budget.
  // Nothing here writes to `revenue` or `expenses`; the only link is the
  // "House Fee Rebate" pinned budget line (see budgetController) and the
  // nullable house_disbursement_shares.revenue_id pointer.

  // Physical bedrooms. Stable across years; capacity/type/rates live per-year.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_rooms (
      id          SERIAL PRIMARY KEY,
      room_code   TEXT NOT NULL UNIQUE,
      floor       INTEGER,
      sort_order  INTEGER,
      is_active   BOOLEAN NOT NULL DEFAULT TRUE,
      notes       TEXT
    );
  `);

  // Sessions: winter = Sep 1 – Apr 30, summer = May 1 – Aug 31 of the same
  // school year (school_year is the September start year).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_sessions (
      id                       SERIAL PRIMARY KEY,
      school_year              INTEGER NOT NULL,
      session_type             TEXT NOT NULL,
      -- A term is a 4-month period. Winter (Sep-Apr) is two terms, summer one.
      -- Room rates and the member rebate are both configured per term.
      terms                    INTEGER NOT NULL DEFAULT 1,
      start_date               DATE,
      end_date                 DATE,
      member_rebate            NUMERIC(10,2) NOT NULL DEFAULT 0,
      prepay_discount_pct      NUMERIC(6,3) NOT NULL DEFAULT 0,
      prepay_deadline          DATE,
      security_deposit_amount  NUMERIC(10,2) NOT NULL DEFAULT 500,
      UNIQUE (school_year, session_type)
    );
  `);

  // Instalments are stored as weights so one schedule scales to every
  // resident's own total.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_session_instalments (
      id            SERIAL PRIMARY KEY,
      school_year   INTEGER NOT NULL,
      session_type  TEXT NOT NULL,
      seq           INTEGER NOT NULL,
      due_date      DATE,
      weight_pct    NUMERIC(6,3) NOT NULL,
      UNIQUE (school_year, session_type, seq)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_room_rates (
      id               SERIAL PRIMARY KEY,
      school_year      INTEGER NOT NULL,
      session_type     TEXT NOT NULL,
      room_id          INTEGER NOT NULL REFERENCES house_rooms(id) ON DELETE CASCADE,
      capacity         INTEGER NOT NULL DEFAULT 1,
      -- One price per room per term. For a double this is per person, so a
      -- buy-out costs capacity x rate_per_person.
      rate_per_person  NUMERIC(10,2),
      UNIQUE (school_year, session_type, room_id)
    );
  `);

  // No unique constraint on (year, session, room, bed): a mid-session move-out
  // followed by a move-in produces two rows for the same bed. Overlap is
  // validated in the controller instead.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_assignments (
      id               SERIAL PRIMARY KEY,
      school_year      INTEGER NOT NULL,
      session_type     TEXT NOT NULL,
      room_id          INTEGER NOT NULL REFERENCES house_rooms(id) ON DELETE CASCADE,
      bed             INTEGER NOT NULL DEFAULT 1,
      brother_id       INTEGER NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
      occupancy        TEXT NOT NULL DEFAULT 'standard',
      start_date       DATE,
      end_date         DATE,
      base_amount      NUMERIC(10,2),
      amount_override  NUMERIC(10,2),
      override_note    TEXT,
      member_discount  BOOLEAN NOT NULL DEFAULT FALSE,
      -- On a buy-out the Co-op may or may not grant the rebate on both beds.
      double_rebate    BOOLEAN NOT NULL DEFAULT FALSE,
      prepay_discount  BOOLEAN NOT NULL DEFAULT FALSE,
      notes            TEXT
    );
  `);
  await createIndexIfMissing(
    "house_assignments_bed_idx",
    `CREATE INDEX house_assignments_bed_idx ON house_assignments (school_year, session_type, room_id, bed);`
  );
  await createIndexIfMissing(
    "house_assignments_brother_idx",
    `CREATE INDEX house_assignments_brother_idx ON house_assignments (brother_id, school_year, session_type);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_payments (
      id             SERIAL PRIMARY KEY,
      brother_id     INTEGER NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
      school_year    INTEGER NOT NULL,
      session_type   TEXT NOT NULL,
      assignment_id  INTEGER REFERENCES house_assignments(id) ON DELETE SET NULL,
      paid_at        DATE NOT NULL,
      amount         NUMERIC(10,2) NOT NULL,
      memo           TEXT
    );
  `);
  await createIndexIfMissing(
    "house_payments_brother_year_idx",
    `CREATE INDEX house_payments_brother_year_idx ON house_payments (brother_id, school_year, session_type);`
  );

  // Deposits are per resident, not per session — they carry over between years
  // and stay in the residence account until refunded.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_deposits (
      id           SERIAL PRIMARY KEY,
      -- One deposit per resident: it carries over between years rather than
      -- being re-taken each session.
      brother_id   INTEGER NOT NULL UNIQUE REFERENCES brothers(id) ON DELETE CASCADE,
      amount       NUMERIC(10,2) NOT NULL,
      received_at  DATE,
      -- outstanding | received | refunded
      status       TEXT NOT NULL DEFAULT 'outstanding',
      released_at  DATE,
      -- The cheque the refund went out on; only meaningful once refunded.
      refund_cheque_number TEXT,
      note         TEXT
    );
  `);
  await createIndexIfMissing(
    "house_deposits_brother_idx",
    `CREATE INDEX house_deposits_brother_idx ON house_deposits (brother_id);`
  );

  // Damages and cleaning charges withheld from a deposit at move-out. Itemised
  // so the resident can be shown what was taken and why.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_deposit_deductions (
      id          SERIAL PRIMARY KEY,
      deposit_id  INTEGER NOT NULL REFERENCES house_deposits(id) ON DELETE CASCADE,
      description TEXT,
      amount      NUMERIC(10,2) NOT NULL DEFAULT 0
    );
  `);
  await createIndexIfMissing(
    "house_deposit_deductions_deposit_idx",
    `CREATE INDEX house_deposit_deductions_deposit_idx ON house_deposit_deductions (deposit_id);`
  );

  // ── Disbursements (schema only for now; UI is a follow-up) ─────────────────
  // Payees are rows rather than fixed columns so the split can change.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_disbursement_payees (
      id           SERIAL PRIMARY KEY,
      school_year  INTEGER NOT NULL,
      payee        TEXT NOT NULL,
      pct          NUMERIC(6,3) NOT NULL,
      is_internal  BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order   INTEGER,
      UNIQUE (school_year, payee)
    );
  `);

  // sub_total = bank_balance - security_to_refund - security_on_account (derived).
  // A row exists only once the money has actually left the account, so there is
  // no draft state — see neon-disbursement-drop-status.sql.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_disbursements (
      id                   SERIAL PRIMARY KEY,
      school_year          INTEGER NOT NULL,
      session_type         TEXT NOT NULL,
      -- Identifies and orders the row, and derives school_year/session_type.
      disbursed_on         DATE,
      bank_balance         NUMERIC(12,2) NOT NULL DEFAULT 0,
      security_to_refund   NUMERIC(12,2) NOT NULL DEFAULT 0,
      security_on_account  NUMERIC(12,2) NOT NULL DEFAULT 0,
      notes                TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_disbursement_shares (
      id               SERIAL PRIMARY KEY,
      disbursement_id  INTEGER NOT NULL REFERENCES house_disbursements(id) ON DELETE CASCADE,
      payee            TEXT NOT NULL,
      pct              NUMERIC(6,3) NOT NULL,
      amount           NUMERIC(12,2) NOT NULL,
      -- Each payee is paid separately, so the cheque number is per share.
      cheque_number    TEXT,
      -- Set once the chapter's share is booked as revenue. ON DELETE SET NULL
      -- rather than CASCADE: deleting the revenue entry un-posts the share so
      -- it can be booked again, but must never delete the disbursement itself.
      -- See neon-disbursement-revenue-fk.sql.
      revenue_id       INTEGER REFERENCES revenue(id) ON DELETE SET NULL,
      UNIQUE (disbursement_id, payee)
    );
  `);

  // Anything moving through the residence account that isn't a fee payment,
  // deposit, or disbursement (bank fees, PM revenue bonus, corrections).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS house_account_adjustments (
      id           SERIAL PRIMARY KEY,
      occurred_on  DATE,
      amount       NUMERIC(12,2) NOT NULL,
      description  TEXT,
      school_year  INTEGER,
      -- Set when the row is the automatic reconciliation for a disbursement
      -- whose entered bank balance disagreed with the derived one. NULL for a
      -- manually entered adjustment. See neon-adjustment-disbursement-link.sql.
      disbursement_id INTEGER REFERENCES house_disbursements(id) ON DELETE CASCADE
    );
  `);

  // ── Chores ────────────────────────────────────────────────────────────────
  // The schedule is a stored grid, one duty per bed per half-month, matching
  // the printed sheet. Like the house fee schedule, the defaults are not seeded
  // on boot — the config page lays them down (see utils/choreDefaults.js).

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chore_duties (
      id           SERIAL PRIMARY KEY,
      duty_no      INTEGER NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      description  TEXT
    );
  `);

  // The schedule itself: which duty a bed has in a given half-month. One
  // schedule, repeated every year — the house runs the same sheet annually, and
  // editing it is meant to change what past periods say too.
  //
  // The beds are not listed here: they come from house_rooms and the capacity in
  // house_room_rates, so House Config stays the one place bedrooms are set up.
  // period_index runs 0-23, September 1st-half through August 2nd-half; a bed
  // with no row for a period is off duty that period.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chore_grid (
      id            SERIAL PRIMARY KEY,
      room_id       INTEGER NOT NULL REFERENCES house_rooms(id) ON DELETE CASCADE,
      bed           INTEGER NOT NULL DEFAULT 1,
      period_index  INTEGER NOT NULL CHECK (period_index BETWEEN 0 AND 23),
      duty_no       INTEGER NOT NULL,
      UNIQUE (room_id, bed, period_index)
    );
  `);

  // Singleton. Only the calendar split and the Gamma's standing duties — the
  // schedule lives in chore_grid.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chore_config (
      id             SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      -- First day of the second period of each month.
      split_day      INTEGER NOT NULL DEFAULT 16,
      manager_notes  TEXT
    );
  `);

  // Standing appointments the Gamma recruits. Not part of the schedule, and
  // like the schedule they are current-state, not a per-year history.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chore_captains (
      id           SERIAL PRIMARY KEY,
      captain_key  TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      description  TEXT,
      brother_id   INTEGER REFERENCES brothers(id) ON DELETE SET NULL,
      sort_order   INTEGER
    );
  `);

  // Seed the 15 physical bedrooms from the floor plans.
  {
    const rooms = [
      ["1A", 1], ["2A", 2], ["2B", 2], ["2C", 2], ["2D", 2], ["2E", 2],
      ["2F", 2], ["2G", 2], ["3A", 3], ["3B", 3], ["3C", 3], ["3D", 3],
      ["3E", 3], ["3F", 3], ["3G", 3],
    ];
    for (let i = 0; i < rooms.length; i++) {
      const [code, floor] = rooms[i];
      await pool.query(
        `INSERT INTO house_rooms (room_code, floor, sort_order)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (SELECT 1 FROM house_rooms WHERE room_code = $1);`,
        [code, floor, (i + 1) * 10]
      );
    }
  }

  // ── Alumni donations and bonds ────────────────────────────────────────────
  // Alumni give money, and by convention their first dollars retire the bond
  // they bought rather than counting as a gift. A donation row is therefore
  // either 'bond' or 'general' — a cheque that straddles the bond line is
  // written as two rows, so campaign totals never double-count bond money.

  // Singleton, same shape as chore_config. Only the price a *new* bond opens
  // at: existing bonds keep the price they were opened with.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donation_config (
      id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      bond_price  NUMERIC(10,2) NOT NULL DEFAULT 300.00
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS donation_campaigns (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL UNIQUE,
      description  TEXT,
      starts_on    DATE,
      ends_on      DATE,
      goal_amount  NUMERIC(12,2),
      is_active    BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order   INTEGER
    );
  `);

  // One bond per brother. The price is a snapshot: raising the config price
  // must not retroactively re-indebt everyone who already paid theirs off.
  // Opened lazily by the first donation applied to it, and left editable for
  // bonds bought years ago at an older price.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alumni_bonds (
      id          SERIAL PRIMARY KEY,
      brother_id  INTEGER NOT NULL UNIQUE REFERENCES brothers(id) ON DELETE CASCADE,
      bond_price  NUMERIC(10,2) NOT NULL,
      opened_on   DATE,
      -- The certificate number, which is issued once the bond is paid off and
      -- often is not known at the time of the donation. Nullable and filled in
      -- later; unique so the same certificate cannot be recorded twice.
      bond_number TEXT,
      notes       TEXT
    );
  `);

  await addColumnIfMissing("alumni_bonds", "bond_number", "TEXT");
  await createIndexIfMissing(
    "idx_alumni_bonds_number",
    `CREATE UNIQUE INDEX idx_alumni_bonds_number ON alumni_bonds (bond_number) WHERE bond_number IS NOT NULL;`
  );

  // The balance owing on a bond is derived (price less the 'bond' rows), never
  // stored, so the ledger and the balance cannot drift apart.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donations (
      id           SERIAL PRIMARY KEY,
      brother_id   INTEGER NOT NULL REFERENCES brothers(id) ON DELETE CASCADE,
      donated_on   DATE NOT NULL,
      amount       NUMERIC(10,2) NOT NULL CHECK (amount > 0),
      kind         TEXT NOT NULL CHECK (kind IN ('bond','general')),
      -- Only a general gift can belong to a campaign; bond money is a debt
      -- being retired, not a contribution to a fundraising push.
      campaign_id  INTEGER REFERENCES donation_campaigns(id) ON DELETE SET NULL,
      school_year  INTEGER,
      note         TEXT,
      CONSTRAINT donations_bond_no_campaign CHECK (kind = 'general' OR campaign_id IS NULL)
    );
  `);

  await createIndexIfMissing(
    "idx_donations_brother",
    `CREATE INDEX idx_donations_brother ON donations (brother_id);`
  );
  await createIndexIfMissing(
    "idx_donations_campaign",
    `CREATE INDEX idx_donations_campaign ON donations (campaign_id);`
  );
  await createIndexIfMissing(
    "idx_donations_donated_on",
    `CREATE INDEX idx_donations_donated_on ON donations (donated_on);`
  );

  // Pinned revenue category for the PKSAB share of house disbursements.
  await pool.query(`
    INSERT INTO revenue_categories (name)
    SELECT 'House Fee Rebate'
    WHERE NOT EXISTS (SELECT 1 FROM revenue_categories WHERE name = 'House Fee Rebate');
  `);

  // Catch-all categories. Deleting any other category reassigns its entries
  // here rather than removing the money, so these must always exist.
  await pool.query(`
    INSERT INTO revenue_categories (name)
    SELECT 'Misc'
    WHERE NOT EXISTS (SELECT 1 FROM revenue_categories WHERE name = 'Misc');
  `);
  await pool.query(`
    INSERT INTO expense_categories (name)
    SELECT 'Misc'
    WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE name = 'Misc');
  `);

  // Optional bootstrap admin for first-time setup (creates user if none exist).
  if (env.bootstrap?.adminEmail && env.bootstrap?.adminPassword) {
    const existing = await pool.query(`SELECT COUNT(*)::int AS c FROM users;`);
    const count = existing.rows?.[0]?.c ?? 0;
    if (count === 0) {
      const email = String(env.bootstrap.adminEmail).toLowerCase().trim();
      const pw = String(env.bootstrap.adminPassword);

      // Minimal password hash format for bootstrapping only: scrypt with random salt.
      // This matches the format we'll verify in auth utils (implemented later).
      const salt = crypto.randomBytes(16);
      const key = crypto.scryptSync(pw, salt, 64);
      const password_hash = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;

      const res = await pool.query(
        `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id;`,
        [email, password_hash]
      );
      const userId = res.rows?.[0]?.id;
      if (userId) {
        await pool.query(`INSERT INTO user_roles (user_id, role_key) VALUES ($1, 'admin');`, [userId]);
      }
      // eslint-disable-next-line no-console
      console.log(`[bootstrap] Created initial admin user: ${email} (role: admin)`);
    }
  }
}

module.exports = { setupTables };



