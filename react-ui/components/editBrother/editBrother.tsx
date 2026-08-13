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
import { formatPhoneInput, toE164 } from "../../utils/phone";
import { getOffices, type OfficeListItem } from "../../services/officesService";
import BrotherAddressFields, { addressFromBrother, hasAddress } from "../brotherAddress/addressFields";
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
    // "" is a pledge class recorded as a bare year, which historic records
    // often are. Without it, opening this dialog on such a brother and saving
    // would silently rewrite "1974" to "Fall 1974".
    const [pcSeason, setPcSeason] = useState<"Fall" | "Spring" | "">("Fall");
    const [pcYear, setPcYear] = useState(new Date().getFullYear());
    const [graduation, setGraduation] = useState(0);
    const [status, setStatus] = useState("");
    const [address, setAddress] = useState(addressFromBrother(props.newBrother));
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
        setPhone(formatPhoneInput(props.newBrother.phone));
        setPledgeClass(props.newBrother.pledge_class);
        const raw = String(props.newBrother.pledge_class ?? "").trim();
        const parts = raw.split(" ");
        if (parts.length === 2) {
            if (parts[0] === "Fall" || parts[0] === "Spring") setPcSeason(parts[0]);
            const yr = parseInt(parts[1], 10);
            if (!isNaN(yr)) setPcYear(yr);
        } else if (/^\d{4}$/.test(raw)) {
            // A historic record loaded by SQL migration, with no semester on
            // file. Kept as it is rather than guessed at.
            setPcSeason("");
            setPcYear(parseInt(raw, 10));
        }
        setGraduation(props.newBrother.graduation);
        setStatus(props.newBrother.status);
        setAddress(addressFromBrother(props.newBrother));
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

    const isBoarder = status === BrotherOptionsSchema.boarderStatus;

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
            phone: toE164(phone),
            // Boarders have no pledge class or graduation year.
            pledge_class: isBoarder ? null : pcSeason ? `${pcSeason} ${pcYear}` : String(pcYear),
            graduation: isBoarder || !graduation ? null : Number(graduation),
            status,
            // Sent whole every time: the update rewrites all six columns, so a
            // cleared field has to arrive as a blank rather than be omitted.
            ...address,
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
            case "phone": setPhone(formatPhoneInput(event.target.value)); break;
            case "graduation": setGraduation(event.target.value); break;
            case "status": setStatus(event.target.value); setStatusError(undefined); break;
        }
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
                        onChange={(e) => handleFieldChange(e, "phone")}
                        helperText="Include the + country code for numbers outside North America, e.g. +353 83 123 4567" />

                    {/* Status comes first: it decides whether the chapter fields apply. */}
                    <FormControl fullWidth required error={Boolean(statusError)}>
                        <InputLabel id="status-label-edit">Status</InputLabel>
                        <Select labelId="status-label-edit" required label="Status"
                            value={status} onChange={(e) => handleFieldChange(e, "status")}>
                            {BrotherOptionsSchema.statuses.map((s) => (
                                <MenuItem key={s} value={s}>{s}</MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {statusError ?? (isBoarder ? "Boarders are house residents who aren't members — contact info only." : undefined)}
                        </FormHelperText>
                    </FormControl>

                    {!isBoarder && (
                        <Stack direction="row" spacing={1}>
                            <FormControl sx={{ minWidth: 120 }}>
                                <InputLabel id="pc-season-label">Season</InputLabel>
                                <Select labelId="pc-season-label" label="Season" value={pcSeason}
                                    onChange={(e) => setPcSeason(e.target.value as "Fall" | "Spring" | "")}>
                                    <MenuItem value="Fall">Fall</MenuItem>
                                    <MenuItem value="Spring">Spring</MenuItem>
                                    {/* Only offered to a record that already
                                        has no semester, so saving does not
                                        invent one — never as a new choice. */}
                                    {pcSeason === "" ? <MenuItem value="">Year only</MenuItem> : null}
                                </Select>
                            </FormControl>
                            <TextField label="Pledge Class Year" type="number" value={pcYear}
                                onChange={(e) => setPcYear(Number(e.target.value))}
                                inputProps={{ min: 1900, max: 2100, step: 1 }}
                                sx={{ flex: 1 }} />
                        </Stack>
                    )}

                    {!isBoarder && (
                        <TextField required fullWidth label="Graduation" value={graduation}
                            onChange={(e) => handleFieldChange(e, "graduation")} />
                    )}

                    {/* Open when there is already an address, so an edit does
                        not bury it. */}
                    <BrotherAddressFields
                        value={address}
                        onChange={setAddress}
                        defaultExpanded={hasAddress(addressFromBrother(props.newBrother))}
                    />

                    {!isBoarder && <Divider />}

                    {!isBoarder && (
                      <>
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
                      </>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={handleCancel}>Cancel</Button>
                <Button variant="contained" disabled={submitting} onClick={handleEdit}>Save</Button>
            </DialogActions>
        </Dialog>
    );
}
