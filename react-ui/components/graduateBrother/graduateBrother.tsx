import styles from "./graduateBrother.module.css"
import Button from '@mui/material/Button';
import {useEffect} from "react";
import {editBrother} from "../../services/brotherService";
import {IBrother} from "../../interfaces/api.interface";

interface Props {
    graduatingBrother: IBrother;
    onClose: any;
}

export default function GraduateBrotherModalComponent(props: Props) {

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return ()=> {document.body.style.overflow = 'unset'};
    });

    function handleCancel() {
        props.onClose();
    }

    function handleGraduate() {
        props.graduatingBrother.status = "Alumnus";

        editBrother(props.graduatingBrother, props.graduatingBrother.id);
        handleCancel();
    }


    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalWrapper}>
                <div className={styles.modal}>
                    <div className={styles.modalHeader}>
                        <h2>Graduate Brother</h2>
                    </div>
                    <div className={styles.modalBody}>
                        <div className={styles.modalFieldContainer}>
                            <p>Are you sure you want to graduate Br. <b>{props.graduatingBrother.first_name} {props.graduatingBrother.last_name}</b>?</p>
                        </div>
                        <div className={styles.modalButtonRow}>
                            <Button className={styles.modalButtons} variant="contained" onClick={handleCancel}>Cancel</Button>
                            <Button className={styles.modalButtons} variant="contained" onClick={handleGraduate}>Graduate</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

}