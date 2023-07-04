import {IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow} from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import SchoolIcon from '@mui/icons-material/School';
import {IBrother} from "../../interfaces/api.interface";
import styles from "./brotherTable.module.css";

interface Props {
    data: Array<IBrother>;
    setEditingBrother: any;
    setGraduatingBrother: any;
}

export default function BrotherTableComponent(props: Props) {

    function setEditingBrother(brother: IBrother) {
        props.setEditingBrother(brother);
    }

    function graduateBrother(brother: IBrother) {
        props.setGraduatingBrother(brother);
    }

    return (
        <div className={styles.wrapper}>
            {(
                <TableContainer component={Paper} className={styles.table}>
                    <Table sx={{ minWidth: 650 }} aria-label="Brothers' Table">
                        <TableHead>
                            <TableRow>
                                <TableCell>Last Name</TableCell>
                                <TableCell align="right">First Name</TableCell>
                                <TableCell align="right">Email</TableCell>
                                <TableCell align="right">Phone</TableCell>
                                <TableCell align="right">Pledge Class</TableCell>
                                <TableCell align="right">Graduation</TableCell>
                                <TableCell align="right">Office</TableCell>
                                <TableCell align="right">Status</TableCell>
                                <TableCell align="right">Options</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {props.data.map((row: IBrother) => (
                                <TableRow
                                    key={row.id}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                >
                                    <TableCell component="th" scope="row">
                                        {row.last_name}
                                    </TableCell>
                                    <TableCell align="right">{row.first_name}</TableCell>
                                    <TableCell align="right">{row.email}</TableCell>
                                    <TableCell align="right">{row.phone}</TableCell>
                                    <TableCell align="right">{row.pledge_class}</TableCell>
                                    <TableCell align="right">{row.graduation}</TableCell>
                                    <TableCell align="right">{row.office}</TableCell>
                                    <TableCell align="right">{row.status}</TableCell>
                                    <TableCell align="right"><IconButton onClick={() => {setEditingBrother(row)}}><EditIcon></EditIcon></IconButton> {row.status != "Alumnus" ? <IconButton onClick={() => {graduateBrother(row)}}><SchoolIcon></SchoolIcon></IconButton> : <IconButton disabled><SchoolIcon></SchoolIcon></IconButton>}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                )}
        </div>
    )
}