import { Box, Chip, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import EditIcon from '@mui/icons-material/Edit';
import SchoolIcon from '@mui/icons-material/School';
import {IBrother} from "../../interfaces/api.interface";

interface Props {
    data: Array<IBrother>;
    setEditingBrother: any;
    setGraduatingBrother: any;
    canWrite?: boolean;
}

export default function BrotherTableComponent(props: Props) {

    function setEditingBrother(brother: IBrother) {
        props.setEditingBrother(brother);
    }

    function graduateBrother(brother: IBrother) {
        props.setGraduatingBrother(brother);
    }

    return (
        <Box sx={{ width: "100%" }}>
            {/* Mobile card layout */}
            <Stack spacing={1} sx={{ display: { xs: "flex", md: "none" } }}>
                {props.data.map((row: IBrother) => (
                    <Paper key={row.id} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                    {row.first_name} {row.last_name}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">{row.email}</Typography>
                                {row.phone ? <Typography variant="body2" color="text.secondary">{row.phone}</Typography> : null}
                                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} flexWrap="wrap">
                                    <Chip label={row.status ?? "—"} size="small" />
                                    {(row.current_offices ?? []).map((o) => (
                                        <Chip key={o.display_name} label={o.display_name} size="small" variant="outlined" />
                                    ))}
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                    {row.pledge_class ? `PC ${row.pledge_class}` : ""}{row.graduation ? ` · Grad ${row.graduation}` : ""}
                                </Typography>
                            </Box>
                            {props.canWrite ? (
                                <Stack direction="row">
                                    <IconButton size="small" onClick={() => setEditingBrother(row)}><EditIcon fontSize="small" /></IconButton>
                                    <IconButton size="small" onClick={() => graduateBrother(row)} disabled={row.status === "Alumnus"}><SchoolIcon fontSize="small" /></IconButton>
                                </Stack>
                            ) : null}
                        </Stack>
                    </Paper>
                ))}
            </Stack>

            {/* Desktop table layout */}
            <TableContainer component={Paper} sx={{ display: { xs: "none", md: "block" }, overflowX: "auto", width: "100%" }}>
                <Table sx={{ minWidth: 650 }} aria-label="Brothers Table">
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
                            <TableRow key={row.id} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                <TableCell component="th" scope="row">{row.last_name}</TableCell>
                                <TableCell align="right">{row.first_name}</TableCell>
                                <TableCell align="right">{row.email}</TableCell>
                                <TableCell align="right">{row.phone}</TableCell>
                                <TableCell align="right">{row.pledge_class}</TableCell>
                                <TableCell align="right">{row.graduation}</TableCell>
                                <TableCell align="right">
                                    {(row.current_offices ?? []).map((o) => o.display_name).join(", ") || (row.office ?? "—")}
                                </TableCell>
                                <TableCell align="right">{row.status}</TableCell>
                                <TableCell align="right">
                                    {props.canWrite ? (
                                        <>
                                            <IconButton onClick={() => setEditingBrother(row)}><EditIcon /></IconButton>
                                            {row.status != "Alumnus" ? (
                                                <IconButton onClick={() => graduateBrother(row)}><SchoolIcon /></IconButton>
                                            ) : (
                                                <IconButton disabled><SchoolIcon /></IconButton>
                                            )}
                                        </>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
