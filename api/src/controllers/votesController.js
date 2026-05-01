const { pool } = require("../db/pool");
const { idParamSchema } = require("../validation/common");
const { voteCreateSchema, voteRespondSchema } = require("../validation/votes");
const { loadAuthContext } = require("../middleware/auth");

async function createVote(req, res) {
  const { id: meetingId } = idParamSchema.parse(req.params);
  const { question, options, allow_multiple, is_anonymous } = voteCreateSchema.parse(req.body);

  const ctx = await loadAuthContext(req);
  const createdByUserId = ctx?.id ?? null;

  // Verify meeting exists
  const meetingCheck = await pool.query(`SELECT id FROM meeting_minutes WHERE id = $1`, [meetingId]);
  if (!meetingCheck.rows?.[0]) {
    return res.status(404).json({ error: { message: "Meeting not found" } });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const voteRes = await client.query(
      `INSERT INTO meeting_votes (meeting_id, question, allow_multiple, is_anonymous, status, results_visible, created_by_user_id)
       VALUES ($1, $2, $3, $4, 'open', false, $5)
       RETURNING id, meeting_id, question, allow_multiple, is_anonymous, status, results_visible, created_at`,
      [meetingId, question, allow_multiple, is_anonymous, createdByUserId]
    );
    const vote = voteRes.rows[0];

    const insertedOptions = [];
    for (let i = 0; i < options.length; i++) {
      const optRes = await client.query(
        `INSERT INTO meeting_vote_options (vote_id, option_text, display_order) VALUES ($1, $2, $3) RETURNING id, option_text, display_order`,
        [vote.id, options[i], i]
      );
      insertedOptions.push(optRes.rows[0]);
    }

    await client.query("COMMIT");
    return res.status(201).json({ ...vote, options: insertedOptions, my_response: null });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listVotesForMeeting(req, res) {
  const { id: meetingId } = idParamSchema.parse(req.params);

  const votesRes = await pool.query(
    `SELECT id, meeting_id, question, allow_multiple, is_anonymous, status, results_visible, created_at, closed_at
     FROM meeting_votes WHERE meeting_id = $1 ORDER BY created_at ASC`,
    [meetingId]
  );

  const votes = votesRes.rows;
  if (votes.length === 0) return res.status(200).json([]);

  const voteIds = votes.map((v) => v.id);
  const optionsRes = await pool.query(
    `SELECT id, vote_id, option_text, display_order FROM meeting_vote_options WHERE vote_id = ANY($1) ORDER BY vote_id, display_order`,
    [voteIds]
  );

  const ctx = await loadAuthContext(req);
  const userId = ctx?.id ?? null;
  let responsesByVoteId = {};
  if (userId) {
    const responsesRes = await pool.query(
      `SELECT r.vote_id, array_agg(s.option_id) AS option_ids
       FROM meeting_vote_responses r
       JOIN meeting_vote_response_selections s ON s.response_id = r.id
       WHERE r.vote_id = ANY($1) AND r.user_id = $2
       GROUP BY r.vote_id`,
      [voteIds, userId]
    );
    for (const row of responsesRes.rows ?? []) {
      responsesByVoteId[row.vote_id] = { option_ids: row.option_ids };
    }
  }

  const optionsByVoteId = {};
  for (const opt of optionsRes.rows ?? []) {
    if (!optionsByVoteId[opt.vote_id]) optionsByVoteId[opt.vote_id] = [];
    optionsByVoteId[opt.vote_id].push({ id: opt.id, option_text: opt.option_text, display_order: opt.display_order });
  }

  const result = votes.map((v) => ({
    ...v,
    options: optionsByVoteId[v.id] ?? [],
    my_response: responsesByVoteId[v.id] ?? null,
  }));

  return res.status(200).json(result);
}

async function getVote(req, res) {
  const voteId = Number(req.params.voteId);
  if (!Number.isFinite(voteId) || voteId <= 0) {
    return res.status(400).json({ error: { message: "Invalid vote id" } });
  }

  const voteRes = await pool.query(
    `SELECT id, meeting_id, question, allow_multiple, is_anonymous, status, results_visible, created_at, closed_at
     FROM meeting_votes WHERE id = $1`,
    [voteId]
  );
  const vote = voteRes.rows?.[0];
  if (!vote) return res.status(404).json({ error: { message: "Vote not found" } });

  const optionsRes = await pool.query(
    `SELECT id, option_text, display_order FROM meeting_vote_options WHERE vote_id = $1 ORDER BY display_order`,
    [voteId]
  );

  const ctx = await loadAuthContext(req);
  const userId = ctx?.id ?? null;
  let myResponse = null;
  if (userId) {
    const myRes = await pool.query(
      `SELECT array_agg(s.option_id) AS option_ids
       FROM meeting_vote_responses r
       JOIN meeting_vote_response_selections s ON s.response_id = r.id
       WHERE r.vote_id = $1 AND r.user_id = $2
       GROUP BY r.id`,
      [voteId, userId]
    );
    if (myRes.rows?.[0]) myResponse = { option_ids: myRes.rows[0].option_ids };
  }

  return res.status(200).json({
    ...vote,
    options: optionsRes.rows,
    my_response: myResponse,
  });
}

async function getResults(req, res) {
  const voteId = Number(req.params.voteId);
  if (!Number.isFinite(voteId) || voteId <= 0) {
    return res.status(400).json({ error: { message: "Invalid vote id" } });
  }

  const voteRes = await pool.query(
    `SELECT id, question, is_anonymous, status, results_visible FROM meeting_votes WHERE id = $1`,
    [voteId]
  );
  const vote = voteRes.rows?.[0];
  if (!vote) return res.status(404).json({ error: { message: "Vote not found" } });

  const countsRes = await pool.query(
    `SELECT o.id, o.option_text, o.display_order, COUNT(s.id)::int AS count
     FROM meeting_vote_options o
     LEFT JOIN meeting_vote_response_selections s ON s.option_id = o.id
     WHERE o.vote_id = $1
     GROUP BY o.id, o.option_text, o.display_order
     ORDER BY o.display_order`,
    [voteId]
  );

  const result = {
    vote_id: vote.id,
    question: vote.question,
    is_anonymous: vote.is_anonymous,
    status: vote.status,
    options: countsRes.rows.map((r) => ({ id: r.id, option_text: r.option_text, count: r.count })),
  };

  if (!vote.is_anonymous) {
    // Non-anonymous: per-option breakdown of who voted for what.
    const votersRes = await pool.query(
      `SELECT s.option_id, r.user_id, u.email, b.first_name, b.last_name
       FROM meeting_vote_responses r
       JOIN meeting_vote_response_selections s ON s.response_id = r.id
       JOIN users u ON u.id = r.user_id
       LEFT JOIN brothers b ON b.id = u.brother_id
       WHERE r.vote_id = $1
       ORDER BY b.last_name NULLS LAST, b.first_name NULLS LAST`,
      [voteId]
    );
    result.voters = votersRes.rows;
  } else {
    // Anonymous: show who voted but not which option they chose.
    const anonRes = await pool.query(
      `SELECT r.user_id, u.email, b.first_name, b.last_name
       FROM meeting_vote_responses r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN brothers b ON b.id = u.brother_id
       WHERE r.vote_id = $1
       ORDER BY b.last_name NULLS LAST, b.first_name NULLS LAST`,
      [voteId]
    );
    result.voters_anon = anonRes.rows;
  }

  return res.status(200).json(result);
}

async function submitResponse(req, res) {
  const voteId = Number(req.params.voteId);
  if (!Number.isFinite(voteId) || voteId <= 0) {
    return res.status(400).json({ error: { message: "Invalid vote id" } });
  }

  const { option_ids } = voteRespondSchema.parse(req.body);
  const userId = req.auth?.userId;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

  const voteRes = await pool.query(
    `SELECT id, status, allow_multiple FROM meeting_votes WHERE id = $1`,
    [voteId]
  );
  const vote = voteRes.rows?.[0];
  if (!vote) return res.status(404).json({ error: { message: "Vote not found" } });
  if (vote.status === "closed") return res.status(409).json({ error: { message: "This vote is closed" } });

  if (!vote.allow_multiple && option_ids.length > 1) {
    return res.status(400).json({ error: { message: "Only one selection is allowed for this vote" } });
  }

  // Verify all option_ids belong to this vote
  const optCheck = await pool.query(
    `SELECT COUNT(*)::int AS c FROM meeting_vote_options WHERE id = ANY($1) AND vote_id = $2`,
    [option_ids, voteId]
  );
  if ((optCheck.rows?.[0]?.c ?? 0) !== option_ids.length) {
    return res.status(400).json({ error: { message: "One or more option IDs are invalid for this vote" } });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check for existing response (unique constraint prevents duplicates)
    const existing = await client.query(
      `SELECT id FROM meeting_vote_responses WHERE vote_id = $1 AND user_id = $2`,
      [voteId, userId]
    );
    if (existing.rows?.[0]) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: { message: "You have already voted in this poll" } });
    }

    const responseRes = await client.query(
      `INSERT INTO meeting_vote_responses (vote_id, user_id) VALUES ($1, $2) RETURNING id`,
      [voteId, userId]
    );
    const responseId = responseRes.rows[0].id;

    for (const optId of option_ids) {
      await client.query(
        `INSERT INTO meeting_vote_response_selections (response_id, option_id) VALUES ($1, $2)`,
        [responseId, optId]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function closeVote(req, res) {
  const voteId = Number(req.params.voteId);
  if (!Number.isFinite(voteId) || voteId <= 0) {
    return res.status(400).json({ error: { message: "Invalid vote id" } });
  }

  const result = await pool.query(
    `UPDATE meeting_votes SET status = 'closed', closed_at = NOW()
     WHERE id = $1 AND status = 'open'
     RETURNING id`,
    [voteId]
  );
  if (!result.rows?.[0]) {
    return res.status(404).json({ error: { message: "Vote not found or already closed" } });
  }
  return res.status(200).json({ ok: true });
}

async function deleteVote(req, res) {
  const voteId = Number(req.params.voteId);
  if (!Number.isFinite(voteId) || voteId <= 0) {
    return res.status(400).json({ error: { message: "Invalid vote id" } });
  }

  const result = await pool.query(`DELETE FROM meeting_votes WHERE id = $1 RETURNING id`, [voteId]);
  if (!result.rows?.[0]) {
    return res.status(404).json({ error: { message: "Vote not found" } });
  }
  return res.status(200).json({ ok: true });
}

async function setResultsVisible(req, res) {
  const voteId = Number(req.params.voteId);
  if (!Number.isFinite(voteId) || voteId <= 0) {
    return res.status(400).json({ error: { message: "Invalid vote id" } });
  }

  const visible = Boolean(req.body?.visible);
  const result = await pool.query(
    `UPDATE meeting_votes SET results_visible = $1 WHERE id = $2 RETURNING id`,
    [visible, voteId]
  );
  if (!result.rows?.[0]) {
    return res.status(404).json({ error: { message: "Vote not found" } });
  }
  return res.status(200).json({ ok: true });
}

module.exports = { createVote, listVotesForMeeting, getVote, getResults, submitResponse, closeVote, deleteVote, setResultsVisible };
