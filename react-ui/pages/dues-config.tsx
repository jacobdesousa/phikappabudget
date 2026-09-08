import {useEffect, useMemo, useState} from "react";
import {Alert, Button, IconButton, InputAdornment, Stack, TextField, Tooltip} from "@mui/material";
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
import { normalizeMoneyInput, sanitizeMoneyInput } from "../utils/money";
import SchoolYearSelector from "../components/SchoolYearSelector";
import { ConfigPageLayout, ConfigSection } from "../components/config/configLayout";

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

    // One instalment row, shared by both schedules. Was a Grid with a
    // full-width "Remove" button squeezed into a one-column cell, which clipped
    // its own label at most widths.
    function instalmentRows(
        which: "regular" | "neophyte",
        list: InstalmentDraft[]
    ) {
        return (
            <Stack spacing={1}>
                {list.map((inst, idx) => (
                    <Stack
                        key={`${which}-${idx}`}
                        direction={{ xs: "column", md: "row" }}
                        spacing={1}
                        alignItems={{ md: "center" }}
                    >
                        <TextField
                            size="small"
                            label="Label"
                            value={inst.label}
                            onChange={(e) => updateInstalment(which, idx, {label: e.target.value})}
                            disabled={loading}
                            sx={{ flex: 1, minWidth: 0 }}
                        />
                        <DatePicker
                            label="Due date"
                            value={inst.due_date}
                            onChange={(d) => updateInstalment(which, idx, {due_date: d ? d : dayjs(new Date())})}
                            slotProps={{ textField: { size: "small", sx: { width: { xs: "100%", md: 190 } } } }}
                        />
                        <TextField
                            size="small"
                            label="Amount"
                            value={inst.amount}
                            onChange={(e) => updateInstalment(which, idx, {amount: sanitizeMoneyInput(e.target.value)})}
                            onBlur={() => updateInstalment(which, idx, {amount: normalizeMoneyInput(inst.amount)})}
                            disabled={loading}
                            inputProps={{ inputMode: "decimal" }}
                            InputProps={{
                                startAdornment: <InputAdornment position="start">$</InputAdornment>,
                            }}
                            sx={{ width: { xs: "100%", md: 150 } }}
                        />
                        <Tooltip title="Remove instalment">
                            <span>
                                <IconButton
                                    size="small"
                                    color="error"
                                    disabled={loading || list.length <= 1}
                                    onClick={() => removeInstalment(which, idx)}
                                >
                                    <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                ))}
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddOutlinedIcon />}
                    disabled={loading}
                    onClick={() => addInstalment(which)}
                    sx={{ alignSelf: "flex-start" }}
                >
                    Add instalment
                </Button>
            </Stack>
        );
    }

    return (
        <ConfigPageLayout
            title="Dues Config"
            description="Regular and neophyte dues amounts, and the instalment schedule for each school year."
            error={error}
            actions={
                <>
                    <SchoolYearSelector value={year} onChange={setYear} />
                    <Button
                        size="small"
                        variant="contained"
                        startIcon={<SaveOutlinedIcon />}
                        disabled={loading}
                        onClick={handleSave}
                    >
                        Save
                    </Button>
                </>
            }
        >
            {success ? <Alert severity="success">{success}</Alert> : null}

            <ConfigSection
                title={`Totals for ${schoolYearLabel(year)}`}
                description="What a full year costs. The instalments below should add up to these."
            >
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <TextField
                        size="small"
                        label="Regular total"
                        value={regularTotalAmount}
                        onChange={(e) => setRegularTotalAmount(sanitizeMoneyInput(e.target.value))}
                        onBlur={() => setRegularTotalAmount(normalizeMoneyInput(regularTotalAmount))}
                        disabled={loading}
                        inputProps={{ inputMode: "decimal" }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        sx={{ maxWidth: 240 }}
                    />
                    <TextField
                        size="small"
                        label="Neophyte total"
                        value={neophyteTotalAmount}
                        onChange={(e) => setNeophyteTotalAmount(sanitizeMoneyInput(e.target.value))}
                        onBlur={() => setNeophyteTotalAmount(normalizeMoneyInput(neophyteTotalAmount))}
                        disabled={loading}
                        inputProps={{ inputMode: "decimal" }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        }}
                        sx={{ maxWidth: 240 }}
                    />
                </Stack>
            </ConfigSection>

            <LocalizationProvider dateAdapter={AdapterDayjs}>
                <ConfigSection title="Regular instalments">
                    {instalmentRows("regular", regularInstalments)}
                </ConfigSection>

                <ConfigSection title="Neophyte instalments">
                    {instalmentRows("neophyte", neophyteInstalments)}
                </ConfigSection>
            </LocalizationProvider>
        </ConfigPageLayout>
    )
}


