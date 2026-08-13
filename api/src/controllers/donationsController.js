// Alumni giving. Two things are tracked together because they are entered
// together: the bond a brother bought, and the donations that pay it off and
// then keep coming.
//
// The house convention is that a brother's first dollars retire their bond.
// Rather than store a gift with two amounts, a gift that straddles the bond
// line is written as two rows — one 'bond', one 'general' — so campaign totals
// are a plain SUM over general rows and can never double-count bond money.
//
// The balance owing on a bond is derived here, never stored: bond_price less
// the brother's 'bond' rows.
const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { schoolYearStartForDate } = require("../utils/schoolYear");
const { roundMoney } = require("../utils/money");
const {
  listQuerySchema,
  brotherParamSchema,
  donationEntrySchema,
  donationUpdateSchema,
  bondUpdateSchema,
  donationConfigUpsertSchema,
} = require("../validation/donations");

const DEFAULT_BOND_PRICE = 300;

const DONATION_SELECT = `
  SELECT d.id, d.brother_id, d.donated_on::text AS donated_on, d.amount, d.kind,
         d.campaign_id, d.school_year, d.note,
         b.first_name, b.last_name,
         c.name AS campaign_name
  FROM donations d
  JOIN brothers b ON b.id = d.brother_id
  LEFT JOIN donation_campaigns c ON c.id = d.campaign_id
`;

// The singleton config row is created on first read so the config page never
// has to special-case an empty database.
async function loadConfigPrice(client = pool) {
  const { rows } = await client.query(`SELECT bond_price FROM donation_config WHERE id = 1`);
  if (rows[0]) return Number(rows[0].bond_price);
  await client.query(
    `INSERT INTO donation_config (id, bond_price) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`,
    [DEFAULT_BOND_PRICE]
  );
  return DEFAULT_BOND_PRICE;
}

async function loadCampaigns(client = pool) {
  const { rows } = await client.query(
    `SELECT c.id, c.name, c.description,
            c.starts_on::text AS starts_on, c.ends_on::text AS ends_on,
            c.goal_amount, c.is_active, c.sort_order,
            COALESCE(agg.raised, 0) AS raised,
            COALESCE(agg.donation_count, 0)::int AS donation_count,
            COALESCE(agg.donor_count, 0)::int AS donor_count,
            agg.last_donation_on::text AS last_donation_on
     FROM donation_campaigns c
     LEFT JOIN (
       SELECT campaign_id,
              SUM(amount) AS raised,
              COUNT(*) AS donation_count,
              COUNT(DISTINCT brother_id) AS donor_count,
              MAX(donated_on) AS last_donation_on
       FROM donations WHERE campaign_id IS NOT NULL
       GROUP BY campaign_id
     ) agg ON agg.campaign_id = c.id
     ORDER BY c.is_active DESC, c.sort_order ASC NULLS LAST, c.name ASC`
  );
  return rows;
}

// What the entry form needs to propose a split, and what the ledger shows next
// to a brother's name. A brother with no bond row yet is quoted the config
// price: that is what their bond would open at.
async function loadBondState(brotherId, client = pool) {
  const [bondRes, paidRes] = await Promise.all([
    client.query(
      `SELECT id, bond_price, opened_on::text AS opened_on, bond_number, notes
       FROM alumni_bonds WHERE brother_id = $1`,
      [brotherId]
    ),
    client.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid
       FROM donations WHERE brother_id = $1 AND kind = 'bond'`,
      [brotherId]
    ),
  ]);

  const bond = bondRes.rows[0];
  const bondPrice = bond ? Number(bond.bond_price) : await loadConfigPrice(client);
  const paid = Number(paidRes.rows[0]?.paid ?? 0);

  return {
    brother_id: brotherId,
    has_bond: Boolean(bond),
    bond_price: roundMoney(bondPrice),
    bond_paid: roundMoney(paid),
    bond_outstanding: roundMoney(Math.max(0, bondPrice - paid)),
    opened_on: bond?.opened_on ?? null,
    bond_number: bond?.bond_number ?? null,
    notes: bond?.notes ?? null,
  };
}

// ── Reads ───────────────────────────────────────────────────────────────────

async function listDonations(req, res) {
  const q = listQuerySchema.parse(req.query);

  const where = [];
  const params = [];
  if (q.brother_id) {
    params.push(q.brother_id);
    where.push(`d.brother_id = $${params.length}`);
  }
  if (q.campaign_id) {
    params.push(q.campaign_id);
    where.push(`d.campaign_id = $${params.length}`);
  }
  // The catch-all row of the campaigns table: bond money and unattached gifts.
  if (q.no_campaign) {
    where.push(`d.campaign_id IS NULL`);
  }
  if (q.year) {
    params.push(q.year);
    where.push(`d.school_year = $${params.length}`);
  }
  if (q.kind) {
    params.push(q.kind);
    where.push(`d.kind = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalRes = await pool.query(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(d.amount), 0) AS total_amount
     FROM donations d ${whereSql}`,
    params
  );

  const rowsRes = await pool.query(
    `${DONATION_SELECT} ${whereSql}
     ORDER BY d.donated_on DESC, d.id DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, q.limit, q.offset]
  );

  res.status(200).json({
    rows: rowsRes.rows,
    total: totalRes.rows[0]?.total ?? 0,
    total_amount: Number(totalRes.rows[0]?.total_amount ?? 0),
  });
}

function rollup(row) {
  return {
    raised: roundMoney(Number(row?.raised ?? 0)),
    donation_count: row?.donation_count ?? 0,
    donor_count: row?.donor_count ?? 0,
    last_donation_on: row?.last_donation_on ?? null,
  };
}

// The page header: lifetime giving, campaign progress, and where the bonds
// stand. Only brothers who have given or hold a bond appear in `brothers`.
async function getDonationSummary(req, res) {
  const [totalsRes, brothersRes, campaigns, bondPrice, uncampaignedRes] = await Promise.all([
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS lifetime_total,
              COALESCE(SUM(amount) FILTER (WHERE kind = 'bond'), 0) AS bond_total,
              COALESCE(SUM(amount) FILTER (WHERE kind = 'general'), 0) AS general_total,
              COUNT(DISTINCT brother_id)::int AS donor_count
       FROM donations`
    ),
    pool.query(
      `SELECT b.id AS brother_id, b.first_name, b.last_name, b.pledge_class, b.status,
              bo.bond_price,
              bo.opened_on::text AS bond_opened_on,
              bo.bond_number,
              COALESCE(SUM(d.amount), 0) AS lifetime_total,
              COALESCE(SUM(d.amount) FILTER (WHERE d.kind = 'bond'), 0) AS bond_paid,
              COUNT(d.id)::int AS donation_count,
              MAX(d.donated_on)::text AS last_donation_on
       FROM brothers b
       LEFT JOIN alumni_bonds bo ON bo.brother_id = b.id
       LEFT JOIN donations d ON d.brother_id = b.id
       WHERE bo.id IS NOT NULL OR d.id IS NOT NULL
       GROUP BY b.id, b.first_name, b.last_name, b.pledge_class, b.status,
                bo.bond_price, bo.opened_on, bo.bond_number
       ORDER BY b.last_name ASC, b.first_name ASC`
    ),
    loadCampaigns(),
    loadConfigPrice(),
    // The two rows the campaigns table carries above the campaigns themselves:
    // bond money (never belongs to a campaign) and gifts pinned to none. With
    // those, every donation is reachable from that table.
    pool.query(
      `SELECT kind = 'bond' AS is_bond,
              COALESCE(SUM(amount), 0) AS raised,
              COUNT(*)::int AS donation_count,
              COUNT(DISTINCT brother_id)::int AS donor_count,
              MAX(donated_on)::text AS last_donation_on
       FROM donations
       WHERE kind = 'bond' OR campaign_id IS NULL
       GROUP BY kind = 'bond'`
    ),
  ]);

  const brothers = brothersRes.rows.map((r) => {
    const price = r.bond_price === null || r.bond_price === undefined ? null : Number(r.bond_price);
    const paid = Number(r.bond_paid);
    return {
      brother_id: Number(r.brother_id),
      first_name: r.first_name,
      last_name: r.last_name,
      pledge_class: r.pledge_class,
      status: r.status,
      has_bond: price !== null,
      bond_price: price,
      bond_opened_on: r.bond_opened_on,
      bond_number: r.bond_number ?? null,
      bond_paid: roundMoney(paid),
      bond_outstanding: price === null ? null : roundMoney(Math.max(0, price - paid)),
      lifetime_total: roundMoney(Number(r.lifetime_total)),
      donation_count: r.donation_count ?? 0,
      last_donation_on: r.last_donation_on,
    };
  });

  const t = totalsRes.rows[0] ?? {};
  res.status(200).json({
    bond_price: bondPrice,
    totals: {
      lifetime_total: roundMoney(Number(t.lifetime_total ?? 0)),
      bond_total: roundMoney(Number(t.bond_total ?? 0)),
      general_total: roundMoney(Number(t.general_total ?? 0)),
      donor_count: t.donor_count ?? 0,
      bond_outstanding: roundMoney(
        brothers.reduce((sum, b) => sum + (b.bond_outstanding ?? 0), 0)
      ),
    },
    campaigns,
    bond_payments: rollup(uncampaignedRes.rows.find((r) => r.is_bond)),
    unattached: rollup(uncampaignedRes.rows.find((r) => !r.is_bond)),
    brothers,
  });
}

async function getBrotherBondState(req, res) {
  const { brotherId } = brotherParamSchema.parse(req.params);
  const { rowCount } = await pool.query(`SELECT 1 FROM brothers WHERE id = $1`, [brotherId]);
  if (!rowCount) {
    return res.status(404).json({ error: { message: "Brother not found" } });
  }
  res.status(200).json(await loadBondState(brotherId));
}

// ── Writes ──────────────────────────────────────────────────────────────────

// One gift in, one or two rows out. Everything happens in a transaction: the
// bond is opened by the same statement batch that records the money paying it.
async function createDonation(req, res) {
  const payload = donationEntrySchema.parse(req.body);
  const amount = roundMoney(payload.amount);
  const schoolYear = payload.school_year ?? schoolYearStartForDate(payload.donated_on);

  const brotherRes = await pool.query(`SELECT 1 FROM brothers WHERE id = $1`, [payload.brother_id]);
  if (!brotherRes.rowCount) {
    return res.status(404).json({ error: { message: "Brother not found" } });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const state = await loadBondState(payload.brother_id, client);

    // The proposal is "as much of the gift as the bond still owes". An explicit
    // bond_amount overrides it, clamped so the bond can never be overpaid.
    const ceiling = roundMoney(Math.min(amount, state.bond_outstanding));
    let bondPortion = payload.apply_to_bond ? ceiling : 0;
    if (payload.apply_to_bond && payload.bond_amount !== null && payload.bond_amount !== undefined) {
      bondPortion = roundMoney(Math.min(Math.max(0, Number(payload.bond_amount)), ceiling));
    }
    const generalPortion = roundMoney(amount - bondPortion);

    if (bondPortion > 0 && !state.has_bond) {
      await client.query(
        `INSERT INTO alumni_bonds (brother_id, bond_price, opened_on)
         VALUES ($1, $2, $3)
         ON CONFLICT (brother_id) DO NOTHING`,
        [payload.brother_id, state.bond_price, payload.donated_on]
      );
    }

    const created = [];
    if (bondPortion > 0) {
      const { rows } = await client.query(
        `INSERT INTO donations (brother_id, donated_on, amount, kind, campaign_id, school_year, note)
         VALUES ($1, $2, $3, 'bond', NULL, $4, $5)
         RETURNING id`,
        [payload.brother_id, payload.donated_on, bondPortion, schoolYear, payload.note ?? null]
      );
      created.push(rows[0].id);
    }
    if (generalPortion > 0) {
      const { rows } = await client.query(
        `INSERT INTO donations (brother_id, donated_on, amount, kind, campaign_id, school_year, note)
         VALUES ($1, $2, $3, 'general', $4, $5, $6)
         RETURNING id`,
        [
          payload.brother_id,
          payload.donated_on,
          generalPortion,
          payload.campaign_id ?? null,
          schoolYear,
          payload.note ?? null,
        ]
      );
      created.push(rows[0].id);
    }

    await client.query("COMMIT");

    const { rows } = await pool.query(`${DONATION_SELECT} WHERE d.id = ANY($1::int[])`, [created]);
    return res.status(201).json(rows);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// Edits one stored row. The split is not recomputed — the two rows of a gift
// are independent once written — but a bond row still cannot overpay the bond.
async function updateDonation(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const payload = donationUpdateSchema.parse(req.body);

  const existingRes = await pool.query(
    `SELECT *, donated_on::text AS donated_on FROM donations WHERE id = $1`,
    [id]
  );
  const existing = existingRes.rows[0];
  if (!existing) {
    return res.status(404).json({ error: { message: "Donation not found" } });
  }

  const merged = { ...existing, ...payload };
  const amount = roundMoney(Number(merged.amount));
  const kind = merged.kind;
  // Bond money is a debt being retired, not a campaign contribution.
  const campaignId = kind === "bond" ? null : merged.campaign_id ?? null;
  const schoolYear = payload.school_year ?? schoolYearStartForDate(merged.donated_on);

  if (kind === "bond") {
    const state = await loadBondState(Number(existing.brother_id));
    const otherPaid = roundMoney(
      state.bond_paid - (existing.kind === "bond" ? Number(existing.amount) : 0)
    );
    if (!state.has_bond) {
      return res.status(409).json({
        error: { message: "This brother has no bond to apply the donation to." },
      });
    }
    if (otherPaid + amount > state.bond_price + 0.005) {
      return res.status(409).json({
        error: {
          message: `That would pay $${roundMoney(otherPaid + amount).toFixed(
            2
          )} against a $${state.bond_price.toFixed(2)} bond.`,
        },
      });
    }
  }

  await pool.query(
    `UPDATE donations SET
       donated_on = $1, amount = $2, kind = $3, campaign_id = $4, school_year = $5, note = $6
     WHERE id = $7`,
    [merged.donated_on, amount, kind, campaignId, schoolYear, merged.note ?? null, id]
  );

  const { rows } = await pool.query(`${DONATION_SELECT} WHERE d.id = $1`, [id]);
  res.status(200).json(rows[0]);
}

async function deleteDonation(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const { rowCount } = await pool.query(`DELETE FROM donations WHERE id = $1`, [id]);
  if (!rowCount) {
    return res.status(404).json({ error: { message: "Donation not found" } });
  }
  res.status(204).send();
}

// Opens or re-prices one brother's bond. Needed for bonds bought years ago at
// an older price, which the config price must not silently rewrite.
async function updateBond(req, res) {
  const { brotherId } = brotherParamSchema.parse(req.params);
  const payload = bondUpdateSchema.parse(req.body);
  const price = roundMoney(payload.bond_price);

  const brotherRes = await pool.query(`SELECT 1 FROM brothers WHERE id = $1`, [brotherId]);
  if (!brotherRes.rowCount) {
    return res.status(404).json({ error: { message: "Brother not found" } });
  }

  const state = await loadBondState(brotherId);
  if (price < state.bond_paid - 0.005) {
    return res.status(409).json({
      error: {
        message: `$${state.bond_paid.toFixed(
          2
        )} has already been paid against this bond, so the price cannot be lower.`,
      },
    });
  }

  try {
    await pool.query(
      `INSERT INTO alumni_bonds (brother_id, bond_price, opened_on, bond_number, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (brother_id) DO UPDATE SET
         bond_price = EXCLUDED.bond_price,
         opened_on = EXCLUDED.opened_on,
         bond_number = EXCLUDED.bond_number,
         notes = EXCLUDED.notes`,
      [
        brotherId,
        price,
        payload.opened_on ?? null,
        payload.bond_number ?? null,
        payload.notes ?? null,
      ]
    );
  } catch (e) {
    // One certificate, one holder — the unique index on bond_number.
    if (e?.code === "23505") {
      return res.status(409).json({
        error: { message: `Bond number ${payload.bond_number} is already on another brother.` },
      });
    }
    throw e;
  }

  res.status(200).json(await loadBondState(brotherId));
}

// ── Config ──────────────────────────────────────────────────────────────────

async function getDonationConfig(req, res) {
  const [bondPrice, campaigns] = await Promise.all([loadConfigPrice(), loadCampaigns()]);
  res.status(200).json({ bond_price: bondPrice, campaigns });
}

// The page sends the whole config back, so a campaign missing from the payload
// was deleted. Its donations survive (campaign_id is ON DELETE SET NULL) — the
// money was still received.
async function saveDonationConfig(req, res) {
  const payload = donationConfigUpsertSchema.parse(req.body);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO donation_config (id, bond_price)
       VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET bond_price = EXCLUDED.bond_price`,
      [roundMoney(payload.bond_price)]
    );

    const keptIds = payload.campaigns.map((c) => c.id).filter((id) => Number.isFinite(Number(id)));
    await client.query(`DELETE FROM donation_campaigns WHERE NOT (id = ANY($1::int[]))`, [keptIds]);

    for (const c of payload.campaigns) {
      const values = [
        c.name,
        c.description ?? null,
        c.starts_on ?? null,
        c.ends_on ?? null,
        c.goal_amount ?? null,
        c.is_active,
        c.sort_order ?? null,
      ];
      if (c.id) {
        await client.query(
          `UPDATE donation_campaigns SET
             name = $1, description = $2, starts_on = $3, ends_on = $4,
             goal_amount = $5, is_active = $6, sort_order = $7
           WHERE id = $8`,
          [...values, c.id]
        );
      } else {
        await client.query(
          `INSERT INTO donation_campaigns (name, description, starts_on, ends_on, goal_amount, is_active, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          values
        );
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    // Two campaigns with the same name: a user error, not a server fault.
    if (e?.code === "23505") {
      return res.status(409).json({ error: { message: "Two campaigns have the same name." } });
    }
    throw e;
  } finally {
    client.release();
  }

  return getDonationConfig(req, res);
}

module.exports = {
  listDonations,
  getDonationSummary,
  getBrotherBondState,
  createDonation,
  updateDonation,
  deleteDonation,
  updateBond,
  getDonationConfig,
  saveDonationConfig,
};
