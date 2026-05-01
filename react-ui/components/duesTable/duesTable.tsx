import {IBrother, IDuesPayment, IDuesSummaryRow} from "../../interfaces/api.interface";
import styles from './duesTable.module.css';
import {
    Box,
    Button,
    Collapse,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from "@mui/material";
import {useState} from "react";
import Tooltip from "@mui/material/Tooltip";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import IconButton from "@mui/material/IconButton";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { formatMoney } from "../../utils/money";

interface Props {
    brothersData: Array<IBrother>;
    summaryData: Array<IDuesSummaryRow>;
    paymentsByBrother: Record<number, Array<IDuesPayment>>;
    onExpandBrother: (brotherId: number) => void;
    onAddPayment: (brotherId: number, brotherName: string) => void;
    onEditPayment: (brotherId: number, payment: IDuesPayment) => void;
    onRequestDeletePayment: (brotherId: number, brotherName: string, payment: IDuesPayment) => void;
    canWrite?: boolean;
}

export default function DuesTable(props: Props) {

    const [open, setOpen] = useState<Record<number, boolean>>({});

    function getDateDisplay(date?: string | Date | null): string {
        if (!date) return "";
        return new Date(date).toDateString();
    }

    function getSummaryForBrother(brotherId?: number) {
        return props.summaryData.find(row => row.brother_id === brotherId);
    }

    function getPaymentsForBrother(brotherId?: number) {
        return brotherId ? (props.paymentsByBrother[brotherId] ?? []) : [];
    }

    function isPaidInFull(brotherId?: number) {
        const s = getSummaryForBrother(brotherId);
        const owed = Number(s?.total_owed ?? 0);
        const paid = Number(s?.total_paid ?? 0);
        if (!owed) return false;
        return paid >= owed;
    }

    function toggleRow(brotherId: number) {
        const next = !open[brotherId];
        setOpen(prev => ({...prev, [brotherId]: next}));
        if (next) props.onExpandBrother(brotherId);
    }

    return (
        <div className={styles.wrapper}>
            <TableContainer component={Paper} className={styles.table}>
                <Table sx={{ minWidth: 650 }} aria-label="Dues Table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Last Name</TableCell>
                            <TableCell align="right">First Name</TableCell>
                            <TableCell align="right">Owed (Year)</TableCell>
                            <TableCell align="right">Due To Date</TableCell>
                            <TableCell align="right">Total Paid</TableCell>
                            <TableCell align="right">Status</TableCell>
                            <TableCell align="right">Last Payment</TableCell>
                            <TableCell align="right">Actions</TableCell>

                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {props.brothersData.map((brother: IBrother) => (
                            <>
                                <TableRow
                                    key={brother.id}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    hover
                                    onClick={() => toggleRow(brother.id as number)}
                                    className={styles.duesCell}
                                    style={{
                                        backgroundColor: isPaidInFull(brother.id)
                                            ? "rgba(46, 125, 50, 0.10)"
                                            : getSummaryForBrother(brother.id)?.is_behind
                                                ? "rgba(211, 47, 47, 0.08)"
                                                : undefined
                                    }}
                                >
                                    <TableCell component="th" scope="row">
                                        {brother.last_name}
                                    </TableCell>
                                    <TableCell align="right">{brother.first_name}</TableCell>
                                    <TableCell align="right">
                                        ${formatMoney(getSummaryForBrother(brother.id)?.total_owed ?? 0)}
                                    </TableCell>
                                    <TableCell align="right">
                                        ${formatMoney(getSummaryForBrother(brother.id)?.due_to_date ?? 0)}
                                    </TableCell>
                                    <TableCell align="right">
                                        ${formatMoney(getSummaryForBrother(brother.id)?.total_paid ?? 0)}
                                    </TableCell>
                                    <TableCell align="right">
                                        {isPaidInFull(brother.id) ? (
                                            <Tooltip title="Paid in full">
                                                <CheckCircleOutlineIcon color="success" fontSize="small" />
                                            </Tooltip>
                                        ) : getSummaryForBrother(brother.id)?.is_behind ? (
                                                <Tooltip title="Behind on dues">
                                                    <WarningAmberIcon color="error" fontSize="small" />
                                                </Tooltip>
                                            ) : (
                                                ""
                                            )}
                                    </TableCell>
                                    <TableCell align="right">
                                        {getDateDisplay(getSummaryForBrother(brother.id)?.last_paid_at ?? null)}
                                    </TableCell>
                                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                        {props.canWrite ? (
                                          <Button
                                              variant="outlined"
                                              startIcon={<AddOutlinedIcon />}
                                              onClick={() => props.onAddPayment(brother.id as number, `${brother.first_name} ${brother.last_name}`)}
                                          >
                                              Add Payment
                                          </Button>
                                        ) : null}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                                        <Collapse in={Boolean(open[brother.id as number])} timeout="auto" unmountOnExit>
                                            <Box sx={{ margin: 2 }}>
                                                <h3>Payments</h3>
                                                <Table size="small" aria-label="payments">
                                                    <TableHead>
                                                        <TableRow>
                                                            <TableCell>Date</TableCell>
                                                            <TableCell>Amount</TableCell>
                                                            <TableCell>Memo</TableCell>
                                                            <TableCell align="right">Actions</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {getPaymentsForBrother(brother.id).length === 0 ? (
                                                            <TableRow>
                                                                <TableCell colSpan={4}>No payments yet.</TableCell>
                                                            </TableRow>
                                                        ) : (
                                                            getPaymentsForBrother(brother.id).map((p) => (
                                                                <TableRow key={p.id ?? `${p.brother_id}-${String(p.paid_at)}-${p.amount}`}>
                                                                    <TableCell>{getDateDisplay(p.paid_at)}</TableCell>
                                                                    <TableCell>${p.amount}</TableCell>
                                                                    <TableCell>{p.memo ?? ""}</TableCell>
                                                                    <TableCell align="right">
                                                                        {props.canWrite ? (
                                                                          <>
                                                                            <Tooltip title="Edit payment">
                                                                              <span>
                                                                                <IconButton
                                                                                  size="small"
                                                                                  disabled={!p.id}
                                                                                  onClick={() => props.onEditPayment(brother.id as number, p)}
                                                                                >
                                                                                  <EditOutlinedIcon fontSize="small" />
                                                                                </IconButton>
                                                                              </span>
                                                                            </Tooltip>
                                                                            <Tooltip title="Delete payment">
                                                                              <span>
                                                                                <IconButton
                                                                                  size="small"
                                                                                  color="error"
                                                                                  disabled={!p.id}
                                                                                  onClick={async () => {
                                                                                    props.onRequestDeletePayment(
                                                                                      brother.id as number,
                                                                                      `${brother.first_name} ${brother.last_name}`,
                                                                                      p
                                                                                    );
                                                                                  }}
                                                                                >
                                                                                  <DeleteOutlineIcon fontSize="small" />
                                                                                </IconButton>
                                                                              </span>
                                                                            </Tooltip>
                                                                          </>
                                                                        ) : null}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </Box>
                                        </Collapse>
                                    </TableCell>
                                </TableRow>
                            </>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </div>
    )

}