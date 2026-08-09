import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useAuth } from "../context/authContext";
import { getHouseConfig, saveHouseConfig, seedHouseConfig } from "../services/houseConfigService";
import {
  HouseSessionType,
  IHouseConfig,
  IHouseRoomRate,
  IHouseSession,
} from "../interfaces/api.interface";
import SchoolYearSelector from "../components/SchoolYearSelector";
import HouseSessionSelector from "../components/HouseSessionSelector";
import { schoolYearLabel, schoolYearStartForDate } from "../utils/schoolYear";
import { formatMoney, roundMoney } from "../utils/money";
import { instalmentLabel, sessionLabel } from "../utils/house";

const CELL_SX = { py: 0.5 };
const HEAD_SX = { py: 1, fontWeight: 700, whiteSpace: "nowrap" as const };
const SESSION_TYPES: HouseSessionType[] = ["winter", "summer"];

function emptySession(sessionType: HouseSessionType): IHouseSession {
  return {
    session_type: sessionType,
    terms: sessionType === "winter" ? 2 : 1,
    start_date: null,
    end_date: null,
    member_rebate: 0,
    prepay_discount_pct: 0,
    prepay_deadline: null,
    security_deposit_amount: 500,
    instalments: [],
  };
}

export default function HouseConfigPage() {
  const { can } = useAuth();
  const canWrite = can("house.config");

  const [year, setYear] = useState(schoolYearStartForDate(new Date()));
  const [session, setSession] = useState<HouseSessionType>("winter");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [config, setConfig] = useState<IHouseConfig | null>(null);

  // Draft copies so the whole year can be edited and saved in one go.
  const [sessions, setSessions] = useState<IHouseSession[]>([]);
  const [rates, setRates] = useState<IHouseRoomRate[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await getHouseConfig(year);
      setConfig(cfg);
      setSessions(
        SESSION_TYPES.map(
          (t) => cfg.sessions.find((s) => s.session_type === t) ?? emptySession(t)
        )
      );
      setRates(
        cfg.rooms.flatMap((room) =>
          SESSION_TYPES.map(
            (t) =>
              cfg.rates.find((r) => r.session_type === t && r.room_id === room.id) ?? {
                session_type: t,
                room_id: room.id,
                capacity: 1,
                rate_per_person: null,
              }
          )
        )
      );
    } catch (e: any) {
      setConfig(null);
      setError(e?.message ?? "Could not load the house configuration.");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const draftSession = sessions.find((s) => s.session_type === session) ?? emptySession(session);

  function patchSession(patch: Partial<IHouseSession>) {
    setSessions((prev) =>
      prev.map((s) => (s.session_type === session ? { ...s, ...patch } : s))
    );
  }

  function patchRate(roomId: number, patch: Partial<IHouseRoomRate>) {
    setRates((prev) =>
      prev.map((r) =>
        r.room_id === roomId && r.session_type === session ? { ...r, ...patch } : r
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await saveHouseConfig({ year, sessions, rates });
      setNotice("Saved.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSeed(from?: number) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await seedHouseConfig(year, from);
      setNotice(from ? `Copied ${schoolYearLabel(from)} forward.` : "Loaded the default fee schedule.");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Could not seed the year.");
    } finally {
      setSaving(false);
    }
  }

  const weightTotal = draftSession.instalments.reduce((sum, i) => sum + Number(i.weight_pct || 0), 0);

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h5">House Config</Typography>
            <Typography variant="body2" color="text.secondary">
              Rooms, rates, session dates, and instalment schedules for {schoolYearLabel(year)}.
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            <HouseSessionSelector value={session} onChange={setSession} />
            <SchoolYearSelector value={year} onChange={setYear} />
          </Stack>
        </Stack>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {!canWrite && <Alert severity="info">You have read-only access to this page.</Alert>}

      {loading ? (
        <CircularProgress />
      ) : (
        <>
          {config && !config.is_configured && (
            <Alert
              severity="info"
              action={
                canWrite && (
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => handleSeed()} disabled={saving}>
                      Load defaults
                    </Button>
                    <Button size="small" onClick={() => handleSeed(year - 1)} disabled={saving}>
                      Copy {schoolYearLabel(year - 1)}
                    </Button>
                  </Stack>
                )
              }
            >
              {schoolYearLabel(year)} isn&apos;t configured yet.
            </Alert>
          )}

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              {sessionLabel(year, session)}
            </Typography>
            <Stack spacing={2}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Terms"
                  type="number"
                  value={draftSession.terms ?? 1}
                  onChange={(e) => patchSession({ terms: Number(e.target.value) })}
                  inputProps={{ min: 1, max: 4 }}
                  helperText="4-month terms in this session"
                  disabled={!canWrite}
                  fullWidth
                />
                <TextField
                  label="Start date"
                  type="date"
                  value={draftSession.start_date ?? ""}
                  onChange={(e) => patchSession({ start_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  disabled={!canWrite}
                  fullWidth
                />
                <TextField
                  label="End date"
                  type="date"
                  value={draftSession.end_date ?? ""}
                  onChange={(e) => patchSession({ end_date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  disabled={!canWrite}
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Member rebate / term"
                  type="number"
                  value={draftSession.member_rebate ?? 0}
                  onChange={(e) => patchSession({ member_rebate: Number(e.target.value) })}
                  inputProps={{ step: "0.01" }}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  disabled={!canWrite}
                  fullWidth
                />
                <TextField
                  label="Pre-payment discount"
                  type="number"
                  value={draftSession.prepay_discount_pct ?? 0}
                  onChange={(e) => patchSession({ prepay_discount_pct: Number(e.target.value) })}
                  inputProps={{ step: "0.1" }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  disabled={!canWrite}
                  fullWidth
                />
                <TextField
                  label="Pre-payment deadline"
                  type="date"
                  value={draftSession.prepay_deadline ?? ""}
                  onChange={(e) => patchSession({ prepay_deadline: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  disabled={!canWrite}
                  fullWidth
                />
                <TextField
                  label="Security deposit"
                  type="number"
                  value={draftSession.security_deposit_amount ?? 0}
                  onChange={(e) => patchSession({ security_deposit_amount: Number(e.target.value) })}
                  inputProps={{ step: "0.01" }}
                  InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                  disabled={!canWrite}
                  fullWidth
                />
              </Stack>

              <Divider />

              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle2">Instalments</Typography>
                <Typography
                  variant="caption"
                  color={roundMoney(weightTotal) === 100 ? "text.secondary" : "error.main"}
                >
                  Weights total {roundMoney(weightTotal)}% (must be 100%)
                </Typography>
              </Stack>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...HEAD_SX, width: 110 }}>Instalment</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 200 }}>Due date</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 140 }} align="right">Weight</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 60 }} align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {draftSession.instalments.map((inst, idx) => (
                    <TableRow key={inst.seq}>
                      <TableCell sx={{ ...CELL_SX, width: 110, fontWeight: 600 }}>
                        {instalmentLabel(inst.seq)}
                      </TableCell>
                      <TableCell sx={{ ...CELL_SX, width: 200 }}>
                        <TextField
                          size="small"
                          type="date"
                          value={inst.due_date ?? ""}
                          InputLabelProps={{ shrink: true }}
                          disabled={!canWrite}
                          sx={{ width: 170 }}
                          onChange={(e) => {
                            const next = [...draftSession.instalments];
                            next[idx] = { ...inst, due_date: e.target.value };
                            patchSession({ instalments: next });
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...CELL_SX, width: 140 }} align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={inst.weight_pct}
                          disabled={!canWrite}
                          sx={{ width: 110 }}
                          inputProps={{ step: "0.1", style: { textAlign: "right" } }}
                          InputProps={{
                            endAdornment: <InputAdornment position="end">%</InputAdornment>,
                          }}
                          onChange={(e) => {
                            const next = [...draftSession.instalments];
                            next[idx] = { ...inst, weight_pct: Number(e.target.value) };
                            patchSession({ instalments: next });
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...CELL_SX, width: 60 }} align="right">
                        {canWrite && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                              patchSession({
                                instalments: draftSession.instalments.filter((_x, i) => i !== idx),
                              })
                            }
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {canWrite && (
                <Box>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      const nextSeq =
                        draftSession.instalments.reduce((m, i) => Math.max(m, i.seq), 0) + 1;
                      patchSession({
                        instalments: [
                          ...draftSession.instalments,
                          { seq: nextSeq, due_date: null, weight_pct: 0 },
                        ],
                      });
                    }}
                  >
                    Add instalment
                  </Button>
                </Box>
              )}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
            <Box sx={{ p: 2, pb: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Rooms &amp; rates</Typography>
              <Typography variant="body2" color="text.secondary">
                One price per room per 4-month term. For a double it is the price per person, so a
                buy-out costs twice that. This session is {draftSession.terms ?? 1} term
                {(draftSession.terms ?? 1) === 1 ? "" : "s"}, so the session total is the term rate
                {(draftSession.terms ?? 1) === 1 ? "" : ` \u00d7 ${draftSession.terms}`}.
              </Typography>
            </Box>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...HEAD_SX, width: 80 }}>Room</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 220 }}>Occupancy</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 160 }} align="right">Rate / term</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 120 }} align="right">Buy-out / term</TableCell>
                    <TableCell sx={{ ...HEAD_SX, width: 130 }} align="right">Session total</TableCell>
                    <TableCell sx={HEAD_SX} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(config?.rooms ?? []).map((room) => {
                    const rate = rates.find(
                      (r) => r.room_id === room.id && r.session_type === session
                    );
                    if (!rate) return null;
                    const isDouble = rate.capacity > 1;
                    return (
                      <TableRow key={room.id} hover>
                        <TableCell sx={{ ...CELL_SX, width: 80, fontWeight: 600 }}>
                          {room.room_code}
                        </TableCell>

                        {/* Capacity is a two-way choice, so it's a radio rather
                            than a number field. */}
                        <TableCell sx={{ ...CELL_SX, width: 220 }}>
                          <RadioGroup
                            row
                            value={isDouble ? "double" : "single"}
                            onChange={(e) =>
                              patchRate(room.id, { capacity: e.target.value === "double" ? 2 : 1 })
                            }
                          >
                            <FormControlLabel
                              value="single"
                              disabled={!canWrite}
                              control={<Radio size="small" />}
                              label={<Typography variant="body2">Single</Typography>}
                            />
                            <FormControlLabel
                              value="double"
                              disabled={!canWrite}
                              control={<Radio size="small" />}
                              label={<Typography variant="body2">Double</Typography>}
                            />
                          </RadioGroup>
                        </TableCell>

                        <TableCell sx={{ ...CELL_SX, width: 160 }} align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={rate.rate_per_person ?? ""}
                            disabled={!canWrite}
                            sx={{ width: 130 }}
                            inputProps={{ step: "0.01", style: { textAlign: "right" } }}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                            onChange={(e) =>
                              patchRate(room.id, {
                                rate_per_person: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                        </TableCell>

                        {/* Derived, not stored: capacity x the per-person rate.
                            A single has no whole-room price distinct from its rate. */}
                        <TableCell sx={{ ...CELL_SX, width: 120 }} align="right">
                          <Typography variant="body2" color="text.secondary">
                            {!isDouble || rate.rate_per_person == null
                              ? "—"
                              : `$${formatMoney(rate.rate_per_person * rate.capacity)}`}
                          </Typography>
                        </TableCell>

                        {/* Derived: term rate x the session's term count. */}
                        <TableCell sx={{ ...CELL_SX, width: 130 }} align="right">
                          <Typography variant="body2">
                            {rate.rate_per_person == null
                              ? "—"
                              : `$${formatMoney(rate.rate_per_person * (draftSession.terms ?? 1))}`}
                          </Typography>
                        </TableCell>
                        <TableCell sx={CELL_SX}>
                          {isDouble && (
                            <Typography variant="caption" color="text.secondary">
                              per person
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {canWrite && (
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button variant="outlined" onClick={load} disabled={saving}>Discard changes</Button>
              <Button variant="contained" onClick={handleSave} disabled={saving}>Save config</Button>
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
