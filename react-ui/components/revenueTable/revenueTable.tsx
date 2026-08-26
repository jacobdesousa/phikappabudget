import {
    Box,
    Chip,
    Collapse,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import { Fragment, useState } from "react";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import { IRevenue } from "../../interfaces/api.interface";
import { formatMoney } from "../../utils/money";
import { schoolYearLabel, schoolYearStartForDate } from "../../utils/schoolYear";

interface Props {
    data: Array<IRevenue>;
    canWrite?: boolean;
    onEdit: (entry: IRevenue) => void;
    onDelete: (entry: IRevenue) => void;
}

// Matches the roster and dues tables: tight rows, page-level scrolling. Money right-aligned so the digits line up; everything
// else left, with the action column trailing right.
//
// The table is fixed-layout and every column but Description carries an
// explicit width. Auto layout sizes columns to their content, so filtering the
// rows re-measured them and the columns visibly jumped on each keystroke.
const CELL_SX = { py: 0.25, px: 1, fontSize: "0.8rem", whiteSpace: "nowrap" as const };
const HEAD_SX = { ...CELL_SX, py: 0.75, fontWeight: 700 };

function formatDate(value: string | Date | null | undefined): string {
    if (!value) return "—";
    return new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

// The streams that actually carry money on this entry. Showing all four every
// time buries the one that matters behind three zeroes.
function streamsFor(entry: IRevenue): { label: string; amount: number }[] {
    return [
        { label: "Cash", amount: Number(entry.cash_amount ?? 0) },
        { label: "Square", amount: Number(entry.square_amount ?? 0) },
        { label: "E-transfer", amount: Number(entry.etransfer_amount ?? 0) },
        { label: "Cheque", amount: Number(entry.cheque_amount ?? 0) },
    ].filter((s) => s.amount !== 0);
}

// The entry's filed school year differing from its date is legitimate but worth
// surfacing — it is the thing most likely to look like a mistake later.
function isYearOverridden(entry: IRevenue): boolean {
    if (entry.school_year === null || entry.school_year === undefined || !entry.date) return false;
    return schoolYearStartForDate(entry.date as string) !== entry.school_year;
}

export default function RevenueTable(props: Props) {
    const [open, setOpen] = useState<Record<number, boolean>>({});

    function toggleRow(id: number) {
        setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    }

    if (props.data.length === 0) {
        return (
            <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                    No revenue entries match the current search.
                </Typography>
            </Paper>
        );
    }

    function actions(entry: IRevenue) {
        if (!props.canWrite) return null;
        return (
            <>
                <IconButton size="small" sx={{ p: 0.25 }} title="Edit" onClick={() => props.onEdit(entry)} disabled={!entry.id}>
                    <EditOutlinedIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" sx={{ p: 0.25 }} color="error" title="Delete" onClick={() => props.onDelete(entry)} disabled={!entry.id}>
                    <DeleteOutlineIcon fontSize="small" />
                </IconButton>
            </>
        );
    }

    return (
        <Box sx={{ width: "100%" }}>
            {/* Mobile card layout */}
            <Stack spacing={0.75} sx={{ display: { xs: "flex", md: "none" } }}>
                {props.data.map((r) => (
                    <Paper key={r.id ?? `${r.description}-${String(r.date)}`} variant="outlined" sx={{ p: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{r.description}</Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {r.category_name ?? "Uncategorized"} · {formatDate(r.date)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {streamsFor(r).map((s) => `${s.label} $${formatMoney(s.amount)}`).join(" · ") || "No breakdown"}
                                </Typography>
                            </Box>
                            <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>${formatMoney(r.amount ?? 0)}</Typography>
                                <Stack direction="row">{actions(r)}</Stack>
                            </Stack>
                        </Stack>
                    </Paper>
                ))}
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
                <Table size="small" sx={{ minWidth: 650, tableLayout: "fixed" }} aria-label="Revenue Table">
                    <TableHead>
                        <TableRow>
                            {/* Empty header over the expand chevrons. */}
                            <TableCell sx={{ ...HEAD_SX, width: 32 }} />
                            <TableCell sx={{ ...HEAD_SX, width: 116 }}>Date</TableCell>
                            <TableCell sx={HEAD_SX}>Description</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 180 }}>Category</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 100 }} align="right">Amount</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 72 }} align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {props.data.map((r) => {
                            const rowId = r.id as number;
                            const isOpen = Boolean(open[rowId]);
                            const streams = streamsFor(r);
                            return (
                                <Fragment key={r.id ?? `${r.description}-${String(r.date)}`}>
                                    <TableRow
                                        hover
                                        sx={{ cursor: "pointer" }}
                                        onClick={() => toggleRow(rowId)}
                                    >
                                        <TableCell sx={{ ...CELL_SX, width: 32, p: 0, pl: 0.5 }}>
                                            <IconButton size="small" sx={{ p: 0.25 }} aria-label={isOpen ? "Hide breakdown" : "Show breakdown"}>
                                                {isOpen
                                                    ? <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                                                    : <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />}
                                            </IconButton>
                                        </TableCell>
                                        <TableCell sx={{ ...CELL_SX, width: 116 }}>{formatDate(r.date)}</TableCell>
                                        <TableCell sx={{ ...CELL_SX, overflow: "hidden", textOverflow: "ellipsis" }}>
                                            <span title={r.description ?? ""}>{r.description}</span>
                                        </TableCell>
                                        <TableCell sx={{ ...CELL_SX, width: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {r.category_name ?? "Uncategorized"}
                                        </TableCell>
                                        <TableCell sx={{ ...CELL_SX, width: 100, fontWeight: 600 }} align="right">
                                            ${formatMoney(r.amount ?? 0)}
                                        </TableCell>
                                        <TableCell
                                            sx={{ ...CELL_SX, width: 72 }}
                                            align="right"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {actions(r)}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ p: 0, border: 0 }} colSpan={6}>
                                            <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                                <Box sx={{ bgcolor: "action.hover", px: 2, py: 1.5 }}>
                                                    <Stack direction="row" gap={4} flexWrap="wrap" useFlexGap>
                                                        <Box sx={{ minWidth: 200 }}>
                                                            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.8, color: "text.secondary", display: "block", mb: 0.5 }}>
                                                                PAYMENT STREAMS
                                                            </Typography>
                                                            {streams.length > 0 ? (
                                                                streams.map((s) => (
                                                                    <Stack key={s.label} direction="row" justifyContent="space-between" gap={2}>
                                                                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                                                                        <Typography variant="caption">${formatMoney(s.amount)}</Typography>
                                                                    </Stack>
                                                                ))
                                                            ) : (
                                                                <Typography variant="caption" color="text.disabled">
                                                                    No stream breakdown recorded
                                                                </Typography>
                                                            )}
                                                        </Box>

                                                        <Box sx={{ minWidth: 200 }}>
                                                            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.8, color: "text.secondary", display: "block", mb: 0.5 }}>
                                                                FILING
                                                            </Typography>
                                                            <Stack direction="row" gap={1} alignItems="center">
                                                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 88 }}>
                                                                    School year
                                                                </Typography>
                                                                <Typography variant="caption">
                                                                    {r.school_year ? schoolYearLabel(r.school_year) : "—"}
                                                                </Typography>
                                                                {isYearOverridden(r) && (
                                                                    <Tooltip title="Filed under a school year that does not match this entry's date">
                                                                        <Chip label="overridden" size="small" color="warning" variant="outlined" sx={{ height: 15, fontSize: "0.6rem" }} />
                                                                    </Tooltip>
                                                                )}
                                                            </Stack>
                                                        </Box>
                                                    </Stack>
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
