import {useEffect, useState} from "react";
import {getAllBrothers} from "../services/brotherService";
import {Box, CircularProgress, IconButton, InputAdornment, Paper, Stack, TextField, Typography} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import {IBrother, IDuesConfig, IDuesPayment, IDuesSummaryRow} from "../interfaces/api.interface";
import {getDuesSummary, getPaymentsForBrother} from "../services/duesPaymentsService";
import AddPaymentModal from "../components/addPayment/addPayment";
import DuesTable from "../components/duesTable/duesTable";
import {getDuesConfig} from "../services/duesConfigService";
import {schoolYearLabel, schoolYearStartForDate} from "../utils/schoolYear";
import SchoolYearSelector from "../components/SchoolYearSelector";
import { isActiveInYear } from "../utils/membership";
import { matchesBrotherSearch } from "../utils/brotherSearch";
import EditPaymentDialog from "../components/editPayment/editPayment";
import ConfirmDeletePaymentDialog from "../components/confirmDeletePayment/confirmDeletePayment";
import { useAuth } from "../context/authContext";

export default function DuesPage() {
    const { can } = useAuth();
    const canWrite = can("dues.write");

    const [brothersLoading, setBrothersLoading] = useState(true);
    const [brothers, setBrothers] = useState(new Array<IBrother>);
    const [summaryLoading, setSummaryLoading] = useState(true);
    const [summary, setSummary] = useState(new Array<IDuesSummaryRow>);
    const [configLoading, setConfigLoading] = useState(true);
    const [config, setConfig] = useState<IDuesConfig | null>(null);
    const [selectedYear, setSelectedYear] = useState(schoolYearStartForDate(new Date()));
    const [paymentsByBrother, setPaymentsByBrother] = useState<Record<number, IDuesPayment[]>>({});
    const [addPaymentFor, setAddPaymentFor] = useState<{ brotherId: number, brotherName: string } | undefined>(undefined);
    const [editingPayment, setEditingPayment] = useState<{ brotherId: number, payment: IDuesPayment } | undefined>(undefined);
    const [deletingPayment, setDeletingPayment] = useState<{ brotherId: number, brotherName: string, payment: IDuesPayment } | undefined>(undefined);
    const [refreshTable, setRefreshTable] = useState(false);
    const [search, setSearch] = useState("");


    useEffect(() => {
        let cancelled = false;
        setBrothersLoading(true);
        setSummaryLoading(true);
        setConfigLoading(true);

        (async () => {
            const [allBrothers, cfg, summaryRows] = await Promise.all([
                getAllBrothers(),
                getDuesConfig(selectedYear),
                getDuesSummary(selectedYear),
            ]);

            if (cancelled) return;

            // Everyone who was in the chapter that year — not just who is Active
            // today. A brother marked alumni still owed (and likely paid) dues
            // for the years he was here, so hiding him loses that history.
            const active = allBrothers.filter(b => isActiveInYear(b, selectedYear));
            setBrothers(active);

            const activeIds = new Set(active.map(b => b.id));
            setSummary(summaryRows.filter(r => activeIds.has(r.brother_id)));

            setConfig(cfg);
        })()
            .catch(() => {
                if (cancelled) return;
                setBrothers([]);
                setSummary([]);
                setConfig(null);
            })
            .finally(() => {
                if (cancelled) return;
                setBrothersLoading(false);
                setSummaryLoading(false);
                setConfigLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [refreshTable, selectedYear]);

    function onRefreshTable() {
        setRefreshTable(!refreshTable);
        setAddPaymentFor(undefined);
        setEditingPayment(undefined);
        setDeletingPayment(undefined);
    }

    async function refreshBrotherPayments(brotherId: number, force?: boolean) {
        if (!force && paymentsByBrother[brotherId]) return;
        const payments = await getPaymentsForBrother(brotherId, selectedYear);
        setPaymentsByBrother(prev => ({...prev, [brotherId]: payments}));
    }

    async function refreshSummary() {
        const summaryRows = await getDuesSummary(selectedYear);
        const activeIds = new Set(brothers.map(b => b.id));
        setSummary(summaryRows.filter(r => activeIds.has(r.brother_id)));
    }

    async function onExpandBrother(brotherId: number) {
        await refreshBrotherPayments(brotherId, false);
    }

    const visibleBrothers = brothers.filter((b) => matchesBrotherSearch(b, search));

    return (
        <>
            {canWrite && addPaymentFor && (
                <AddPaymentModal
                    brotherId={addPaymentFor.brotherId}
                    brotherName={addPaymentFor.brotherName}
                    duesYear={selectedYear}
                    onClose={() => setAddPaymentFor(undefined)}
                    onCreated={async () => {
                        setAddPaymentFor(undefined);
                        await Promise.all([refreshBrotherPayments(addPaymentFor.brotherId, true), refreshSummary()]);
                    }}
                />
            )}

            {canWrite && editingPayment && (
                <EditPaymentDialog
                    payment={editingPayment.payment}
                    onClose={() => setEditingPayment(undefined)}
                    onUpdated={async () => {
                        setEditingPayment(undefined);
                        await Promise.all([refreshBrotherPayments(editingPayment.brotherId, true), refreshSummary()]);
                    }}
                />
            )}

            {canWrite && deletingPayment && (
                <ConfirmDeletePaymentDialog
                    brotherId={deletingPayment.brotherId}
                    brotherName={deletingPayment.brotherName}
                    payment={deletingPayment.payment}
                    onClose={() => setDeletingPayment(undefined)}
                    onDeleted={async () => {
                        setDeletingPayment(undefined);
                        await Promise.all([refreshBrotherPayments(deletingPayment.brotherId, true), refreshSummary()]);
                    }}
                />
            )}

            <Stack spacing={2}>
                <Paper elevation={0} sx={{p: 2, border: "1px solid", borderColor: "divider"}}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} justifyContent="space-between">
                        <Box>
                            <Typography variant="h5">Dues</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Track payments, balances, and who is behind for {schoolYearLabel(selectedYear)}.
                            </Typography>
                        </Box>
                        <SchoolYearSelector value={selectedYear} onChange={setSelectedYear} />
                    </Stack>
                </Paper>

                <Paper elevation={0} sx={{ p: 1, border: "1px solid", borderColor: "divider" }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <TextField
                            size="small"
                            placeholder="Search brothers…"
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
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                            {visibleBrothers.length} of {brothers.length} shown
                        </Typography>
                    </Stack>
                </Paper>

                {brothersLoading || summaryLoading || configLoading ? (
                    <CircularProgress />
                ) : (
                    <DuesTable
                        brothersData={visibleBrothers}
                        summaryData={summary}
                        paymentsByBrother={paymentsByBrother}
                        onExpandBrother={onExpandBrother}
                        canWrite={canWrite}
                        onAddPayment={(brotherId: number, brotherName: string) => canWrite && setAddPaymentFor({brotherId, brotherName})}
                        onEditPayment={(brotherId: number, payment: IDuesPayment) => canWrite && setEditingPayment({brotherId, payment})}
                        onRequestDeletePayment={(brotherId: number, brotherName: string, payment: IDuesPayment) => {
                            if (!canWrite) return;
                            setDeletingPayment({brotherId, brotherName, payment});
                        }}
                    />
                )}
            </Stack>
        </>
    )

}