import Button from '@mui/material/Button';
import {Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography} from "@mui/material";
import {editBrother} from "../../services/brotherService";
import {IBrother} from "../../interfaces/api.interface";
import CloseIcon from "@mui/icons-material/Close";

interface Props {
    graduatingBrother: IBrother;
    onClose: any;
}

export default function GraduateBrotherModalComponent(props: Props) {

    function handleCancel() {
        props.onClose();
    }

    function handleGraduate() {
        props.graduatingBrother.status = "Alumnus";

        editBrother(props.graduatingBrother, props.graduatingBrother.id!);
        handleCancel();
    }


    return (
        <Dialog open onClose={handleCancel} fullWidth maxWidth="sm">
            <DialogTitle sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                Graduate Brother
                <IconButton onClick={handleCancel} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Typography>
                    Are you sure you want to graduate Br. <b>{props.graduatingBrother.first_name} {props.graduatingBrother.last_name}</b>?
                </Typography>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={handleCancel}>Cancel</Button>
                <Button variant="contained" color="primary" onClick={handleGraduate}>Graduate</Button>
            </DialogActions>
        </Dialog>
    )

}