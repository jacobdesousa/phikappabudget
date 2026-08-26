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
import {Fragment, useState} from "react";
import Tooltip from "@mui/material/Tooltip";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import IconButton from "@mui/material/IconButton";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
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

// Tight rows so more of the roster fits on screen; the page scrolls as one
// rather than the table owning its own scrollbar. Fixed layout with explicit widths — auto
// layout re-measures columns against the visible rows, so filtering made them
// jump on every keystroke. Money is right-aligned so the digits line
// up down the column — the one place in these tables where that earns its keep.
const CELL_SX = { py: 0.25, px: 1, fontSize: "0.8rem", whiteSpace: "nowrap" as const };
const HEAD_SX = { ...CELL_SX, py: 0.75, fontWeight: 700 };

export default function DuesTable(props: Props) {

    const [open, setOpen] = useState<Record<number, boolean>>({});

    // "Mon Aug 18 2026" varies in width row to row and the weekday carries no
    // information here, so the column reads ragged. "Aug 18, 2026" is steadier.
    function getDateDisplay(date?: string | Date | null): string {
        if (!date) return "";
        return new Date(date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
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

    // Paid everything due so far, but the year isn't fully paid yet. Previously
    // this rendered as an empty cell, which reads as missing data rather than
    // "nothing to worry about". Only claimed when there is a plan to be on
    // track against — owed of 0 means no dues plan, not a clean slate.
    function isOnTrack(brotherId?: number) {
        const s = getSummaryForBrother(brotherId);
        if (!s) return false;
        if (Number(s.total_owed ?? 0) <= 0) return false;
        return !isPaidInFull(brotherId) && !s.is_behind;
    }

    function toggleRow(brotherId: number) {
        const next = !open[brotherId];
        setOpen(prev => ({...prev, [brotherId]: next}));
        if (next) props.onExpandBrother(brotherId);
    }

    if (props.brothersData.length === 0) {
        return (
            <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                    No brothers match the current search.
                </Typography>
            </Paper>
        );
    }

    return (
        <Box sx={{ width: "100%" }}>
            {/* Mobile card layout */}
            <Stack spacing={0.75} sx={{ display: { xs: "flex", md: "none" } }}>
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
                                p: 1,
                                borderColor: paidFull ? "success.main" : isBehind ? "error.main" : "divider",
                                cursor: "pointer",
                            }}
                            onClick={() => toggleRow(brother.id as number)}
                        >
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
                                    {isOpen
                                        ? <KeyboardArrowDownIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                                        : <KeyboardArrowRightIcon sx={{ fontSize: 16, color: "text.secondary" }} />}
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            {brother.first_name} {brother.last_name}
                                        </Typography>
                                        {paidFull ? (
                                            <Chip icon={<CheckCircleOutlineIcon />} label="Paid in full" size="small" color="success" sx={{ height: 18, fontSize: "0.65rem", mt: 0.25 }} />
                                        ) : isBehind ? (
                                            <Chip icon={<WarningAmberIcon />} label="Behind" size="small" color="error" sx={{ height: 18, fontSize: "0.65rem", mt: 0.25 }} />
                                        ) : isOnTrack(brother.id) ? (
                                            <Chip icon={<ScheduleOutlinedIcon />} label="On track" size="small" color="info" variant="outlined" sx={{ height: 18, fontSize: "0.65rem", mt: 0.25 }} />
                                        ) : null}
                                    </Box>
                                </Stack>
                                <Box sx={{ textAlign: "right" }}>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Paid ${formatMoney(summary?.total_paid ?? 0)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block">
                                        Owed ${formatMoney(summary?.total_owed ?? 0)}
                                    </Typography>
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
            <TableContainer
                component={Paper}
                sx={{
                    display: { xs: "none", md: "block" },
                    overflowX: "auto",
                    width: "100%",
                }}
            >
                <Table size="small" sx={{ minWidth: 650, tableLayout: "fixed" }} aria-label="Dues Table">
                    <TableHead>
                        <TableRow>
                            {/* Empty header over the expand chevrons. */}
                            <TableCell sx={{ ...HEAD_SX, width: 32 }} />
                            <TableCell sx={HEAD_SX}>Name</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 104 }} align="right">Owed (Year)</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 112 }} align="right">Due To Date</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 104 }} align="right">Total Paid</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 56 }} align="center">Status</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 116 }}>Last Payment</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 56 }} align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {props.brothersData.map((brother: IBrother) => {
                            const isOpen = Boolean(open[brother.id as number]);
                            const summary = getSummaryForBrother(brother.id);
                            const paidFull = isPaidInFull(brother.id);
                            return (
                            <Fragment key={brother.id}>
                                <TableRow
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    hover
                                    onClick={() => toggleRow(brother.id as number)}
                                    style={{ cursor: "pointer",
                                        backgroundColor: paidFull
                                            ? "rgba(46, 125, 50, 0.10)"
                                            : summary?.is_behind
                                                ? "rgba(211, 47, 47, 0.08)"
                                                : undefined
                                    }}
                                >
                                    {/* A real chevron, not just a pointer cursor: without it
                                        nothing on the row says the payments are one click away. */}
                                    <TableCell sx={{ ...CELL_SX, width: 32, p: 0, pl: 0.5 }}>
                                        <IconButton size="small" sx={{ p: 0.25 }} aria-label={isOpen ? "Hide payments" : "Show payments"}>
                                            {isOpen
                                                ? <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                                                : <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />}
                                        </IconButton>
                                    </TableCell>
                                    <TableCell sx={{ ...CELL_SX, overflow: "hidden", textOverflow: "ellipsis" }} component="th" scope="row">
                                        {brother.first_name} {brother.last_name}
                                    </TableCell>
                                    <TableCell sx={{ ...CELL_SX, width: 104 }} align="right">${formatMoney(summary?.total_owed ?? 0)}</TableCell>
                                    <TableCell sx={{ ...CELL_SX, width: 112 }} align="right">${formatMoney(summary?.due_to_date ?? 0)}</TableCell>
                                    <TableCell sx={{ ...CELL_SX, width: 104 }} align="right">${formatMoney(summary?.total_paid ?? 0)}</TableCell>
                                    <TableCell sx={{ ...CELL_SX, width: 56 }} align="center">
                                        {paidFull ? (
                                            <CheckCircleOutlineIcon titleAccess="Paid in full" color="success" sx={{ fontSize: 16, verticalAlign: "middle" }} />
                                        ) : summary?.is_behind ? (
                                            <WarningAmberIcon titleAccess="Behind on dues" color="error" sx={{ fontSize: 16, verticalAlign: "middle" }} />
                                        ) : isOnTrack(brother.id) ? (
                                            <ScheduleOutlinedIcon titleAccess="On track — paid everything due so far" color="info" sx={{ fontSize: 16, verticalAlign: "middle" }} />
                                        ) : ""}
                                    </TableCell>
                                    <TableCell sx={{ ...CELL_SX, width: 116 }}>
                                        {getDateDisplay(summary?.last_paid_at ?? null) || "—"}
                                    </TableCell>
                                    <TableCell sx={{ ...CELL_SX, width: 56 }} align="right" onClick={(e) => e.stopPropagation()}>
                                        {props.canWrite ? (
                                            <IconButton
                                                size="small"
                                                sx={{ p: 0.25 }}
                                                title="Add payment"
                                                onClick={() => props.onAddPayment(brother.id as number, `${brother.first_name} ${brother.last_name}`)}
                                            >
                                                <AddOutlinedIcon fontSize="small" />
                                            </IconButton>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell sx={{ p: 0, border: 0 }} colSpan={8}>
                                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                            <Box sx={{ mx: 2, my: 1 }}>
                                                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1, color: "text.secondary" }}>
                                                    PAYMENTS
                                                </Typography>
                                                <Table size="small" aria-label="payments">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell sx={HEAD_SX}>Date</TableCell>
                                                            <TableCell sx={HEAD_SX} align="right">Amount</TableCell>
                                                            <TableCell sx={HEAD_SX}>Memo</TableCell>
                                                            <TableCell sx={{ ...HEAD_SX, width: 84 }} align="right">Actions</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {getPaymentsForBrother(brother.id).length === 0 ? (
                                                            <TableRow>
                                                                <TableCell sx={{ ...CELL_SX, color: "text.secondary" }} colSpan={4}>No payments yet.</TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            getPaymentsForBrother(brother.id).map((p) => (
                                                                <TableRow key={p.id ?? `${p.brother_id}-${String(p.paid_at)}-${p.amount}`}>
                                                                    <TableCell sx={CELL_SX}>{getDateDisplay(p.paid_at)}</TableCell>
                                                                    <TableCell sx={CELL_SX} align="right">${p.amount}</TableCell>
                                                                    <TableCell sx={CELL_SX}>{p.memo ?? ""}</TableCell>
                                                                    <TableCell sx={{ ...CELL_SX, width: 84 }} align="right">
                                                                        {props.canWrite ? (
                                                                            <>
                                                                                <Tooltip title="Edit payment">
                                                                                    <span>
                                                                                        <IconButton size="small" sx={{ p: 0.25 }} disabled={!p.id} onClick={() => props.onEditPayment(brother.id as number, p)}>
                                                                                            <EditOutlinedIcon fontSize="small" />
                                                                                        </IconButton>
                                                                                    </span>
                                                                                </Tooltip>
                                                                                <Tooltip title="Delete payment">
                                                                                    <span>
                                                                                        <IconButton size="small" sx={{ p: 0.25 }} color="error" disabled={!p.id} onClick={async () => { props.onRequestDeletePayment(brother.id as number, `${brother.first_name} ${brother.last_name}`, p); }}>
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
                            </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
