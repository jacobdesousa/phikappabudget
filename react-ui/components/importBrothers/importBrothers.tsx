import React, { useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { importBrothers, ImportBrotherRow } from "../../services/brotherService";

const EXPECTED_HEADERS = ["first_name", "last_name", "email", "phone", "pledge_class", "graduation", "status"] as const;

function parseCsv(text: string): { rows: ImportBrotherRow[]; error: string | null } {
    const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
    if (lines.length < 2) return { rows: [], error: "CSV must have a header row and at least one data row." };

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
    if (!headers.includes("first_name") || !headers.includes("last_name")) {
        return { rows: [], error: 'CSV must include "first_name" and "last_name" columns.' };
    }

    const rows: ImportBrotherRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => { obj[h] = cells[idx] ?? ""; });
        rows.push({
            first_name: obj.first_name ?? "",
            last_name: obj.last_name ?? "",
            email: obj.email || undefined,
            phone: obj.phone || undefined,
            pledge_class: obj.pledge_class || undefined,
            graduation: obj.graduation || undefined,
            status: obj.status || undefined,
        });
    }

    if (rows.length === 0) return { rows: [], error: "No data rows found." };
    return { rows, error: null };
}

interface Props {
    onClose: (imported: boolean) => void;
}

export default function ImportBrothersDialog({ onClose }: Props) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [rows, setRows] = useState<ImportBrotherRow[] | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ inserted: number; errors: { row: number; message: string }[] } | null>(null);

    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            const { rows: parsed, error } = parseCsv(text);
            setParseError(error);
            setRows(error ? null : parsed);
            setResult(null);
        };
        reader.readAsText(file);
    }

    async function handleImport() {
        if (!rows || rows.length === 0) return;
        setSubmitting(true);
        const res = await importBrothers(rows);
        setSubmitting(false);
        if (!res.ok) {
            setParseError(res.error);
            return;
        }
        setResult({ inserted: res.inserted, errors: res.errors });
    }

    const done = result !== null;

    return (
        <Dialog open fullWidth maxWidth="md" onClose={() => onClose(done && result!.inserted > 0)}>
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                Import Brothers from CSV
                <IconButton size="small" onClick={() => onClose(done && result!.inserted > 0)}>
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Upload a CSV with a header row. Required columns: <b>first_name</b>, <b>last_name</b>.
                    Optional: <b>email</b>, <b>phone</b>, <b>pledge_class</b>, <b>graduation</b>, <b>status</b>.
                </Typography>

                {!done && (
                    <Box sx={{ mb: 2 }}>
                        <Button variant="outlined" component="label" size="small">
                            Choose CSV File
                            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
                        </Button>
                    </Box>
                )}

                {parseError && <Alert severity="error" sx={{ mb: 2 }}>{parseError}</Alert>}

                {rows && !done && (
                    <>
                        <Typography variant="body2" sx={{ mb: 1 }}>{rows.length} row{rows.length !== 1 ? "s" : ""} parsed — preview:</Typography>
                        <Box sx={{ maxHeight: 320, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        {EXPECTED_HEADERS.map((h) => <TableCell key={h}>{h}</TableCell>)}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((r, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{r.first_name}</TableCell>
                                            <TableCell>{r.last_name}</TableCell>
                                            <TableCell>{r.email ?? ""}</TableCell>
                                            <TableCell>{r.phone ?? ""}</TableCell>
                                            <TableCell>{r.pledge_class ?? ""}</TableCell>
                                            <TableCell>{r.graduation ?? ""}</TableCell>
                                            <TableCell>{r.status ?? ""}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    </>
                )}

                {done && (
                    <>
                        <Alert severity={result!.errors.length === 0 ? "success" : "warning"} sx={{ mb: 2 }}>
                            {result!.inserted} brother{result!.inserted !== 1 ? "s" : ""} imported.
                            {result!.errors.length > 0 ? ` ${result!.errors.length} row${result!.errors.length !== 1 ? "s" : ""} failed.` : ""}
                        </Alert>
                        {result!.errors.length > 0 && (
                            <Box sx={{ maxHeight: 200, overflow: "auto" }}>
                                {result!.errors.map((e, i) => (
                                    <Typography key={i} variant="body2" color="error">Row {e.row}: {e.message}</Typography>
                                ))}
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose(done && result!.inserted > 0)}>
                    {done ? "Close" : "Cancel"}
                </Button>
                {!done && (
                    <Button
                        variant="contained"
                        disabled={!rows || rows.length === 0 || submitting}
                        onClick={handleImport}
                    >
                        {submitting ? "Importing…" : `Import ${rows ? rows.length : 0} Brothers`}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
