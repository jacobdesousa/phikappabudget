import Button from '@mui/material/Button';
import {
    Alert,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormHelperText,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField
} from "@mui/material";
import {useState} from "react";
import BrotherOptionsSchema from "../../interfaces/brotherOptions.schema";
import {addBrother} from "../../services/brotherService";
import CloseIcon from "@mui/icons-material/Close";
import { formatPhoneInput, toE164 } from "../../utils/phone";
import BrotherAddressFields, { EMPTY_ADDRESS } from "../brotherAddress/addressFields";

export default function AddBrotherModalComponent(props: any) {

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    // Season and year separately, same as the edit modal. Year-only pledge
    // classes are not offered here: every new member has a semester. The
    // historic year-only records are loaded by SQL migration.
    const [pcSeason, setPcSeason] = useState<"Fall" | "Spring">("Fall");
    const [pcYear, setPcYear] = useState(new Date().getFullYear());
    const [graduation, setGraduation] = useState("");
    const [status, setStatus] = useState("");
    const [address, setAddress] = useState(EMPTY_ADDRESS);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | undefined>(undefined);
    const [emailError, setEmailError] = useState<string | undefined>(undefined);
    const [statusError, setStatusError] = useState<string | undefined>(undefined);

    const isBoarder = status === BrotherOptionsSchema.boarderStatus;

    function handleCancel() {
        props.onClose();
    }

    async function handleAdd() {
        setSubmitting(true);
        setSubmitError(undefined);
        setEmailError(undefined);
        setStatusError(undefined);

        if (!status) {
            setSubmitting(false);
            setStatusError("Status is required.");
            return;
        }

        const newBrother = {
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: toE164(phone),
            // Boarders have no pledge class or graduation year.
            pledge_class: isBoarder ? null : `${pcSeason} ${pcYear}`,
            graduation: isBoarder || !graduation ? null : Number(graduation),
            status: status,
            // Blanks are absences: the API turns them back into NULL.
            ...address,
        }

        const result = await addBrother(newBrother as any);
        setSubmitting(false);

        if (!result.ok) {
            const issues = result.error?.issues ?? [];
            const emailIssue = issues.find((i: any) => i?.path?.[0] === "email");
            if (emailIssue?.message) setEmailError(emailIssue.message);
            setSubmitError(result.error?.message ?? "Could not create brother.");
            return;
        }

        handleCancel();
    }


    function handleFieldChange(event: any, field: string) {
        switch (field) {
            case "firstName":
                setFirstName(event.target.value)
                break;
            case "lastName":
                setLastName(event.target.value)
                break;
            case "email":
                setEmail(event.target.value)
                setEmailError(undefined);
                break;
            case "phone":
                setPhone(formatPhoneInput(event.target.value))
                break;
            case "graduation":
                setGraduation(event.target.value)
                break;
            case "status":
                setStatus(event.target.value)
                setStatusError(undefined);
                break;
        }
    }

    return (
        <Dialog open onClose={handleCancel} fullWidth maxWidth="md" scroll="paper">
            <DialogTitle sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                Add Brother
                <IconButton onClick={handleCancel} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{pt: 1}}>
                    {submitError && <Alert severity="error">{submitError}</Alert>}

                    <TextField
                        required
                        fullWidth
                        label="First Name"
                        value={firstName}
                        onChange={(event) => handleFieldChange(event, "firstName")}
                    />
                    <TextField
                        required
                        fullWidth
                        label="Last Name"
                        value={lastName}
                        onChange={(event) => handleFieldChange(event, "lastName")}
                    />
                    <TextField
                        required
                        fullWidth
                        label="Email"
                        value={email}
                        error={Boolean(emailError)}
                        helperText={emailError}
                        onChange={(event) => handleFieldChange(event, "email")}
                    />
                    <TextField
                        required
                        fullWidth
                        label="Phone"
                        value={phone}
                        onChange={(event) => handleFieldChange(event, "phone")}
                        helperText="Include the + country code for numbers outside North America, e.g. +353 83 123 4567"
                    />

                    {/* Status comes first: it decides whether the chapter fields apply. */}
                    <FormControl fullWidth required error={Boolean(statusError)}>
                        <InputLabel id="status-label">Status</InputLabel>
                        <Select
                            labelId="status-label"
                            required
                            label="Status"
                            value={status}
                            onChange={(event) => handleFieldChange(event, "status")}
                        >
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
                                <Select
                                    labelId="pc-season-label"
                                    label="Season"
                                    value={pcSeason}
                                    onChange={(event) => setPcSeason(event.target.value as "Fall" | "Spring")}
                                >
                                    <MenuItem value="Fall">Fall</MenuItem>
                                    <MenuItem value="Spring">Spring</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField
                                label="Pledge Class Year"
                                type="number"
                                value={pcYear}
                                onChange={(event) => setPcYear(Number(event.target.value))}
                                inputProps={{ min: 1900, max: 2100, step: 1 }}
                                sx={{ flex: 1 }}
                            />
                        </Stack>
                    )}

                    {!isBoarder && (
                        <TextField
                            required
                            fullWidth
                            label="Graduation"
                            value={graduation}
                            onChange={(event) => handleFieldChange(event, "graduation")}
                        />
                    )}

                    {/* Collapsed: optional, and six fields unfolded would
                        dominate the dialog. */}
                    <BrotherAddressFields value={address} onChange={setAddress} />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={handleCancel}>Cancel</Button>
                <Button variant="contained" disabled={submitting} onClick={handleAdd}>Submit</Button>
            </DialogActions>
        </Dialog>
    )

}