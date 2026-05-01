import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
  MenuItem,
  Snackbar,
} from "@mui/material";
import dayjs from "dayjs";
import { useRouter } from "next/router";
import type { IWorkday, IWorkdayAttendanceRow } from "../../interfaces/api.interface";
import { getWorkday, updateWorkday } from "../../services/workdaysService";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import { useAuth } from "../../context/authContext";

const STATUS_OPTIONS: Array<IWorkdayAttendanceRow["status"]> = ["Present", "Late", "Excused", "Missing"];

function asDateInputValue(d: any): string {
  if (!d) return dayjs().format("YYYY-MM-DD");
  return dayjs(d).format("YYYY-MM-DD");
}

export default function WorkdayDetailPage() {
  const router = useRouter();
  const { can } = useAuth();
  const canWrite = can("workdays.write");
  const id = Number(router.query.id);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [autosaveReady, setAutosaveReady] = React.useState(false);
  const [workday, setWorkday] = React.useState<IWorkday | null>(null);

  const [isEditing, setIsEditing] = React.useState(false);
  const [draftDate, setDraftDate] = React.useState<string>(dayjs().format("YYYY-MM-DD"));
  const [draftBonusMonth, setDraftBonusMonth] = React.useState<string>(dayjs().format("YYYY-MM"));
  const [draftAttendance, setDraftAttendance] = React.useState<IWorkdayAttendanceRow[]>([]);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async (syncDraft: boolean = true) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getWorkday(id);
      setWorkday(data);
      if (syncDraft) {
        setDraftDate(asDateInputValue(data.workday_date));
        setDraftBonusMonth(String((data as any).bonus_month ?? dayjs(data.workday_date).format("YYYY-MM")));
        setDraftAttendance((data.attendance ?? []).slice());
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load workday.");
      setWorkday(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void refresh(true);
  }, [refresh]);

  // Clear any pending debounce save on unmount.
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const lastSavedHashRef = React.useRef<string | null>(null);
  const debounceTimerRef = React.useRef<any>(null);
  const saveSeqRef = React.useRef(0);

  const buildPayload = React.useCallback(() => {
    return {
      workday_date: dayjs(draftDate).toDate(),
      title: null,
      bonus_month: draftBonusMonth,
      attendance: draftAttendance.map((a) => ({
        brother_id: a.brother_id,
        status: a.status,
        coveralls: a.coveralls ?? null,
        nametag: a.nametag ?? null,
        makeup_completed_at: a.makeup_completed_at ?? null,
      })),
    };
  }, [draftDate, draftBonusMonth, draftAttendance]);

  // Mark initial state as saved (prevents immediate autosave right after loading).
  React.useEffect(() => {
    if (!isEditing) return;
    if (!workday) return;
    if (loading) return;
    if (autosaveReady) return;
    const hash = JSON.stringify(buildPayload());
    lastSavedHashRef.current = hash;
    setAutosaveReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, workday, loading, autosaveReady]);

  // Debounced autosave on any change.
  React.useEffect(() => {
    if (!isEditing) return;
    if (!autosaveReady) return;
    if (!workday) return;
    if (!Number.isFinite(id) || id <= 0) return;

    const payload = buildPayload();
    const hash = JSON.stringify(payload);
    if (hash === lastSavedHashRef.current) return;

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      const seq = ++saveSeqRef.current;
      setSaving(true);
      setSaveError(null);
      setSuccess(null);

      const result = await updateWorkday(id, payload as any);
      if (seq !== saveSeqRef.current) return;

      setSaving(false);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      lastSavedHashRef.current = hash;
      setSuccess("Saved");
      setTimeout(() => setSuccess(null), 900);

      // Keep view-mode data in sync with the latest autosaved changes.
      setWorkday(result.workday);
    }, 800);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isEditing, autosaveReady, workday, id, buildPayload]);

  const summary = workday?.summary;

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
          <Box>
            <Typography variant="h5">Workday</Typography>
            <Typography variant="body2" color="text.secondary">
              {workday?.workday_date ? dayjs(workday.workday_date).format("MMM D, YYYY") : "—"}
            </Typography>
            {!isEditing && workday?.bonus_month ? (
              <Typography variant="body2" color="text.secondary">
                Counts for: {workday.bonus_month}
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={1}>
            {isEditing ? (
              <>
                <Button
                  variant="outlined"
                  onClick={() => {
                    // Revert to last-saved state (workday is kept in sync on autosave)
                    if (workday) {
                      setDraftDate(asDateInputValue(workday.workday_date));
                      setDraftBonusMonth(String((workday as any).bonus_month ?? dayjs(workday.workday_date).format("YYYY-MM")));
                      setDraftAttendance((workday.attendance ?? []).slice());
                    }
                    setAutosaveReady(false);
                    setIsEditing(false);
                    setSaveError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    setIsEditing(false);
                    setAutosaveReady(false);
                  }}
                >
                  Done
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outlined"
                  startIcon={<PictureAsPdfOutlinedIcon />}
                  disabled={!workday?.id}
                  onClick={() => {
                    if (!workday?.id) return;
                    window.open(`/workdays/${workday.id}/print?autoprint=1`, "_blank", "noopener,noreferrer");
                  }}
                >
                  Export PDF
                </Button>
                {canWrite ? (
                  <Button
                    variant="contained"
                    onClick={() => {
                      setAutosaveReady(false);
                      setIsEditing(true);
                    }}
                  >
                    Edit
                  </Button>
                ) : null}
              </>
            )}
            <Button variant="outlined" onClick={() => router.push("/workdays")}>
              Back
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? <Alert severity="error">{error}</Alert> : null}
      {saveError ? <Alert severity="error">{saveError}</Alert> : null}
      <Snackbar open={Boolean(success)} onClose={() => setSuccess(null)} autoHideDuration={900} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert severity="success" variant="filled" sx={{ boxShadow: 6 }}>
          {success}
        </Alert>
      </Snackbar>

      {loading ? (
        <CircularProgress />
      ) : !workday ? null : (
        <>
          {isEditing ? (
            <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Details
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="Date" type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField
                  label="Bonus Month"
                  type="month"
                  value={draftBonusMonth}
                  onChange={(e) => setDraftBonusMonth(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center" }}>
                  {saving ? "Saving…" : autosaveReady ? "Autosave on" : ""}
                </Typography>
              </Stack>
            </Paper>
          ) : null}

          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Attendance
            </Typography>
            <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
              <Box component="thead">
                <Box component="tr">
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                    Brother
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 120 }}>
                    Type
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 160 }}>
                    Status
                  </Box>
                  <Box component="th" sx={{ textAlign: "center", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 120 }}>
                    Coveralls
                  </Box>
                  <Box component="th" sx={{ textAlign: "center", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 120 }}>
                    Nametag
                  </Box>
                  <Box component="th" sx={{ textAlign: "left", borderBottom: "1px solid", borderColor: "divider", py: 1, width: 190 }}>
                    Makeup completed
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {draftAttendance.map((a) => {
                  const isPledge = (a.brother_status_at_workday ?? "Active") === "Pledge";
                  const coverallApplicable = !isPledge && (a.status === "Present" || a.status === "Late");
                  const makeupApplicable = a.status === "Missing" || a.status === "Excused";
                  const makeupVal = a.makeup_completed_at ? dayjs(a.makeup_completed_at).format("YYYY-MM-DD") : "";

                  return (
                    <Box component="tr" key={a.brother_id}>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      {a.first_name || a.last_name ? `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim() : `Brother #${a.brother_id}`}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      {a.brother_status_at_workday ?? "Active"}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      {isEditing ? (
                        <TextField
                          select
                          size="small"
                          value={a.status}
                          onChange={(e) =>
                            setDraftAttendance((prev) =>
                              prev.map((x) =>
                                x.brother_id === a.brother_id
                                  ? {
                                      ...x,
                                      status: e.target.value,
                                      // Clear fields when they become irrelevant
                                      coveralls:
                                        (x.brother_status_at_workday ?? "Active") !== "Pledge" &&
                                        (e.target.value === "Present" || e.target.value === "Late")
                                          ? x.coveralls ?? false
                                          : null,
                                      nametag:
                                        (x.brother_status_at_workday ?? "Active") !== "Pledge" &&
                                        (e.target.value === "Present" || e.target.value === "Late")
                                          ? x.nametag ?? false
                                          : null,
                                      makeup_completed_at: e.target.value === "Missing" || e.target.value === "Excused" ? x.makeup_completed_at ?? null : null,
                                    }
                                  : x
                              )
                            )
                          }
                          sx={{ minWidth: 140 }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <MenuItem key={s} value={s}>
                              {s}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        <Typography>{a.status}</Typography>
                      )}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "center" }}>
                      {coverallApplicable ? (
                        isEditing ? (
                          <Checkbox
                            checked={Boolean(a.coveralls)}
                            onChange={(e) =>
                              setDraftAttendance((prev) =>
                                prev.map((x) => (x.brother_id === a.brother_id ? { ...x, coveralls: e.target.checked } : x))
                              )
                            }
                          />
                        ) : (
                          <Typography>{a.coveralls ? "Yes" : "No"}</Typography>
                        )
                      ) : (
                        "—"
                      )}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1, textAlign: "center" }}>
                      {coverallApplicable ? (
                        isEditing ? (
                          <Checkbox
                            checked={Boolean(a.nametag)}
                            onChange={(e) =>
                              setDraftAttendance((prev) =>
                                prev.map((x) => (x.brother_id === a.brother_id ? { ...x, nametag: e.target.checked } : x))
                              )
                            }
                          />
                        ) : (
                          <Typography>{a.nametag ? "Yes" : "No"}</Typography>
                        )
                      ) : (
                        "—"
                      )}
                    </Box>
                    <Box component="td" sx={{ borderBottom: "1px solid", borderColor: "divider", py: 1 }}>
                      {makeupApplicable ? (
                        isEditing ? (
                          <TextField
                            type="date"
                            size="small"
                            value={makeupVal}
                            onChange={(e) =>
                              setDraftAttendance((prev) =>
                                prev.map((x) =>
                                  x.brother_id === a.brother_id ? { ...x, makeup_completed_at: e.target.value || null } : x
                                )
                              )
                            }
                            InputLabelProps={{ shrink: true }}
                            sx={{ width: 160 }}
                          />
                        ) : (
                          <Typography>{makeupVal ? dayjs(makeupVal).format("MMM D, YYYY") : "—"}</Typography>
                        )
                      ) : (
                        "—"
                      )}
                    </Box>
                  </Box>
                  );
                })}
              </Box>
            </Box>
          </Paper>
        </>
      )}

    </Stack>
  );
}


