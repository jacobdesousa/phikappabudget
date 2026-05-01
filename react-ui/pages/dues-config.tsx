import {useEffect, useMemo, useState} from "react";
import {Alert, Box, Button, Container, Divider, Grid, InputAdornment, Paper, Stack, TextField, Typography} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {LocalizationProvider} from "@mui/x-date-pickers";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import {DatePicker} from "@mui/x-date-pickers/DatePicker";
import dayjs, {Dayjs} from "dayjs";
import {IDuesConfig, IDuesInstalment} from "../interfaces/api.interface";
import {getDuesConfig, upsertDuesConfig} from "../services/duesConfigService";
import {schoolYearLabel, schoolYearStartForDate} from "../utils/schoolYear";
import { normalizeMoneyInput } from "../utils/money";

type InstalmentDraft = {
    label: string;
    due_date: Dayjs;
    amount: string;
};

export default function DuesConfigPage() {
    const currentYear = useMemo(() => schoolYearStartForDate(new Date()), []);
    const [year, setYear] = useState<number>(currentYear);
    const [regularTotalAmount, setRegularTotalAmount] = useState<string>("1100");
    const [neophyteTotalAmount, setNeophyteTotalAmount] = useState<string>("800");

    const defaultRegularInstalments: InstalmentDraft[] = [
        // Default to a Sept–Apr school-year cadence
        {label: "Instalment 1", due_date: dayjs(new Date(currentYear, 8, 15)), amount: "275"},
        {label: "Instalment 2", due_date: dayjs(new Date(currentYear, 10, 15)), amount: "275"},
        {label: "Instalment 3", due_date: dayjs(new Date(currentYear + 1, 0, 15)), amount: "275"},
        {label: "Instalment 4", due_date: dayjs(new Date(currentYear + 1, 2, 15)), amount: "275"},
    ];
    const defaultNeophyteInstalments: InstalmentDraft[] = [
        {label: "Instalment 1", due_date: dayjs(new Date(currentYear, 8, 15)), amount: "200"},
        {label: "Instalment 2", due_date: dayjs(new Date(currentYear, 10, 15)), amount: "200"},
        {label: "Instalment 3", due_date: dayjs(new Date(currentYear + 1, 0, 15)), amount: "200"},
        {label: "Instalment 4", due_date: dayjs(new Date(currentYear + 1, 2, 15)), amount: "200"},
    ];

    const [regularInstalments, setRegularInstalments] = useState<InstalmentDraft[]>(defaultRegularInstalments);
    const [neophyteInstalments, setNeophyteInstalments] = useState<InstalmentDraft[]>(defaultNeophyteInstalments);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>(undefined);
    const [success, setSuccess] = useState<string | undefined>(undefined);

    useEffect(() => {
        setLoading(true);
        setError(undefined);
        setSuccess(undefined);
        getDuesConfig(year)
            .then((cfg) => {
                if (!cfg) return;
                setRegularTotalAmount(String(cfg.regular?.total_amount ?? ""));
                setNeophyteTotalAmount(String(cfg.neophyte?.total_amount ?? ""));

                setRegularInstalments((cfg.regular?.instalments ?? []).map((i: IDuesInstalment) => ({
                    label: String(i.label ?? ""),
                    due_date: dayjs(i.due_date),
                    amount: String(i.amount ?? ""),
                })));

                setNeophyteInstalments((cfg.neophyte?.instalments ?? []).map((i: IDuesInstalment) => ({
                    label: String(i.label ?? ""),
                    due_date: dayjs(i.due_date),
                    amount: String(i.amount ?? ""),
                })));
            })
            .finally(() => setLoading(false));
    }, [year]);

    async function handleSave() {
        setLoading(true);
        setError(undefined);
        setSuccess(undefined);

        const config: IDuesConfig = {
            year,
            regular: {
                total_amount: Number(regularTotalAmount),
                instalments: regularInstalments.map((i) => ({
                    year,
                    label: i.label || null,
                    due_date: i.due_date.toDate(),
                    amount: Number(i.amount),
                })),
            },
            neophyte: {
                total_amount: Number(neophyteTotalAmount),
                instalments: neophyteInstalments.map((i) => ({
                    year,
                    label: i.label || null,
                    due_date: i.due_date.toDate(),
                    amount: Number(i.amount),
                })),
            },
        };

        const result = await upsertDuesConfig(config);
        setLoading(false);
        if (!result.ok) {
            setError(result.error?.message ?? "Could not save dues configuration.");
            return;
        }
        setSuccess("Saved.");
    }

    function updateInstalment(which: "regular" | "neophyte", idx: number, patch: Partial<InstalmentDraft>) {
        const setter = which === "regular" ? setRegularInstalments : setNeophyteInstalments;
        setter(prev => prev.map((i, iIdx) => iIdx === idx ? ({...i, ...patch}) : i));
    }

    function addInstalment(which: "regular" | "neophyte") {
        const setter = which === "regular" ? setRegularInstalments : setNeophyteInstalments;
        setter(prev => [...prev, {label: `Instalment ${prev.length + 1}`, due_date: dayjs(new Date(year, 8, 1)), amount: ""}]);
    }

    function removeInstalment(which: "regular" | "neophyte", idx: number) {
        const setter = which === "regular" ? setRegularInstalments : setNeophyteInstalments;
        setter(prev => prev.filter((_, i) => i !== idx));
    }

    return (
        <Stack spacing={2}>
            <Paper elevation={0} sx={{p: 2, border: "1px solid", borderColor: "divider"}}>
                <Typography variant="h5">Dues Config</Typography>
                <Typography variant="body2" color="text.secondary">
                    Configure regular vs neophyte dues amounts and instalment schedules per school year.
                </Typography>
            </Paper>

            <Container maxWidth="lg" disableGutters>
                <Paper elevation={2} sx={{p: {xs: 2, md: 3}}}>
                    <Stack spacing={2}>
                        {error && <Alert severity="error">{error}</Alert>}
                        {success && <Alert severity="success">{success}</Alert>}

                                <Typography variant="h6">School year setup</Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <TextField
                                            fullWidth
                                            label="Year (start)"
                                            type="number"
                                            value={year}
                                            onChange={(e) => setYear(Number(e.target.value))}
                                            disabled={loading}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <TextField
                                            fullWidth
                                            label="School year"
                                            value={schoolYearLabel(year)}
                                            disabled
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <TextField
                                            fullWidth
                                            label="Regular total"
                                            type="number"
                                            value={regularTotalAmount}
                                            onChange={(e) => setRegularTotalAmount(e.target.value)}
                                            onBlur={() => setRegularTotalAmount(normalizeMoneyInput(regularTotalAmount))}
                                            disabled={loading}
                                            inputProps={{ step: "0.01" }}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <TextField
                                            fullWidth
                                            label="Neophyte total"
                                            type="number"
                                            value={neophyteTotalAmount}
                                            onChange={(e) => setNeophyteTotalAmount(e.target.value)}
                                            onBlur={() => setNeophyteTotalAmount(normalizeMoneyInput(neophyteTotalAmount))}
                                            disabled={loading}
                                            inputProps={{ step: "0.01" }}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                            }}
                                        />
                                    </Grid>
                                </Grid>

                                <Divider />

                                <Typography variant="h6">Regular instalments</Typography>
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <Stack spacing={2}>
                                        {regularInstalments.map((inst, idx) => (
                                            <Paper key={`${idx}-${inst.label}`} variant="outlined" sx={{p: 2}}>
                                                <Grid container spacing={2} alignItems="center">
                                                    <Grid item xs={12} md={6}>
                                                        <TextField
                                                            fullWidth
                                                            label="Label"
                                                            value={inst.label}
                                                            onChange={(e) => updateInstalment("regular", idx, {label: e.target.value})}
                                                            disabled={loading}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} sm={6} md={3}>
                                                        <DatePicker
                                                            label="Due date"
                                                            value={inst.due_date}
                                                            onChange={(d) => updateInstalment("regular", idx, {due_date: d ? d : dayjs(new Date())})}
                                                            slotProps={{ textField: { fullWidth: true } }}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} sm={6} md={2}>
                                                        <TextField
                                                            fullWidth
                                                            label="Amount"
                                                            type="number"
                                                            value={inst.amount}
                                                            onChange={(e) => updateInstalment("regular", idx, {amount: e.target.value})}
                                                            onBlur={() => updateInstalment("regular", idx, {amount: normalizeMoneyInput(inst.amount)})}
                                                            disabled={loading}
                                                            inputProps={{ step: "0.01" }}
                                                            InputProps={{
                                                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                                            }}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} md={1}>
                                                        <Button
                                                            fullWidth
                                                            variant="outlined"
                                                            disabled={loading || regularInstalments.length <= 1}
                                                            onClick={() => removeInstalment("regular", idx)}
                                                            startIcon={<DeleteOutlineIcon />}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </Grid>
                                                </Grid>
                                            </Paper>
                                        ))}

                                        <Box>
                                            <Button variant="outlined" startIcon={<AddOutlinedIcon />} disabled={loading} onClick={() => addInstalment("regular")}>
                                                Add instalment
                                            </Button>
                                        </Box>
                                    </Stack>
                                </LocalizationProvider>

                                <Divider />

                                <Typography variant="h6">Neophyte instalments</Typography>
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <Stack spacing={2}>
                                        {neophyteInstalments.map((inst, idx) => (
                                            <Paper key={`neo-${idx}-${inst.label}`} variant="outlined" sx={{p: 2}}>
                                                <Grid container spacing={2} alignItems="center">
                                                    <Grid item xs={12} md={6}>
                                                        <TextField
                                                            fullWidth
                                                            label="Label"
                                                            value={inst.label}
                                                            onChange={(e) => updateInstalment("neophyte", idx, {label: e.target.value})}
                                                            disabled={loading}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} sm={6} md={3}>
                                                        <DatePicker
                                                            label="Due date"
                                                            value={inst.due_date}
                                                            onChange={(d) => updateInstalment("neophyte", idx, {due_date: d ? d : dayjs(new Date())})}
                                                            slotProps={{ textField: { fullWidth: true } }}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} sm={6} md={2}>
                                                        <TextField
                                                            fullWidth
                                                            label="Amount"
                                                            type="number"
                                                            value={inst.amount}
                                                            onChange={(e) => updateInstalment("neophyte", idx, {amount: e.target.value})}
                                                            onBlur={() => updateInstalment("neophyte", idx, {amount: normalizeMoneyInput(inst.amount)})}
                                                            disabled={loading}
                                                            inputProps={{ step: "0.01" }}
                                                            InputProps={{
                                                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                                            }}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} md={1}>
                                                        <Button
                                                            fullWidth
                                                            variant="outlined"
                                                            disabled={loading || neophyteInstalments.length <= 1}
                                                            onClick={() => removeInstalment("neophyte", idx)}
                                                            startIcon={<DeleteOutlineIcon />}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </Grid>
                                                </Grid>
                                            </Paper>
                                        ))}

                                        <Stack direction={{xs: "column", sm: "row"}} spacing={2} justifyContent="space-between">
                                            <Button variant="outlined" startIcon={<AddOutlinedIcon />} disabled={loading} onClick={() => addInstalment("neophyte")}>
                                                Add instalment
                                            </Button>
                                            <Button variant="contained" startIcon={<SaveOutlinedIcon />} disabled={loading} onClick={handleSave}>
                                                Save
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </LocalizationProvider>
                            </Stack>
                        </Paper>
                    </Container>
                </Stack>
    )
}


