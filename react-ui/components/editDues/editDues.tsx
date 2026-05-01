import Button from '@mui/material/Button';
import {Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField} from "@mui/material";
import {useEffect, useState} from "react";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {IDues} from "../../interfaces/api.interface";
import {updateDues} from "../../services/duesService";
import {LocalizationProvider} from "@mui/x-date-pickers";
import {AdapterDayjs} from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import CloseIcon from "@mui/icons-material/Close";

interface Props {
    instalment: number
    duesRecord: IDues;
    onClose: any;
}

export default function EditDuesComponentModal(props: Props) {

    const [duesDate, setDuesDate] = useState(dayjs(new Date()));
    const [duesAmount, setDuesAmount] = useState(250);

    useEffect(() => {
        switch (props.instalment) {
            case 1:
                if (props.duesRecord.first_instalment_date) {
                    setDuesDate(dayjs(props.duesRecord.first_instalment_date));
                }
                if (props.duesRecord.first_instalment_amount != 0) {
                    setDuesAmount(props.duesRecord.first_instalment_amount);
                }
                break;
            case 2:
                if (props.duesRecord.second_instalment_date) {
                    setDuesDate(dayjs(props.duesRecord.second_instalment_date));
                }
                if (props.duesRecord.second_instalment_amount != 0) {
                    setDuesAmount(props.duesRecord.second_instalment_amount);
                }
                break;
            case 3:
                if (props.duesRecord.third_instalment_date) {
                    setDuesDate(dayjs(props.duesRecord.third_instalment_date));
                }
                if (props.duesRecord.third_instalment_amount != 0) {
                    setDuesAmount(props.duesRecord.third_instalment_amount);
                }
                break;
            case 4:
                if (props.duesRecord.fourth_instalment_date) {
                    setDuesDate(dayjs(props.duesRecord.fourth_instalment_date));
                }
                if (props.duesRecord.fourth_instalment_amount != 0) {
                    setDuesAmount(props.duesRecord.fourth_instalment_amount);
                }
                break;
        }
    }, [props.instalment, props.duesRecord]);

    function handleCancel() {
        props.onClose();
    }

    function handleAdd() {
        switch (props.instalment) {
            case 1:
                props.duesRecord.first_instalment_date = duesDate.toDate();
                props.duesRecord.first_instalment_amount = duesAmount;
                break;
            case 2:
                props.duesRecord.second_instalment_date = duesDate.toDate();
                props.duesRecord.second_instalment_amount = duesAmount;
                break;
            case 3:
                props.duesRecord.third_instalment_date = duesDate.toDate();
                props.duesRecord.third_instalment_amount = duesAmount;
                break;
            case 4:
                props.duesRecord.fourth_instalment_date = duesDate.toDate();
                props.duesRecord.fourth_instalment_amount = duesAmount;
                break;
        }

        updateDues(props.duesRecord);
        handleCancel();
    }

    return (
        <Dialog open onClose={handleCancel} fullWidth maxWidth="sm" scroll="paper">
            <DialogTitle sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                {`Dues Entry - Instalment ${props.instalment}`}
                <IconButton onClick={handleCancel} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{pt: 1}}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            value={duesDate}
                            onChange={(newDate) => setDuesDate(newDate ? newDate : dayjs(new Date()))}
                            format="MM/DD/YYYY"
                            label="Payment date"
                            slotProps={{ textField: { fullWidth: true } }}
                        />
                    </LocalizationProvider>
                    <TextField
                        required
                        fullWidth
                        label="Payment amount"
                        type="number"
                        value={duesAmount}
                        onChange={(event) => setDuesAmount(Number(event.target.value))}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant="outlined" onClick={handleCancel}>Cancel</Button>
                <Button variant="contained" onClick={handleAdd}>Submit</Button>
            </DialogActions>
        </Dialog>
    )

}