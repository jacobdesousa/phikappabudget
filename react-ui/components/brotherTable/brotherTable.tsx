import { Box, Chip, Collapse, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import { Fragment, useState } from "react";
import EditIcon from '@mui/icons-material/Edit';
import SchoolIcon from '@mui/icons-material/School';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import {IBrother, IBrotherOffice} from "../../interfaces/api.interface";
import { formatPhoneForDisplay } from "../../utils/phone";

interface Props {
    data: Array<IBrother>;
    setEditingBrother: any;
    setGraduatingBrother: any;
    canWrite?: boolean;
}

// Tight rows so as much of the roster as possible fits on screen. The page
// scrolls as one — the table has no scroll container of its own, since nesting
// a second scroller made the wheel act on whichever region the pointer was over.
//
// Every data column is left-aligned: they all hold text or fixed-width years,
// none a quantity worth lining up by digit. Only the trailing action column is
// right-aligned, so the icons stay in one place across every row.
//
// Fixed layout with explicit widths — auto layout re-measures columns against
// the visible rows, so searching made them jump on every keystroke. Email is
// left unsized so it absorbs whatever space is left over.
const CELL_SX = { py: 0.25, px: 1, fontSize: "0.8rem", whiteSpace: "nowrap" as const };
const HEAD_SX = { ...CELL_SX, py: 0.75, fontWeight: 700 };

// Everything held about a brother that the row itself has no room for. Grouped
// rather than listed flat: an address is one fact in five columns, and office
// history is a list, so a single label/value column read badly.

function formatTerm(office: IBrotherOffice): string {
    const start = office.start_date ? office.start_date.slice(0, 10) : "?";
    const end = office.end_date ? office.end_date.slice(0, 10) : "present";
    return `${start} → ${end}`;
}

function isCurrentTerm(office: IBrotherOffice): boolean {
    const today = new Date().toISOString().slice(0, 10);
    const started = !office.start_date || office.start_date.slice(0, 10) <= today;
    const ended = office.end_date ? office.end_date.slice(0, 10) < today : false;
    return started && !ended;
}

function addressLines(row: IBrother): string[] {
    return [
        row.address_line1,
        row.address_line2,
        [row.city, row.province, row.postal_code].filter(Boolean).join(", "),
        row.country,
    ]
        .map((part) => (part ? String(part).trim() : ""))
        .filter(Boolean);
}

// Whether there is anything at all behind the row — drives the chevron, so a
// brother with no extra detail gets no affordance promising an empty drawer.
function hasDetail(row: IBrother): boolean {
    return (
        addressLines(row).length > 0 ||
        Boolean(row.email_secondary) ||
        Boolean(row.alumni_date) ||
        (row.office_history ?? []).length > 0
    );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <Stack direction="row" gap={1} sx={{ py: "1px" }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 96, flexShrink: 0 }}>
                {label}
            </Typography>
            <Typography variant="caption" sx={{ whiteSpace: "normal" }}>{children}</Typography>
        </Stack>
    );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <Box sx={{ minWidth: 220 }}>
            <Typography
                variant="caption"
                sx={{ fontWeight: 700, letterSpacing: 0.8, color: "text.secondary", display: "block", mb: 0.5 }}
            >
                {title}
            </Typography>
            {children}
        </Box>
    );
}

function BrotherDetail({ row }: { row: IBrother }) {
    const address = addressLines(row);
    const history = row.office_history ?? [];

    return (
        <Stack direction="row" gap={4} flexWrap="wrap" useFlexGap sx={{ px: 2, py: 1.5 }}>
            <DetailSection title="CONTACT">
                <DetailField label="Email">{row.email || "—"}</DetailField>
                <DetailField label="Second email">{row.email_secondary || "—"}</DetailField>
                <DetailField label="Phone">{row.phone ? formatPhoneForDisplay(row.phone) : "—"}</DetailField>
            </DetailSection>

            <DetailSection title="ADDRESS">
                {address.length > 0 ? (
                    address.map((line, i) => (
                        <Typography key={i} variant="caption" display="block">{line}</Typography>
                    ))
                ) : (
                    <Typography variant="caption" color="text.disabled">None on file</Typography>
                )}
            </DetailSection>

            <DetailSection title="MEMBERSHIP">
                <DetailField label="Status">{row.status || "—"}</DetailField>
                <DetailField label="Pledge class">{row.pledge_class || "—"}</DetailField>
                <DetailField label="Graduation">{row.graduation || "—"}</DetailField>
                <DetailField label="Left chapter">
                    {row.alumni_date ? String(row.alumni_date).slice(0, 10) : "—"}
                </DetailField>
            </DetailSection>

            <DetailSection title={`OFFICES (${history.length})`}>
                {history.length > 0 ? (
                    <Stack spacing={0.25}>
                        {history.map((o) => (
                            <Stack key={o.id} direction="row" gap={1} alignItems="center">
                                <Typography variant="caption" sx={{ minWidth: 96, fontWeight: isCurrentTerm(o) ? 700 : 400 }}>
                                    {o.display_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">{formatTerm(o)}</Typography>
                                {isCurrentTerm(o) && (
                                    <Chip label="current" size="small" color="primary" sx={{ height: 15, fontSize: "0.6rem" }} />
                                )}
                            </Stack>
                        ))}
                    </Stack>
                ) : (
                    <Typography variant="caption" color="text.disabled">Never held an office</Typography>
                )}
            </DetailSection>
        </Stack>
    );
}

export default function BrotherTableComponent(props: Props) {

    const [open, setOpen] = useState<Record<number, boolean>>({});

    function toggleRow(id: number) {
        setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    }

    function setEditingBrother(brother: IBrother) {
        props.setEditingBrother(brother);
    }

    function graduateBrother(brother: IBrother) {
        props.setGraduatingBrother(brother);
    }

    if (props.data.length === 0) {
        return (
            <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                <Typography variant="body2" color="text.secondary">
                    No brothers match the current search and filters.
                </Typography>
            </Paper>
        );
    }

    return (
        <Box sx={{ width: "100%" }}>
            {/* Mobile card layout */}
            <Stack spacing={0.75} sx={{ display: { xs: "flex", md: "none" } }}>
                {props.data.map((row: IBrother) => (
                    <Paper key={row.id} variant="outlined" sx={{ p: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {row.first_name} {row.last_name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" display="block">{row.email}</Typography>
                                {row.phone ? <Typography variant="caption" color="text.secondary" display="block">{formatPhoneForDisplay(row.phone)}</Typography> : null}
                                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                                    <Chip label={row.status ?? "—"} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
                                    {(row.current_offices ?? []).map((o) => (
                                        <Chip key={o.display_name} label={o.display_name} size="small" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
                                    ))}
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                    {row.pledge_class ? `PC ${row.pledge_class}` : ""}{row.graduation ? ` · Grad ${row.graduation}` : ""}
                                </Typography>
                            </Box>
                            {props.canWrite ? (
                                <Stack direction="row">
                                    <IconButton size="small" onClick={() => setEditingBrother(row)}><EditIcon fontSize="small" /></IconButton>
                                    <IconButton size="small" onClick={() => graduateBrother(row)} disabled={row.status === "Alumnus"}><SchoolIcon fontSize="small" /></IconButton>
                                </Stack>
                            ) : null}
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
                <Table size="small" sx={{ minWidth: 900, tableLayout: "fixed" }} aria-label="Brothers Table">
                    <TableHead>
                        <TableRow>
                            {/* Empty header over the expand chevrons. */}
                            <TableCell sx={{ ...HEAD_SX, width: 32 }} />
                            <TableCell sx={{ ...HEAD_SX, width: 170 }}>Name</TableCell>
                            <TableCell sx={HEAD_SX}>Email</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 124 }}>Phone</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 108 }}>Pledge Class</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 60 }}>Grad</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 130 }}>Office</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 96 }}>Status</TableCell>
                            <TableCell sx={{ ...HEAD_SX, width: 84 }} align="right">Options</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {props.data.map((row: IBrother) => {
                            const isOpen = Boolean(open[row.id as number]);
                            const showDetail = hasDetail(row);
                            return (
                            <Fragment key={row.id}>
                            <TableRow
                                hover
                                sx={{ '&:last-child td, &:last-child th': { border: 0 }, cursor: showDetail ? "pointer" : "default" }}
                                onClick={() => showDetail && toggleRow(row.id as number)}
                            >
                                {/* A real chevron, not just a pointer cursor: without it
                                    nothing says there is more behind the row. Rows with
                                    nothing extra to show get no affordance at all. */}
                                <TableCell sx={{ ...CELL_SX, width: 32, p: 0, pl: 0.5 }}>
                                    {showDetail && (
                                        <IconButton size="small" sx={{ p: 0.25 }} aria-label={isOpen ? "Hide details" : "Show details"}>
                                            {isOpen
                                                ? <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
                                                : <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />}
                                        </IconButton>
                                    )}
                                </TableCell>
                                {/* One name column: two were mostly whitespace at this
                                    width. First name leads because the roster is sorted
                                    by it — "Last, First" made the order look random. */}
                                <TableCell sx={{ ...CELL_SX, width: 170, overflow: "hidden", textOverflow: "ellipsis" }} component="th" scope="row">
                                    {row.first_name} {row.last_name}
                                </TableCell>
                                <TableCell sx={{ ...CELL_SX, overflow: "hidden", textOverflow: "ellipsis" }}>
                                    <span title={row.email ?? ""}>{row.email}</span>
                                </TableCell>
                                <TableCell sx={{ ...CELL_SX, width: 124 }}>{row.phone ? formatPhoneForDisplay(row.phone) : ""}</TableCell>
                                <TableCell sx={{ ...CELL_SX, width: 108 }}>{row.pledge_class}</TableCell>
                                <TableCell sx={{ ...CELL_SX, width: 60 }}>{row.graduation}</TableCell>
                                <TableCell sx={{ ...CELL_SX, width: 130, overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {(row.current_offices ?? []).map((o) => o.display_name).join(", ") || (row.office ?? "—")}
                                </TableCell>
                                <TableCell sx={{ ...CELL_SX, width: 96 }}>{row.status}</TableCell>
                                <TableCell sx={{ ...CELL_SX, width: 84 }} align="right" onClick={(e) => e.stopPropagation()}>
                                    {props.canWrite ? (
                                        <>
                                            <IconButton size="small" sx={{ p: 0.25 }} title="Edit" onClick={() => setEditingBrother(row)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            {row.status != "Alumnus" ? (
                                                <IconButton size="small" sx={{ p: 0.25 }} title="Graduate" onClick={() => graduateBrother(row)}>
                                                    <SchoolIcon fontSize="small" />
                                                </IconButton>
                                            ) : (
                                                <IconButton size="small" sx={{ p: 0.25 }} disabled><SchoolIcon fontSize="small" /></IconButton>
                                            )}
                                        </>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                            {showDetail && (
                                <TableRow>
                                    <TableCell sx={{ p: 0, border: 0 }} colSpan={9}>
                                        <Collapse in={isOpen} timeout="auto" unmountOnExit>
                                            <Box sx={{ bgcolor: "action.hover" }}>
                                                <BrotherDetail row={row} />
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
