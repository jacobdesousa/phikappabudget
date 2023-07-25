import {IBrother, IDues} from "../../interfaces/api.interface";
import styles from './duesTable.module.css';
import {Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow} from "@mui/material";

interface Props {
    brothersData: Array<IBrother>;
    duesData: Array<IDues>;
    setPayingBrother: any;
}

export default function DuesTable(props: Props) {

    function setDuesRecord(duesRecord?: IDues, instalment?: number) {
        props.setPayingBrother({dues: duesRecord, instalment: instalment});
    }

    function getDateDisplay(date?: Date): string {
        return date ? new Date(date).toDateString() : "";
    }

    return (
        <div className={styles.wrapper}>
            <TableContainer component={Paper} className={styles.table}>
                <Table sx={{ minWidth: 650 }} aria-label="Dues Table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Last Name</TableCell>
                            <TableCell align="right">First Name</TableCell>
                            <TableCell align="right">First Instalment</TableCell>
                            <TableCell align="right">Second Instalment</TableCell>
                            <TableCell align="right">Third Instalment</TableCell>
                            <TableCell align="right">Fourth Instalment</TableCell>

                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {props.brothersData.map((brother: IBrother) => (
                            <TableRow
                                key={brother.id}
                                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                            >
                                <TableCell component="th" scope="row">
                                    {brother.last_name}
                                </TableCell>
                                <TableCell align="right">{brother.first_name}</TableCell>
                                <TableCell className={styles.duesCell} align="right" onClick={() => setDuesRecord(props.duesData.find(duesEntry => duesEntry.id == brother.id), 1)}>{getDateDisplay(props.duesData.find(duesEntry => duesEntry.id == brother.id)?.first_instalment_date)} ${props.duesData.find(duesEntry => duesEntry.id == brother.id)?.first_instalment_amount}</TableCell>
                                <TableCell className={styles.duesCell} align="right" onClick={() => setDuesRecord(props.duesData.find(duesEntry => duesEntry.id == brother.id), 2)}>{getDateDisplay(props.duesData.find(duesEntry => duesEntry.id == brother.id)?.second_instalment_date)} ${props.duesData.find(duesEntry => duesEntry.id == brother.id)?.second_instalment_amount}</TableCell>
                                <TableCell className={styles.duesCell} align="right" onClick={() => setDuesRecord(props.duesData.find(duesEntry => duesEntry.id == brother.id), 3)}>{getDateDisplay(props.duesData.find(duesEntry => duesEntry.id == brother.id)?.third_instalment_date)} ${props.duesData.find(duesEntry => duesEntry.id == brother.id)?.third_instalment_amount}</TableCell>
                                <TableCell className={styles.duesCell} align="right" onClick={() => setDuesRecord(props.duesData.find(duesEntry => duesEntry.id == brother.id), 4)}>{getDateDisplay(props.duesData.find(duesEntry => duesEntry.id == brother.id)?.fourth_instalment_date)} ${props.duesData.find(duesEntry => duesEntry.id == brother.id)?.fourth_instalment_amount}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    )

}