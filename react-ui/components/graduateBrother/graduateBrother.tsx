import Button from '@mui/material/Button';
import {useState} from "react";
import {Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography} from "@mui/material";
import {editBrother} from "../../services/brotherService";
import {IBrother} from "../../interfaces/api.interface";
import CloseIcon from "@mui/icons-material/Close";
import {schoolYearLabel, schoolYearStartForDate} from "../../utils/schoolYear";

interface Props {
    graduatingBrother: IBrother;
    onClose: any;
}

export default function GraduateBrotherModalComponent(props: Props) {

    // The date decides which school years this brother still counts toward on
    // the budget and dues pages, so it is captured here rather than defaulted
    // silently — graduating in the summer is common, and that lands in the year
    // that just ended, not the one about to start.
    const [leftOn, setLeftOn] = useState(() => new Date().toISOString().slice(0, 10));

    function handleCancel() {
        props.onClose();
    }

    function handleGraduate() {
        editBrother(
            {...props.graduatingBrother, status: "Alumnus", alumni_date: leftOn},
            props.graduatingBrother.id!
        );
        handleCancel();
    }

    const lastYear = leftOn ? schoolYearStartForDate(leftOn) : null;

    return (
        <Dialog open onClose={handleCancel} fullWidth maxWidth="sm">
            <DialogTitle sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                Graduate Brother
                <IconButton onClick={handleCancel} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography>
                        Are you sure you want to graduate Br. <b>{props.graduatingBrother.first_name} {props.graduatingBrother.last_name}</b>?
                    </Typography>
                    <TextField
                        fullWidth
                        type="date"
                        label="Left the chapter"
                        value={leftOn}
                        onChange={(e) => setLeftOn(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                    <Typography variant="body2" color="text.secondary">
                        {lastYear === null
                            ? "Without a date he is dropped from every past year's dues and budget figures."
                            : `He stays counted in the budget and dues pages through ${schoolYearLabel(lastYear)}, and is dropped from years after that.`}
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={handleCancel}>Cancel</Button>
                <Button variant="contained" color="primary" onClick={handleGraduate}>Graduate</Button>
            </DialogActions>
        </Dialog>
    )

}
