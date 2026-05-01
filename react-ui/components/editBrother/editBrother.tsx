import Button from '@mui/material/Button';
import {
    Alert,
    Box,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import BrotherOptionsSchema from "../../interfaces/brotherOptions.schema";
import { editBrother, listBrotherOffices, assignBrotherOffice, updateBrotherOffice, deleteBrotherOffice } from "../../services/brotherService";
import { IBrother, IBrotherOffice } from "../../interfaces/api.interface";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { formatNorthAmericanPhone } from "../../utils/phone";
import { getOffices, type OfficeListItem } from "../../services/officesService";
import dayjs from "dayjs";

interface Props {
    newBrother: IBrother;
    onClose: any;
}

function formatDate(d: string | null | undefined): string {
    if (!d) return "Present";
    return dayjs(d).format("MMM D, YYYY");
}

function today(): string {
    return dayjs().format("YYYY-MM-DD");
}

export default function EditBrotherModalComponent(props: Props) {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [pledgeClass, setPledgeClass] = useState("");
    const [graduation, setGraduation] = useState(0);
    const [status, setStatus] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | undefined>(undefined);
    const [emailError, setEmailError] = useState<string | undefined>(undefined);
    const [statusError, setStatusError] = useState<string | undefined>(undefined);

    // Office tenures
    const [offices, setOffices] = useState<OfficeListItem[]>([]);
    const [tenures, setTenures] = useState<IBrotherOffice[]>([]);
    const [tenureError, setTenureError] = useState<string | null>(null);

    // Add office form
    const [addOfficeKey, setAddOfficeKey] = useState("");
    const [addStartDate, setAddStartDate] = useState(today());
    const [addEndDate, setAddEndDate] = useState("");
    const [addingOffice, setAddingOffice] = useState(false);

    const brotherId = props.newBrother.id as number;

    useEffect(() => {
        setFirstName(props.newBrother.first_name);
        setLastName(props.newBrother.last_name);
        setEmail(props.newBrother.email);
        setPhone(formatNorthAmericanPhone(props.newBrother.phone));
        setPledgeClass(props.newBrother.pledge_class);
        setGraduation(props.newBrother.graduation);
        setStatus(props.newBrother.status);
    }, [props.newBrother]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [officeRows, tenureRows] = await Promise.all([
                    getOffices(),
                    listBrotherOffices(brotherId),
                ]);
                if (cancelled) return;
                setOffices(officeRows ?? []);
                setTenures(tenureRows ?? []);
            } catch {
                if (cancelled) return;
                setOffices([]);
                setTenures([]);
            }
        })();
        return () => { cancelled = true; };
    }, [brotherId]);

    function handleCancel() {
        props.onClose();
    }

    async function handleEdit() {
        setSubmitting(true);
        setSubmitError(undefined);
        setEmailError(undefined);
        setStatusError(undefined);

        if (!status) {
            setSubmitting(false);
            setStatusError("Status is required.");
            return;
        }

        const updatedBrother = {
            id: props.newBrother.id,
            first_name: firstName,
            last_name: lastName,
            email,
            phone,
            pledge_class: pledgeClass,
            graduation: Number(graduation),
            status,
        };

        const result = await editBrother(updatedBrother as any, brotherId);
        setSubmitting(false);

        if (!result.ok) {
            const issues = result.error?.issues ?? [];
            const emailIssue = issues.find((i: any) => i?.path?.[0] === "email");
            if (emailIssue?.message) setEmailError(emailIssue.message);
            setSubmitError(result.error?.message ?? "Could not save changes.");
            return;
        }

        handleCancel();
    }

    async function handleAssignOffice() {
        if (!addOfficeKey || !addStartDate) return;
        setAddingOffice(true);
        setTenureError(null);
        const result = await assignBrotherOffice(brotherId, {
            office_key: addOfficeKey,
            start_date: addStartDate,
            end_date: addEndDate || null,
        });
        setAddingOffice(false);
        if (!result.ok) {
            setTenureError(result.error);
            return;
        }
        setTenures((prev) => [result.data, ...prev]);
        setAddOfficeKey("");
        setAddStartDate(today());
        setAddEndDate("");
    }

    async function handleEndTenure(tenure: IBrotherOffice) {
        setTenureError(null);
        const result = await updateBrotherOffice(tenure.id, { end_date: today() });
        if (!result.ok) {
            setTenureError(result.error);
            return;
        }
        setTenures((prev) => prev.map((t) => t.id === tenure.id ? result.data : t));
    }

    async function handleDeleteTenure(tenureId: number) {
        setTenureError(null);
        const result = await deleteBrotherOffice(tenureId);
        if (!result.ok) {
            setTenureError(result.error);
            return;
        }
        setTenures((prev) => prev.filter((t) => t.id !== tenureId));
    }

    function handleFieldChange(event: any, field: string) {
        switch (field) {
            case "firstName": setFirstName(event.target.value); break;
            case "lastName": setLastName(event.target.value); break;
            case "email": setEmail(event.target.value); setEmailError(undefined); break;
            case "phone": setPhone(formatNorthAmericanPhone(event.target.value)); break;
            case "pledgeClass": setPledgeClass(event.target.value); break;
            case "graduation": setGraduation(event.target.value); break;
            case "status": setStatus(event.target.value); setStatusError(undefined); break;
        }
    }

    function generatePledgeClassOptions(): Array<string> {
        const date = new Date();
        let year = date.getFullYear() - 3;
        const classes: string[] = [];
        for (let i = 0; i < 6; i++) {
            classes.push("Fall " + year);
            year += 1;
            classes.push("Spring " + year);
        }
        return classes;
    }

    const activeTenures = tenures.filter((t) => !t.end_date || dayjs(t.end_date).isAfter(dayjs(), "day"));
    const pastTenures = tenures.filter((t) => !!t.end_date && !dayjs(t.end_date).isAfter(dayjs(), "day"));

    return (
        <Dialog open onClose={handleCancel} fullWidth maxWidth="md" scroll="paper">
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                Edit Brother
                <IconButton onClick={handleCancel} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {submitError && <Alert severity="error">{submitError}</Alert>}

                    <TextField required fullWidth label="First Name" value={firstName}
                        onChange={(e) => handleFieldChange(e, "firstName")} />
                    <TextField required fullWidth label="Last Name" value={lastName}
                        onChange={(e) => handleFieldChange(e, "lastName")} />
                    <TextField required fullWidth label="Email" value={email}
                        error={Boolean(emailError)} helperText={emailError}
                        onChange={(e) => handleFieldChange(e, "email")} />
                    <TextField required fullWidth label="Phone" value={phone}
                        onChange={(e) => handleFieldChange(e, "phone")} />

                    <FormControl fullWidth>
                        <InputLabel id="pledge-class-label-edit">Pledge Class</InputLabel>
                        <Select labelId="pledge-class-label-edit" required label="Pledge Class"
                            value={pledgeClass} onChange={(e) => handleFieldChange(e, "pledgeClass")}>
                            {generatePledgeClassOptions().map((pc) => (
                                <MenuItem key={pc} value={pc}>{pc}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField required fullWidth label="Graduation" value={graduation}
                        onChange={(e) => handleFieldChange(e, "graduation")} />

                    <FormControl fullWidth required error={Boolean(statusError)}>
                        <InputLabel id="status-label-edit">Status</InputLabel>
                        <Select labelId="status-label-edit" required label="Status"
                            value={status} onChange={(e) => handleFieldChange(e, "status")}>
                            {BrotherOptionsSchema.statuses.map((s) => (
                                <MenuItem key={s} value={s}>{s}</MenuItem>
                            ))}
                        </Select>
                        {statusError && <FormHelperText>{statusError}</FormHelperText>}
                    </FormControl>

                    <Divider />

                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Offices</Typography>

                    {tenureError && <Alert severity="error" sx={{ py: 0 }}>{tenureError}</Alert>}

                    {/* Active tenures */}
                    {activeTenures.length > 0 && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                                Current
                            </Typography>
                            <Stack spacing={1}>
                                {activeTenures.map((t) => (
                                    <Stack key={t.id} direction="row" alignItems="center" spacing={1}
                                        sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1.5, py: 0.75 }}>
                                        <Box flex={1}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.display_name}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatDate(t.start_date)} – {formatDate(t.end_date)}
                                            </Typography>
                                        </Box>
                                        <Button size="small" variant="outlined" color="warning"
                                            onClick={() => handleEndTenure(t)}>
                                            End
                                        </Button>
                                        <IconButton size="small" color="error" onClick={() => handleDeleteTenure(t.id)}>
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ))}
                            </Stack>
                        </Box>
                    )}

                    {/* Past tenures */}
                    {pastTenures.length > 0 && (
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                                Past
                            </Typography>
                            <Stack spacing={1}>
                                {pastTenures.map((t) => (
                                    <Stack key={t.id} direction="row" alignItems="center" spacing={1}
                                        sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, px: 1.5, py: 0.75, opacity: 0.7 }}>
                                        <Box flex={1}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.display_name}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatDate(t.start_date)} – {formatDate(t.end_date)}
                                            </Typography>
                                        </Box>
                                        <IconButton size="small" color="error" onClick={() => handleDeleteTenure(t.id)}>
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ))}
                            </Stack>
                        </Box>
                    )}

                    {/* Assign office form */}
                    <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
                            Assign office
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "flex-end" }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="assign-office-label">Office</InputLabel>
                                <Select labelId="assign-office-label" label="Office" value={addOfficeKey}
                                    onChange={(e) => setAddOfficeKey(e.target.value)}>
                                    {offices.map((o) => (
                                        <MenuItem key={o.office_key} value={o.office_key}>{o.display_name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField size="small" label="Start date" type="date" value={addStartDate}
                                onChange={(e) => setAddStartDate(e.target.value)}
                                InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }} />
                            <TextField size="small" label="End date (optional)" type="date" value={addEndDate}
                                onChange={(e) => setAddEndDate(e.target.value)}
                                InputLabelProps={{ shrink: true }} sx={{ minWidth: 165 }} />
                            <Button variant="contained" size="small" startIcon={<AddOutlinedIcon />}
                                disabled={!addOfficeKey || !addStartDate || addingOffice}
                                onClick={handleAssignOffice} sx={{ height: 40, whiteSpace: "nowrap", flexShrink: 0 }}>
                                Assign
                            </Button>
                        </Stack>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={handleCancel}>Cancel</Button>
                <Button variant="contained" disabled={submitting} onClick={handleEdit}>Save</Button>
            </DialogActions>
        </Dialog>
    );
}
