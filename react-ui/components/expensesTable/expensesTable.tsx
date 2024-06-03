import {
  IBrother,
  IBudgetItem,
  IExpense,
} from "../../interfaces/api.interface";
import styles from "./expensesTable.module.css";
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import { DataGrid, GridColDef, GridValueGetterParams } from "@mui/x-data-grid";

interface Props {
  expensesData: Array<IExpense>;
  brotherData: Array<IBrother>;
  budgetData: Array<IBudgetItem>;
}

export default function ExpensesTableComponent(props: Props) {
  function findPayeeName(expense: IExpense) {
    const brother = props.brotherData.find(
      (brother) => brother.id === expense.payee_id,
    );
    return brother?.first_name + " " + brother?.last_name;
  }

  function findBudgetItem(expense: IExpense) {
    const budgetItem = props.budgetData.find(
      (budgetItem) => budgetItem.id === expense.budget_id,
    );
    return budgetItem?.name;
  }

  const columns: GridColDef[] = [
    {
      field: "expense_date",
      headerName: "Expense Date",
      valueGetter: (params: GridValueGetterParams) =>
        params.row.expense_date.toDateString(),
    },
    {
      field: "payee",
      headerName: "Payee",
      valueGetter: (params: GridValueGetterParams) => findPayeeName(params.row),
    },
    { field: "item", headerName: "Item" },
    {
      field: "budget_item",
      headerName: "Budget Item",
      valueGetter: (params: GridValueGetterParams) =>
        findBudgetItem(params.row),
    },
    { field: "amount", headerName: "Amount" },
    {
      field: "paid",
      headerName: "Paid",
      valueGetter: (params: GridValueGetterParams) =>
        params.row.paid ? "Yes" : "No",
    },
    { field: "cheque_id", headerName: "Cheque No." },
    {
      field: "disbursement_date",
      headerName: "Disbursement Date",
      valueGetter: (params: GridValueGetterParams) =>
        params.row.disbursement_date.toDateString(),
    },
    {
      field: "receipt",
      headerName: "Receipt",
      valueGetter: (params: GridValueGetterParams) => "",
    },
  ];

  return (
    <div className={styles.tableWrapper}>
      <DataGrid
        rows={props.expensesData}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 20 },
          },
        }}
        pageSizeOptions={[20, 50]}
        checkboxSelection
      ></DataGrid>
      {/*<TableContainer component={Paper}>*/}
      {/*    <Table sx={{ minWidth: 650 }} aria-label="Expenses Table">*/}
      {/*        <TableHead>*/}
      {/*            <TableRow>*/}
      {/*                <TableCell>Expense Date</TableCell>*/}
      {/*                <TableCell align="right">Payee</TableCell>*/}
      {/*                <TableCell align="right">Item</TableCell>*/}
      {/*                <TableCell align="right">Budget Item</TableCell>*/}
      {/*                <TableCell align="right">Amount</TableCell>*/}
      {/*                <TableCell align="right">Paid</TableCell>*/}
      {/*                <TableCell align="right">Cheque No.</TableCell>*/}
      {/*                <TableCell align="right">Disbursement Date</TableCell>*/}
      {/*                <TableCell align="right">Receipt</TableCell>*/}
      {/*            </TableRow>*/}
      {/*        </TableHead>*/}
      {/*        <TableBody>*/}
      {/*            {props.expensesData.map((expense: IExpense) => (*/}
      {/*                <TableRow*/}
      {/*                    key={expense.id}*/}
      {/*                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}*/}
      {/*                >*/}
      {/*                    <TableCell component="th" scope="row">*/}
      {/*                        {new Date(expense.expense_date).toDateString()}*/}
      {/*                    </TableCell>*/}
      {/*                    <TableCell align="right">{findPayeeName(expense)}</TableCell>*/}
      {/*                    <TableCell align="right">{expense.item}</TableCell>*/}
      {/*                    <TableCell align="right">{findBudgetItem(expense)}</TableCell>*/}
      {/*                    <TableCell align="right">{expense.amount}</TableCell>*/}
      {/*                    <TableCell align="right">{expense.paid ? "Yes" : "No"}</TableCell>*/}
      {/*                    <TableCell align="right">{expense.paid ? "Yes" : "No"}</TableCell>*/}
      {/*                    <TableCell align="right">{expense.cheque_id}</TableCell>*/}
      {/*                    <TableCell align="right">{expense.disbursement_date.toDateString()}</TableCell>*/}
      {/*                    <TableCell align="right"></TableCell>*/}
      {/*                </TableRow>*/}
      {/*            ))}*/}
      {/*        </TableBody>*/}
      {/*    </Table>*/}
      {/*</TableContainer>*/}
    </div>
  );
}
