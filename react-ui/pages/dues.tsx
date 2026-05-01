import {useEffect, useState} from "react";
import {getAllBrothers} from "../services/brotherService";
import {CircularProgress, Paper, Stack, Typography} from "@mui/material";
import {IBrother, IDuesConfig, IDuesPayment, IDuesSummaryRow} from "../interfaces/api.interface";
import {getDuesSummary, getPaymentsForBrother} from "../services/duesPaymentsService";
import AddPaymentModal from "../components/addPayment/addPayment";
import DuesTable from "../components/duesTable/duesTable";
import {getDuesConfig} from "../services/duesConfigService";
import {schoolYearStartForDate} from "../utils/schoolYear";
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

            // Only show Active brothers on the dues list.
            const active = allBrothers.filter(b => b.status === "Active");
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

    async function onExpandBrother(brotherId: number) {
        await refreshBrotherPayments(brotherId, false);
    }

    return (
        <>
            {canWrite && addPaymentFor && (
                <AddPaymentModal
                    brotherId={addPaymentFor.brotherId}
                    brotherName={addPaymentFor.brotherName}
                    duesYear={selectedYear}
                    onClose={() => setAddPaymentFor(undefined)}
                    onCreated={async () => {
                        await refreshBrotherPayments(addPaymentFor.brotherId, true);
                        onRefreshTable();
                    }}
                />
            )}

            {canWrite && editingPayment && (
                <EditPaymentDialog
                    payment={editingPayment.payment}
                    onClose={() => setEditingPayment(undefined)}
                    onUpdated={async () => {
                        await refreshBrotherPayments(editingPayment.brotherId, true);
                        onRefreshTable();
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
                        await refreshBrotherPayments(deletingPayment.brotherId, true);
                        onRefreshTable();
                    }}
                />
            )}

            <Stack spacing={2}>
                <Paper elevation={0} sx={{p: 2, border: "1px solid", borderColor: "divider"}}>
                    <Typography variant="h5">Dues</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Track payments, balances, and who is behind for the current school year.
                    </Typography>
                </Paper>

                {brothersLoading || summaryLoading || configLoading ? (
                    <CircularProgress />
                ) : (
                    <DuesTable
                        brothersData={brothers}
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