import styles from "./editBrother.module.css"
import Button from '@mui/material/Button';
import {FormControl, InputLabel, MenuItem, Select, TextField} from "@mui/material";
import {useEffect, useState} from "react";
import BrotherOptionsSchema from "../../interfaces/brotherOptions.schema";
import {editBrother} from "../../services/brotherService";
import {IBrother} from "../../interfaces/api.interface";

interface Props {
    newBrother: IBrother;
    onClose: any;
}

export default function EditBrotherModalComponent(props: Props) {

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [pledgeClass, setPledgeClass] = useState("");
    const [graduation, setGraduation] = useState(0);
    const [office, setOffice] = useState("");
    const [status, setStatus] = useState("");

    useEffect(() => {
        setFirstName(props.newBrother.first_name);
        setLastName(props.newBrother.last_name);
        setEmail(props.newBrother.email);
        setPhone(props.newBrother.phone);
        setPledgeClass(props.newBrother.pledge_class);
        setGraduation(props.newBrother.graduation);
        setOffice(props.newBrother.office);
        setStatus(props.newBrother.status);
        document.body.style.overflow = 'hidden';
        return ()=> {document.body.style.overflow = 'unset'};
    }, [])


    function handleCancel() {
        props.onClose();
    }

    function handleEdit() {
        const updatedBrother = {
            id: props.newBrother.id,
            first_name: firstName,
            last_name: lastName,
            email: email,
            phone: phone,
            pledge_class: pledgeClass,
            graduation: Number(graduation),
            office: office,
            status: status
        }

        editBrother(updatedBrother, props.newBrother.id);
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
                break;
            case "phone":
                setPhone(event.target.value)
                break;
            case "pledgeClass":
                setPledgeClass(event.target.value)
                break;
            case "graduation":
                setGraduation(event.target.value)
                break;
            case "office":
                setOffice(event.target.value)
                break;
            case "status":
                setStatus(event.target.value)
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
        <div className={styles.modalOverlay}>
            <div className={styles.modalWrapper}>
                <div className={styles.modal}>
                    <div className={styles.modalHeader}>
                        <h2>Edit Brother</h2>
                    </div>
                    <div className={styles.modalBody}>
                        <div className={styles.modalFieldContainer}>
                            <TextField
                                required
                                className={styles.modalFields}
                                label="First Name"
                                value={firstName}
                                onChange={(event) => handleFieldChange(event, "firstName")}
                            />
                            <TextField
                                required
                                className={styles.modalFields}
                                label="Last Name"
                                value={lastName}
                                onChange={(event) => handleFieldChange(event, "lastName")}
                            />
                            <TextField
                                required
                                className={styles.modalFields}
                                label="Email"
                                value={email}
                                onChange={(event) => handleFieldChange(event, "email")}
                            />
                            <TextField
                                required
                                className={styles.modalFields}
                                label="Phone"
                                value={phone}
                                onChange={(event) => handleFieldChange(event, "phone")}
                            />
                            <FormControl className={styles.modalFields}>
                                <InputLabel>Pledge Class</InputLabel>
                                <Select
                                    required
                                    label="Pledge Class"
                                    value={pledgeClass}
                                    onChange={(event) => handleFieldChange(event, "pledgeClass")}
                                >
                                    {generatePledgeClassOptions().map((pledgeClass) => (
                                        <MenuItem value={pledgeClass}>{pledgeClass}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                required
                                className={styles.modalFields}
                                label="Graduation"
                                value={graduation}
                                onChange={(event) => handleFieldChange(event, "graduation")}
                            />
                            <FormControl className={styles.modalFields}>
                                <InputLabel>Office</InputLabel>
                                <Select
                                    required
                                    label="Office"
                                    value={office}
                                    onChange={(event) => handleFieldChange(event, "office")}
                                >
                                    {BrotherOptionsSchema.offices.map((office) => (
                                        <MenuItem value={office}>{office}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl className={styles.modalFields}>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    required
                                    label="Status"
                                    value={status}
                                    onChange={(event) => handleFieldChange(event, "status")}
                                >
                                    {BrotherOptionsSchema.statuses.map((status) => (
                                        <MenuItem value={status}>{status}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </div>
                        <div className={styles.modalButtonRow}>
                            <Button className={styles.modalButtons} variant="contained" onClick={handleCancel}>Cancel</Button>
                            <Button className={styles.modalButtons} variant="contained" onClick={handleEdit}>Submit</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

}