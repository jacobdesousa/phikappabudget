import styles from "./editDues.module.css";
import Button from "@mui/material/Button";
import { TextField } from "@mui/material";
import { useEffect, useState } from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { IDues } from "../../interfaces/api.interface";
import { updateDues } from "../../services/duesService";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";

interface Props {
  instalment: number;
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
        if (props.duesRecord.first_instalment_amount != 0) {
          setDuesAmount(props.duesRecord.fourth_instalment_amount);
        }
        break;
    }
  });

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
    <div className={styles.modalOverlay}>
      <div className={styles.modalWrapper}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h2>Dues Entry - Instalment {props.instalment}</h2>
          </div>
          <div className={styles.modalBody}>
            <div className={styles.modalFieldContainer}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  className={styles.modalFields}
                  value={duesDate}
                  onChange={(newDate) =>
                    setDuesDate(newDate ? newDate : dayjs(new Date()))
                  }
                  format="MM/DD/YYYY"
                  label="Payment date"
                />
              </LocalizationProvider>
              <TextField
                required
                className={styles.modalFields}
                label="Payment amount"
                type="number"
                value={duesAmount}
                onChange={(event) => setDuesAmount(Number(event.target.value))}
              />
            </div>
            <div className={styles.modalButtonRow}>
              <Button
                className={styles.modalButtons}
                variant="contained"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                className={styles.modalButtons}
                variant="contained"
                onClick={handleAdd}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
