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
import { formatNorthAmericanPhone } from "../../utils/phone";

export default function AddBrotherModalComponent(props: any) {

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [pledgeClass, setPledgeClass] = useState("");
    const [graduation, setGraduation] = useState("");
    const [status, setStatus] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | undefined>(undefined);
    const [emailError, setEmailError] = useState<string | undefined>(undefined);
    const [statusError, setStatusError] = useState<string | undefined>(undefined);

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
            phone: phone,
            pledge_class: pledgeClass,
            graduation: Number(graduation),
            status: status
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
                setPhone(formatNorthAmericanPhone(event.target.value))
                break;
            case "pledgeClass":
                setPledgeClass(event.target.value)
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

    function generatePledgeClassOptions(): Array<string> {
        const date = new Date();
        let year = date.getFullYear() - 3;
        let classes = new Array<string>;

        for (let i = 0; i < 6; i++) {
            classes.push("Fall " + year);
            year += 1;
            classes.push("Spring " + year);
        }
        return classes;
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
                    />

                    <FormControl fullWidth>
                        <InputLabel id="pledge-class-label">Pledge Class</InputLabel>
                        <Select
                            labelId="pledge-class-label"
                            required
                            label="Pledge Class"
                            value={pledgeClass}
                            onChange={(event) => handleFieldChange(event, "pledgeClass")}
                        >
                            {generatePledgeClassOptions().map((pc) => (
                                <MenuItem key={pc} value={pc}>{pc}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        required
                        fullWidth
                        label="Graduation"
                        value={graduation}
                        onChange={(event) => handleFieldChange(event, "graduation")}
                    />

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
                        {statusError && <FormHelperText>{statusError}</FormHelperText>}
                    </FormControl>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={handleCancel}>Cancel</Button>
                <Button variant="contained" disabled={submitting} onClick={handleAdd}>Submit</Button>
            </DialogActions>
        </Dialog>
    )

}