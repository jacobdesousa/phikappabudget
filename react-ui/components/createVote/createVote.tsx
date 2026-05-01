import * as React from "react";
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    IconButton,
    Stack,
    Switch,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import { createVote } from "../../services/votesService";
import type { IVote } from "../../interfaces/api.interface";

type Props = {
    meetingId: number;
    onCreated: (vote: IVote) => void;
    onClose: () => void;
};

export default function CreateVoteDialog({ meetingId, onCreated, onClose }: Props) {
    const [question, setQuestion] = React.useState("");
    const [options, setOptions] = React.useState(["", ""]);
    const [allowMultiple, setAllowMultiple] = React.useState(false);
    const [isAnonymous, setIsAnonymous] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const canSubmit = question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2 && !submitting;

    async function handleSubmit() {
        const filledOptions = options.map((o) => o.trim()).filter(Boolean);
        if (filledOptions.length < 2) {
            setError("At least 2 non-empty options are required");
            return;
        }
        setSubmitting(true);
        setError(null);
        const result = await createVote(meetingId, {
            question: question.trim(),
            options: filledOptions,
            allow_multiple: allowMultiple,
            is_anonymous: isAnonymous,
        });
        setSubmitting(false);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        onCreated(result.data);
        onClose();
    }

    function setOption(idx: number, value: string) {
        setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
    }

    function addOption() {
        setOptions((prev) => [...prev, ""]);
    }

    function removeOption(idx: number) {
        setOptions((prev) => prev.filter((_, i) => i !== idx));
    }

    return (
        <Dialog open onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                Create Vote
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    {error ? <Alert severity="error">{error}</Alert> : null}
                    <TextField
                        label="Question"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        fullWidth
                        required
                        placeholder="e.g. Should we approve the social budget increase?"
                        inputProps={{ maxLength: 500 }}
                    />
                    <Stack spacing={1}>
                        <Typography variant="subtitle2">Options (min 2)</Typography>
                        {options.map((opt, idx) => (
                            <Stack key={idx} direction="row" spacing={1} alignItems="center">
                                <TextField
                                    label={`Option ${idx + 1}`}
                                    value={opt}
                                    onChange={(e) => setOption(idx, e.target.value)}
                                    fullWidth
                                    size="small"
                                    inputProps={{ maxLength: 200 }}
                                />
                                <IconButton
                                    aria-label="remove option"
                                    onClick={() => removeOption(idx)}
                                    disabled={options.length <= 2}
                                    size="small"
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </Stack>
                        ))}
                        <Button variant="outlined" startIcon={<AddIcon />} onClick={addOption} sx={{ alignSelf: "flex-start" }}>
                            Add option
                        </Button>
                    </Stack>
                    <FormControlLabel
                        control={<Switch checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} />}
                        label="Allow multiple selections"
                    />
                    <FormControlLabel
                        control={<Switch checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />}
                        label="Secret vote (results won't show who voted for what)"
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={onClose}>Cancel</Button>
                <Button variant="contained" disabled={!canSubmit} onClick={handleSubmit}>
                    {submitting ? "Creating…" : "Create Vote"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
