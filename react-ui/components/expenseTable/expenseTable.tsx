import {
    Box,
    Collapse,
    IconButton,
    Link,
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
import { Fragment, memo, useState } from "react";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { IExpense } from "../../interfaces/api.interface";
import { formatMoney } from "../../utils/money";

interface Props {
    data: Array<IExpense>;
    canWrite?: boolean;
    onEdit: (entry: IExpense) => void;
    onDelete: (entry: IExpense) => void;
    onOpenReceipt: (entry: IExpense) => void;
}

// Matches the roster, dues and revenue tables: tight rows, page-level
// scrolling, fixed layout with explicit widths so filtering doesn't re-measure
// the columns and make them jump. Description is the one flexible column.
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

export function reimburseName(e: IExpense): string {
    if (e.reimburse_first_name && e.reimburse_last_name) {
        return `${e.reimburse_first_name} ${e.reimburse_last_name}`;
    }
    return e.reimburse_brother_id ? `Brother #${e.reimburse_brother_id}` : "—";
}

function ExpenseTable(props: Props) {
    const [open, setOpen] = useState<Record<number, boolean>>({});

    function toggleRow(id: number) {
        setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    }

    if (props.data.length === 0) {
        return (
            <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                    No expenses match the current search and filters.
                </Typography>
            </Paper>
        );
    }

    function actions(entry: IExpense) {
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
                {props.data.map((e) => (
                    <Paper key={e.id ?? `${e.description}-${String(e.date)}`} variant="outlined" sx={{ p: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{e.description}</Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    {e.category_name ?? "Uncategorized"} · {formatDate(e.date)}
                                    {e.cheque_number ? ` · Cheque ${e.cheque_number}` : ""}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">
                                    Reimburse: {reimburseName(e)}
                                </Typography>
                            </Box>
                            <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>${formatMoney(e.amount ?? 0)}</Typography>
                                <Stack direction="row">{actions(e)}</Stack>
                            </Stack>
                        </Stack>
                    </Paper>
                ))}
            </Stack>

            {/* Desktop table layout */}
            <TableContainer
                component={Paper}
                sx={{ display: { xs: "none", md: "block" }, overflowX: "auto", width: "100%" }}
            >
                <Table size="small" sx={{ minWidth: 900, tableLayout: "fixed" }} aria-label="Expenses Table">
                    <TableHead>
                        <TableRow>
                            {/* Empty header over the expand chevrons. */}
                            <TableCell sx={{ ...HEAD_SX, width: 32 }} />
                            <TableCell sx={{ ...HEAD_SX, width: 116 }}>Date</TableCell>
                            <TableCell sx={HEAD_SX}>Description</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 160 }}>Category</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 150 }}>Reimburse</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 90 }}>Cheque</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 100 }} align="right">Amount</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 72 }} align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {props.data.map((e) => {
                            const rowId = e.id as number;
                            const isOpen = Boolean(open[rowId]);
                            return (
                                <Fragment key={e.id ?? `${e.description}-${String(e.date)}`}>
                                    <TableRow hover sx={{ cursor: "pointer" }} onClick={() => toggleRow(rowId)}>
                                        <TableCell sx={{ ...CELL_SX, width: 32, p: 0, pl: 0.5 }}>
                                            <IconButton size="small" sx={{ p: 0.25 }} aria-label={isOpen ? "Hide detail" : "Show detail"}>
                                                {isOpen
                                                    ? <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                                                    : <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />}
                                            </IconButton>
                                        </TableCell>
                                        <TableCell sx={{ ...CELL_SX, width: 116 }}>{formatDate(e.date)}</TableCell>
                                        <TableCell sx={{ ...CELL_SX, overflow: "hidden", textOverflow: "ellipsis" }}>
                                            <Stack direction="row" alignItems="center" gap={0.5}>
                                                {/* A receipt is the thing most often looked for, so it
                                                    gets a marker on the row rather than only in the drawer. */}
                                                {e.receipt_url && (
                                                    <ReceiptLongOutlinedIcon
                                                        titleAccess="Receipt attached"
                                                        sx={{ fontSize: 14, color: "text.disabled", flexShrink: 0 }}
                                                    />
                                                )}
                                                <span title={e.description ?? ""} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {e.description}
                                                </span>
                                            </Stack>
                                        </TableCell>
                                        <TableCell sx={{ ...CELL_SX, width: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {e.category_name ?? "Uncategorized"}
                                        </TableCell>
                                        <TableCell sx={{ ...CELL_SX, width: 150, overflow: "hidden", textOverflow: "ellipsis" }}>
                                            {reimburseName(e)}
                                        </TableCell>
                                        <TableCell sx={{ ...CELL_SX, width: 90 }}>{e.cheque_number || "—"}</TableCell>
                                        <TableCell sx={{ ...CELL_SX, width: 100, fontWeight: 600 }} align="right">
                                            ${formatMoney(e.amount ?? 0)}
                                        </TableCell>
                                        <TableCell sx={{ ...CELL_SX, width: 72 }} align="right" onClick={(ev) => ev.stopPropagation()}>
                                            {actions(e)}
                                        </TableCell>
                                    </TableRow>
                                    {isOpen && (
                                    <TableRow>
                                        <TableCell sx={{ p: 0, border: 0 }} colSpan={8}>
                                            <Collapse in appear timeout="auto" unmountOnExit>
                                                <Box sx={{ bgcolor: "action.hover", px: 2, py: 1.5 }} onClick={(ev) => ev.stopPropagation()}>
                                                    <Stack direction="row" gap={4} flexWrap="wrap" useFlexGap>
                                                        <Box sx={{ minWidth: 220 }}>
                                                            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.8, color: "text.secondary", display: "block", mb: 0.5 }}>
                                                                DETAIL
                                                            </Typography>
                                                            <Stack direction="row" gap={1}>
                                                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 96 }}>Status</Typography>
                                                                <Typography variant="caption">{e.status ?? "—"}</Typography>
                                                            </Stack>
                                                            <Stack direction="row" gap={1}>
                                                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 96 }}>Reimburse</Typography>
                                                                <Typography variant="caption">{reimburseName(e)}</Typography>
                                                            </Stack>
                                                            <Stack direction="row" gap={1}>
                                                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 96 }}>Cheque</Typography>
                                                                <Typography variant="caption">{e.cheque_number || "Not disbursed"}</Typography>
                                                            </Stack>
                                                            {e.submitted_by_name ? (
                                                                <Stack direction="row" gap={1}>
                                                                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 96 }}>Submitted by</Typography>
                                                                    <Typography variant="caption">{e.submitted_by_name}</Typography>
                                                                </Stack>
                                                            ) : null}
                                                        </Box>

                                                        <Box sx={{ minWidth: 200 }}>
                                                            <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.8, color: "text.secondary", display: "block", mb: 0.5 }}>
                                                                RECEIPT
                                                            </Typography>
                                                            {e.receipt_url ? (
                                                                <Link
                                                                    component="button"
                                                                    variant="caption"
                                                                    onClick={() => props.onOpenReceipt(e)}
                                                                    sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                                                                >
                                                                    <ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />
                                                                    Open receipt
                                                                </Link>
                                                            ) : (
                                                                <Typography variant="caption" color="text.disabled">No receipt attached</Typography>
                                                            )}
                                                        </Box>
                                                    </Stack>
                                                </Box>
                                            </Collapse>
                                        </TableCell>
                                    </TableRow>
                                    )}
                                </Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}

export default memo(ExpenseTable);
