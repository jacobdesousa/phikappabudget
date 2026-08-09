import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import { useAuth } from "../context/authContext";
import { getAllBrothers } from "../services/brotherService";
import { deleteAssignment, getHouseRoster } from "../services/houseService";
import {
  HouseSessionType,
  IBrother,
  IHouseAssignment,
  IHouseRoster,
  IHouseRosterRoom,
} from "../interfaces/api.interface";
import SchoolYearSelector from "../components/SchoolYearSelector";
import HouseSessionSelector from "../components/HouseSessionSelector";
import AssignResidentDialog from "../components/houseAssignment/assignResidentDialog";
import { schoolYearStartForDate } from "../utils/schoolYear";
import {
  roomTypeLabel,
  sessionLabel,
  tintSx,
  tintSwatchSx,
  SUBTLE_CHIP_SX,
  TintColor,
} from "../utils/house";

const CELL_SX = { py: 0.75 };
const HEAD_SX = { py: 1, fontWeight: 700, whiteSpace: "nowrap" as const };

function occupancyLabel(a: IHouseAssignment): string | null {
  return a.occupancy === "full_room" ? "Buy-out" : null;
}

// Row shading by who is in the bed. Alumni and other statuses stay untinted so
// the three cases that matter actually stand out.
type RowTint = "vacant" | "member" | "boarder" | null;

function tintFor(brotherStatus: string | null | undefined): RowTint {
  if (brotherStatus === "Boarder") return "boarder";
  if (brotherStatus === "Active") return "member";
  return null;
}

const TINT_PALETTE: Record<Exclude<RowTint, null>, TintColor> = {
  vacant: "success",
  member: "warning",
  boarder: "info",
};

function dateRange(a: IHouseAssignment): string {
  return `${a.start_date ?? "?"} → ${a.end_date ?? "?"}`;
}

export default function HousePage() {
  const { can } = useAuth();
  const canWrite = can("house.write");

  const [year, setYear] = useState(schoolYearStartForDate(new Date()));
  const [session, setSession] = useState<HouseSessionType>("winter");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roster, setRoster] = useState<IHouseRoster | null>(null);
  const [brothers, setBrothers] = useState<IBrother[]>([]);

  const [assigning, setAssigning] = useState<
    { room: IHouseRosterRoom; bed: number; existing?: IHouseAssignment } | undefined
  >(undefined);
  const [deleting, setDeleting] = useState<IHouseAssignment | undefined>(undefined);

  // Room, fees, dates and discounts all come from the system; everything the
  // system doesn't hold prints as blank space for the resident to fill in.
  function printAgreement(brotherId: number) {
    const qs = new URLSearchParams({ year: String(year), session, autoprint: "1" });
    qs.set("brother", String(brotherId));
    window.open(`/house/agreement?${qs.toString()}`, "_blank");
  }
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rosterData, allBrothers] = await Promise.all([
        getHouseRoster(year, session),
        getAllBrothers(),
      ]);
      setRoster(rosterData);
      // Anyone on the roster can live in the house, boarders included.
      setBrothers(allBrothers);
    } catch (e: any) {
      setRoster(null);
      setError(e?.message ?? "Could not load the house roster.");
    } finally {
      setLoading(false);
    }
  }, [year, session]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await deleteAssignment(deleting.id);
      setDeleting(undefined);
      await load();
    } catch (e: any) {
      setDeleteError(e?.message ?? "Could not remove the assignment.");
    }
  }

  const notConfigured = !loading && roster && !roster.session;

  return (
    <>
      {canWrite && assigning && roster && (
        <AssignResidentDialog
          year={year}
          session={session}
          sessionConfig={roster.session}
          room={assigning.room}
          bed={assigning.bed}
          brothers={brothers}
          existing={assigning.existing}
          onClose={() => setAssigning(undefined)}
          onSaved={async () => {
            setAssigning(undefined);
            await load();
          }}
        />
      )}

      {canWrite && deleting && (
        <Dialog open onClose={() => setDeleting(undefined)} fullWidth maxWidth="xs">
          <DialogTitle>Remove assignment</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {deleteError && <Alert severity="error">{deleteError}</Alert>}
              <Typography variant="body2">
                Remove {deleting.first_name} {deleting.last_name} from {deleting.room_code}? Payments already
                recorded for this resident are kept.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button variant="outlined" onClick={() => setDeleting(undefined)}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDelete}>Remove</Button>
          </DialogActions>
        </Dialog>
      )}

      <Stack spacing={2}>
        <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
          >
            <Box>
              <Typography variant="h5">House Residents</Typography>
              <Typography variant="body2" color="text.secondary">
                {sessionLabel(year, session)}
                {roster?.session ? ` · ${roster.session.start_date} – ${roster.session.end_date}` : ""}
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <HouseSessionSelector value={session} onChange={setSession} />
              <SchoolYearSelector value={year} onChange={setYear} />
            </Stack>
          </Stack>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

        {!loading && roster?.session && (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ px: 0.5 }}>
            {([
              ["vacant", "Vacant"],
              ["member", "Member"],
              ["boarder", "Boarder"],
            ] as const).map(([tint, label]) => (
              <Stack key={tint} direction="row" spacing={0.75} alignItems="center">
                <Box sx={tintSwatchSx(TINT_PALETTE[tint])} />
                <Typography variant="caption" color="text.secondary">{label}</Typography>
              </Stack>
            ))}
          </Stack>
        )}

        {notConfigured && (
          <Alert severity="info">
            No {session} session is configured for {sessionLabel(year, session)}. Set the rooms, rates, and instalment
            dates on the House Config page first.
          </Alert>
        )}

        {loading ? (
          <CircularProgress />
        ) : (
          roster &&
          roster.session && (
            <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider" }}>
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={HEAD_SX}>Room</TableCell>
                      <TableCell sx={HEAD_SX}>Type</TableCell>
                      <TableCell sx={HEAD_SX}>Resident</TableCell>
                      <TableCell sx={HEAD_SX}>Contact</TableCell>
                      <TableCell sx={HEAD_SX}>Dates</TableCell>
                      <TableCell sx={HEAD_SX} align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {roster.rooms.map((room) =>
                      room.beds.map((bedEntry) => {
                        // A buy-out fills every bed; only draw it once.
                        const isDuplicateBuyout =
                          bedEntry.bed > 1 && bedEntry.assignments.every((a) => a.occupancy === "full_room");
                        if (isDuplicateBuyout && bedEntry.assignments.length > 0) return null;

                        const key = `${room.id}-${bedEntry.bed}`;
                        if (bedEntry.assignments.length === 0) {
                          return (
                            <TableRow key={key} hover sx={tintSx(TINT_PALETTE.vacant)}>
                              <TableCell sx={CELL_SX}>
                                {room.room_code}
                                {room.capacity > 1 ? ` · ${bedEntry.bed}` : ""}
                              </TableCell>
                              <TableCell sx={CELL_SX}>{roomTypeLabel(room.capacity)}</TableCell>
                              <TableCell sx={CELL_SX} colSpan={3}>
                                <Typography variant="body2" color="text.secondary">Vacant</Typography>
                              </TableCell>
                              <TableCell sx={CELL_SX} align="right">
                                {canWrite && (
                                  <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => setAssigning({ room, bed: bedEntry.bed })}
                                  >
                                    Assign
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return bedEntry.assignments.map((a) => (
                          <TableRow key={`${key}-${a.id}`} hover sx={tintSx(((): TintColor | null => {
                            const t = tintFor(a.brother_status);
                            return t ? TINT_PALETTE[t] : null;
                          })())}>
                            <TableCell sx={CELL_SX}>
                              {room.room_code}
                              {room.capacity > 1 && a.occupancy !== "full_room" ? ` · ${a.bed}` : ""}
                            </TableCell>
                            <TableCell sx={CELL_SX}>
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <span>{roomTypeLabel(room.capacity)}</span>
                                {occupancyLabel(a) && (
                                  <Chip
                                    label={occupancyLabel(a)}
                                    size="small"
                                    variant="outlined"
                                    sx={SUBTLE_CHIP_SX}
                                  />
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell sx={CELL_SX}>
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <span>
                                  {a.first_name} {a.last_name}
                                </span>
                                {a.brother_status === "Boarder" && (
                                  <Chip
                                    label="Boarder"
                                    size="small"
                                    variant="outlined"
                                    sx={SUBTLE_CHIP_SX}
                                  />
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell sx={CELL_SX}>
                              <Typography variant="caption" display="block">{a.email ?? "—"}</Typography>
                              <Typography variant="caption" color="text.secondary">{a.phone ?? "—"}</Typography>
                            </TableCell>
                            <TableCell sx={CELL_SX}>
                              <Typography variant="caption">{dateRange(a)}</Typography>
                              {a.amount_override != null && (
                                <Typography variant="caption" display="block" color="warning.main">
                                  Override: {a.override_note || "manual amount"}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell sx={CELL_SX} align="right">
                              {canWrite && (
                                <>
                                  <IconButton
                                    size="small"
                                    title="Print agreement"
                                    onClick={() => printAgreement(a.brother_id)}
                                  >
                                    <DescriptionOutlinedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    onClick={() => setAssigning({ room, bed: a.bed, existing: a })}
                                  >
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" color="error" onClick={() => setDeleting(a)}>
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        ));
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )
        )}
      </Stack>
    </>
  );
}
