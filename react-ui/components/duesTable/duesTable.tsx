import {IBrother, IDuesPayment, IDuesSummaryRow} from "../../interfaces/api.interface";
import {
    Box,
    Button,
    Chip,
    Collapse,
    Divider,
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
import {useState} from "react";
import Tooltip from "@mui/material/Tooltip";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import IconButton from "@mui/material/IconButton";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { formatMoney } from "../../utils/money";

interface Props {
    brothersData: Array<IBrother>;
    summaryData: Array<IDuesSummaryRow>;
    paymentsByBrother: Record<number, Array<IDuesPayment>>;
    onExpandBrother: (brotherId: number) => void;
    onAddPayment: (brotherId: number, brotherName: string) => void;
    onEditPayment: (brotherId: number, payment: IDuesPayment) => void;
    onRequestDeletePayment: (brotherId: number, brotherName: string, payment: IDuesPayment) => void;
    canWrite?: boolean;
}

export default function DuesTable(props: Props) {

    const [open, setOpen] = useState<Record<number, boolean>>({});

    function getDateDisplay(date?: string | Date | null): string {
        if (!date) return "";
        return new Date(date).toDateString();
    }

    function getSummaryForBrother(brotherId?: number) {
        return props.summaryData.find(row => row.brother_id === brotherId);
    }

    function getPaymentsForBrother(brotherId?: number) {
        return brotherId ? (props.paymentsByBrother[brotherId] ?? []) : [];
    }

    function isPaidInFull(brotherId?: number) {
        const s = getSummaryForBrother(brotherId);
        const owed = Number(s?.total_owed ?? 0);
        const paid = Number(s?.total_paid ?? 0);
        if (!owed) return false;
        return paid >= owed;
    }

    function toggleRow(brotherId: number) {
        const next = !open[brotherId];
        setOpen(prev => ({...prev, [brotherId]: next}));
        if (next) props.onExpandBrother(brotherId);
    }

    return (
        <Box sx={{ width: "100%" }}>
            {/* Mobile card layout */}
            <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" } }}>
                {props.brothersData.map((brother: IBrother) => {
                    const summary = getSummaryForBrother(brother.id);
                    const paidFull = isPaidInFull(brother.id);
                    const isBehind = summary?.is_behind;
                    const payments = getPaymentsForBrother(brother.id);
                    const isOpen = Boolean(open[brother.id as number]);
                    return (
                        <Paper
                            key={brother.id}
                            variant="outlined"
                            sx={{
                                p: 1.5,
                                borderColor: paidFull ? "success.main" : isBehind ? "error.main" : "divider",
                                cursor: "pointer",
                            }}
                            onClick={() => toggleRow(brother.id as number)}
                        >
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                        {brother.first_name} {brother.last_name}
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                        {paidFull ? (
                                            <Chip icon={<CheckCircleOutlineIcon />} label="Paid in full" size="small" color="success" />
                                        ) : isBehind ? (
                                            <Chip icon={<WarningAmberIcon />} label="Behind" size="small" color="error" />
                                        ) : null}
                                    </Stack>
                                </Box>
                                <Box sx={{ textAlign: "right" }}>
                                    <Typography variant="body2" color="text.secondary">Paid</Typography>
                                    <Typography variant="subtitle2">${formatMoney(summary?.total_paid ?? 0)}</Typography>
                                    <Typography variant="body2" color="text.secondary">Owed</Typography>
                                    <Typography variant="subtitle2">${formatMoney(summary?.total_owed ?? 0)}</Typography>
                                </Box>
                            </Stack>

                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                <Divider sx={{ my: 1 }} />
                                <Stack spacing={0.5}>
                                    <Stack direction="row" justifyContent="space-between">
                                        <Typography variant="body2" color="text.secondary">Due to date</Typography>
                                        <Typography variant="body2">${formatMoney(summary?.due_to_date ?? 0)}</Typography>
                                    </Stack>
                                    {summary?.last_paid_at ? (
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="body2" color="text.secondary">Last payment</Typography>
                                            <Typography variant="body2">{getDateDisplay(summary.last_paid_at)}</Typography>
                                        </Stack>
                                    ) : null}
                                </Stack>

                                {payments.length > 0 && (
                                    <Box sx={{ mt: 1 }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>PAYMENTS</Typography>
                                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                            {payments.map((p) => (
                                                <Stack key={p.id ?? `${p.brother_id}-${String(p.paid_at)}`} direction="row" justifyContent="space-between" alignItems="center">
                                                    <Box>
                                                        <Typography variant="body2">${p.amount} · {getDateDisplay(p.paid_at)}</Typography>
                                                        {p.memo ? <Typography variant="caption" color="text.secondary">{p.memo}</Typography> : null}
                                                    </Box>
                                                    {props.canWrite && p.id ? (
                                                        <Stack direction="row" onClick={(e) => e.stopPropagation()}>
                                                            <IconButton size="small" onClick={() => props.onEditPayment(brother.id as number, p)}>
                                                                <EditOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                            <IconButton size="small" color="error" onClick={() => props.onRequestDeletePayment(brother.id as number, `${brother.first_name} ${brother.last_name}`, p)}>
                                                                <DeleteOutlineIcon fontSize="small" />
                                                            </IconButton>
                                                        </Stack>
                                                    ) : null}
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </Box>
                                )}

                                {props.canWrite ? (
                                    <Box sx={{ mt: 1 }} onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<AddOutlinedIcon />}
                                            onClick={() => props.onAddPayment(brother.id as number, `${brother.first_name} ${brother.last_name}`)}
                                        >
                                            Add Payment
                                        </Button>
                                    </Box>
                                ) : null}
                            </Collapse>
                        </Paper>
                    );
                })}
            </Stack>

            {/* Desktop table layout */}
            <TableContainer component={Paper} sx={{ display: { xs: "none", md: "block" }, overflowX: "auto", width: "100%" }}>
                <Table sx={{ minWidth: 650 }} aria-label="Dues Table">
                    <TableHead>
                        <TableRow>
                            <TableCell>First Name</TableCell>
                            <TableCell align="right">Last Name</TableCell>
                            <TableCell align="right">Owed (Year)</TableCell>
                            <TableCell align="right">Due To Date</TableCell>
                            <TableCell align="right">Total Paid</TableCell>
                            <TableCell align="right">Status</TableCell>
                            <TableCell align="right">Last Payment</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {props.brothersData.map((brother: IBrother) => (
                            <>
                                <TableRow
                                    key={brother.id}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    hover
                                    onClick={() => toggleRow(brother.id as number)}
                                    style={{ cursor: "pointer",
                                        backgroundColor: isPaidInFull(brother.id)
                                            ? "rgba(46, 125, 50, 0.10)"
                                            : getSummaryForBrother(brother.id)?.is_behind
                                                ? "rgba(211, 47, 47, 0.08)"
                                                : undefined
                                    }}
                                >
                                    <TableCell component="th" scope="row">{brother.first_name}</TableCell>
                                    <TableCell align="right">{brother.last_name}</TableCell>
                                    <TableCell align="right">${formatMoney(getSummaryForBrother(brother.id)?.total_owed ?? 0)}</TableCell>
                                    <TableCell align="right">${formatMoney(getSummaryForBrother(brother.id)?.due_to_date ?? 0)}</TableCell>
                                    <TableCell align="right">${formatMoney(getSummaryForBrother(brother.id)?.total_paid ?? 0)}</TableCell>
                                    <TableCell align="right">
                                        {isPaidInFull(brother.id) ? (
                                            <Tooltip title="Paid in full"><CheckCircleOutlineIcon color="success" fontSize="small" /></Tooltip>
                                        ) : getSummaryForBrother(brother.id)?.is_behind ? (
                                            <Tooltip title="Behind on dues"><WarningAmberIcon color="error" fontSize="small" /></Tooltip>
                                        ) : ""}
                                    </TableCell>
                                    <TableCell align="right">{getDateDisplay(getSummaryForBrother(brother.id)?.last_paid_at ?? null)}</TableCell>
                                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                        {props.canWrite ? (
                                            <Button variant="outlined" startIcon={<AddOutlinedIcon />} onClick={() => props.onAddPayment(brother.id as number, `${brother.first_name} ${brother.last_name}`)}>
                                                Add Payment
                                            </Button>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                                        <Collapse in={Boolean(open[brother.id as number])} timeout="auto" unmountOnExit>
                                            <Box sx={{ margin: 2 }}>
                                                <h3>Payments</h3>
                                                <Table size="small" aria-label="payments">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>Date</TableCell>
                                                            <TableCell>Amount</TableCell>
                                                            <TableCell>Memo</TableCell>
                                                            <TableCell align="right">Actions</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {getPaymentsForBrother(brother.id).length === 0 ? (
                                                            <TableRow><TableCell colSpan={4}>No payments yet.</TableCell></TableRow>
                                                        ) : (
                                                            getPaymentsForBrother(brother.id).map((p) => (
                                                                <TableRow key={p.id ?? `${p.brother_id}-${String(p.paid_at)}-${p.amount}`}>
                                                                    <TableCell>{getDateDisplay(p.paid_at)}</TableCell>
                                                                    <TableCell>${p.amount}</TableCell>
                                                                    <TableCell>{p.memo ?? ""}</TableCell>
                                                                    <TableCell align="right">
                                                                        {props.canWrite ? (
                                                                            <>
                                                                                <Tooltip title="Edit payment">
                                                                                    <span>
                                                                                        <IconButton size="small" disabled={!p.id} onClick={() => props.onEditPayment(brother.id as number, p)}>
                                                                                            <EditOutlinedIcon fontSize="small" />
                                                                                        </IconButton>
                                                                                    </span>
                                                                                </Tooltip>
                                                                                <Tooltip title="Delete payment">
                                                                                    <span>
                                                                                        <IconButton size="small" color="error" disabled={!p.id} onClick={async () => { props.onRequestDeletePayment(brother.id as number, `${brother.first_name} ${brother.last_name}`, p); }}>
                                                                                            <DeleteOutlineIcon fontSize="small" />
                                                                                        </IconButton>
                                                                                    </span>
                                                                                </Tooltip>
                                                                            </>
                                                                        ) : null}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </Box>
                                        </Collapse>
                                    </TableCell>
                                </TableRow>
                            </>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
