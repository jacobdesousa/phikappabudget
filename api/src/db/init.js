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
      etransfer_amount = COALESCE(etransfer_amount, 0)
    WHERE cash_amount IS NULL OR square_amount IS NULL OR etransfer_amount IS NULL;
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

    const seedKeys = Array.from(new Set([...roleKeys, "alumni"]));
    for (const k of seedKeys) {
      const existsRes = await pool.query(`SELECT 1 FROM offices WHERE office_key = $1 LIMIT 1`, [k]);
      if (existsRes.rows?.[0]) continue;
      const display = k.charAt(0).toUpperCase() + k.slice(1);
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
        await pool.query(`INSERT INTO user_roles (user_id, role_key) VALUES ($1, 'tau');`, [userId]);
      }
      // eslint-disable-next-line no-console
      console.log(`[bootstrap] Created initial admin user: ${email} (role: tau)`);
    }
  }
}

module.exports = { setupTables };



