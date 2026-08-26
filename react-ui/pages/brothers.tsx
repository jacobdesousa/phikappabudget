import BrotherTableComponent from "../components/brotherTable/brotherTable";
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import {useEffect, useState} from "react";
import AddBrotherModalComponent from "../components/addBrother/addBrother";
import {getAllBrothers} from "../services/brotherService";
import {IBrother} from "../interfaces/api.interface";
import {Chip, CircularProgress, InputAdornment, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import IconButton from "@mui/material/IconButton";
import EditBrotherModalComponent from "../components/editBrother/editBrother";
import GraduateBrotherModalComponent from "../components/graduateBrother/graduateBrother";
import ImportBrothersDialog from "../components/importBrothers/importBrothers";
import { useAuth } from "../context/authContext";
import { matchesBrotherSearch } from "../utils/brotherSearch";
import { BROTHER_GROUPS, BrotherGroup, countByGroup, groupForBrother } from "../utils/brotherGroups";

export default function BrothersPage() {
    const { can } = useAuth();
    const canWrite = can("brothers.write");
    const canImport = can("admin.users");

    const [addModal, setAddModal] = useState(false);
    const [importModal, setImportModal] = useState(false);
    const [editingBrother, setEditingBrother] = useState(undefined);
    const [graduatingBrother, setGraduatingBrother] = useState(undefined);
    const [loading, setLoading] = useState(true);
    const [brothers, setBrothers] = useState(new Array<IBrother>);
    const [refreshTable, setRefreshTable] = useState(false);
    const [search, setSearch] = useState("");
    // Actives only to start — the roster is mostly alumni, and the day-to-day
    // question is about the current chapter.
    const [groups, setGroups] = useState<BrotherGroup[]>(["active"]);

    useEffect(() => {
        setLoading(true);
        getAllBrothers()
            .then(response => {
                let temp: Array<IBrother> = [];
                response.forEach(row => temp.push(row));
                setBrothers(temp);
            })
            .finally(() => setLoading(false));
    }, [refreshTable]);

    function onRefreshTable() {
        setRefreshTable(!refreshTable);
        setAddModal(false);
        setEditingBrother(undefined);
        setGraduatingBrother(undefined);
    }


    const counts = countByGroup(brothers);

    // Group filter first, then the text search — so the counts on the toggles
    // keep describing the whole roster rather than the current search.
    const visibleBrothers = brothers
        .filter((b) => groups.includes(groupForBrother(b)))
        .filter((b) => matchesBrotherSearch(b, search));

    return (
        <>
            {canWrite && addModal && <AddBrotherModalComponent onClose={() => onRefreshTable()}></AddBrotherModalComponent>}
            {canWrite && editingBrother && <EditBrotherModalComponent newBrother={editingBrother} onClose={() => onRefreshTable()}></EditBrotherModalComponent>}
            {canWrite && graduatingBrother && <GraduateBrotherModalComponent graduatingBrother={graduatingBrother} onClose={() => onRefreshTable()}></GraduateBrotherModalComponent>}
            {canImport && importModal && <ImportBrothersDialog onClose={(imported) => { setImportModal(false); if (imported) onRefreshTable(); }} />}

            <Stack spacing={2} sx={{pointerEvents: addModal || editingBrother || graduatingBrother || importModal ? "none" : "auto"}}>
                <Paper elevation={0} sx={{p: 2, border: "1px solid", borderColor: "divider"}}>
                    <Stack direction={{xs: "column", sm: "row"}} spacing={2} alignItems={{sm: "center"}} justifyContent="space-between">
                        <div>
                            <Typography variant="h5">Brothers</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Manage roster, contact info, and status.
                            </Typography>
                        </div>
                        <Stack direction="row" spacing={1} alignItems="center">
                        {canImport && (
                          <Button variant="outlined" onClick={() => { setImportModal(true); }}>
                              Import CSV
                          </Button>
                        )}
                        {canWrite ? (
                          <Button variant="contained" onClick={() => { setAddModal(true); }}>
                              <AddIcon /> Add Brother
                          </Button>
                        ) : null}
                        </Stack>
                    </Stack>
                </Paper>

                {/* Search + roster filters. Kept in their own bar so the table
                    below can start as high on the page as possible. */}
                <Paper elevation={0} sx={{ p: 1, border: "1px solid", borderColor: "divider" }}>
                    <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1}
                        alignItems={{ md: "center" }}
                        justifyContent="space-between"
                    >
                        <TextField
                            size="small"
                            placeholder="Search name, email, phone, pledge class…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            sx={{ minWidth: { md: 340 }, flex: { md: "0 1 420px" } }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: search ? (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setSearch("")} aria-label="clear search">
                                            <ClearIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            }}
                        />

                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <ToggleButtonGroup
                                size="small"
                                value={groups}
                                onChange={(_, next: BrotherGroup[]) => {
                                    // Never leave every group off: an empty roster
                                    // reads as a bug rather than a filter.
                                    if (next.length > 0) setGroups(next);
                                }}
                                aria-label="Roster filters"
                            >
                                {BROTHER_GROUPS.map((g) => (
                                    <ToggleButton
                                        key={g.key}
                                        value={g.key}
                                        sx={{ py: 0.25, px: 1, textTransform: "none", fontSize: "0.75rem" }}
                                    >
                                        {g.label}
                                        <Chip
                                            label={counts[g.key]}
                                            size="small"
                                            sx={{ ml: 0.5, height: 16, fontSize: "0.62rem", pointerEvents: "none" }}
                                        />
                                    </ToggleButton>
                                ))}
                            </ToggleButtonGroup>

                            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                                {visibleBrothers.length} shown
                            </Typography>
                        </Stack>
                    </Stack>
                </Paper>

                {loading ? (
                    <CircularProgress />
                ) : (
                    <BrotherTableComponent
                      canWrite={canWrite}
                      setGraduatingBrother={setGraduatingBrother}
                      setEditingBrother={setEditingBrother}
                      data={visibleBrothers}
                    ></BrotherTableComponent>
                )}
            </Stack>
        </>
    )
}