import {Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow} from "@mui/material";
import {useEffect} from "react";
import {getAllBrothers} from "../../services/brotherService";
import {IBrother} from "../../interfaces/api.interface";

export default function BrotherTableComponent() {

    let rows: Array<IBrother> = [];

    useEffect(() => {
        const getBrothers = () => {
            getAllBrothers().then(response => {
                response.map(row => {
                    rows.push(row);
                })
            })
        }

        getBrothers();
        console.log('rows:' + rows);
    }, []);

    return (
        <TableContainer component={Paper}>
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
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((row) => (
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
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    )
}