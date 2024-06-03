import {IBrother, IRevenue, IRevenueCategory} from "../../interfaces/api.interface";
import styles from "./revenueTable.module.css";
import {Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow} from "@mui/material";

interface Props {
    revenueData: Array<IRevenue>
    categoryData: Array<IRevenueCategory>
}

export default function RevenueTableComponent(props: Props) {

    return (
        <div className={styles.tableWrapper}>
            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="Revenue Table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Date</TableCell>
                            <TableCell align="right">Revenue Description</TableCell>
                            <TableCell align="right">Revenue Category</TableCell>
                            <TableCell align="right">Amount</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {props.revenueData.map((revenue: IRevenue) => (
                            <TableRow
                                key={revenue.id}
                                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                            >
                                <TableCell component="th" scope="row">
                                    {new Date(revenue.date) .toDateString()}
                                </TableCell>
                                <TableCell align="right">{revenue.description}</TableCell>
                                <TableCell align="right">{props.categoryData.find((category) => category.id == revenue.category_id)?.name}</TableCell>
                                <TableCell align="right">${revenue.amount}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    )

}