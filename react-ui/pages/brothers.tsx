import BrotherTableComponent from "../components/brotherTable/brotherTable";
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import {useEffect, useState} from "react";
import AddBrotherModalComponent from "../components/addBrother/addBrother";
import {getAllBrothers} from "../services/brotherService";
import {IBrother} from "../interfaces/api.interface";
import {CircularProgress, Paper, Stack, Typography} from "@mui/material";
import EditBrotherModalComponent from "../components/editBrother/editBrother";
import GraduateBrotherModalComponent from "../components/graduateBrother/graduateBrother";
import { useAuth } from "../context/authContext";

export default function BrothersPage() {
    const { can } = useAuth();
    const canWrite = can("brothers.write");

    const [addModal, setAddModal] = useState(false);
    const [editingBrother, setEditingBrother] = useState(undefined);
    const [graduatingBrother, setGraduatingBrother] = useState(undefined);
    const [loading, setLoading] = useState(true);
    const [brothers, setBrothers] = useState(new Array<IBrother>);
    const [refreshTable, setRefreshTable] = useState(false);

    useEffect(() => {
        setLoading(true);
        getAllBrothers()
            .then(response => {
                let temp: Array<IBrother> = [];
                response.forEach(row => temp.push(row));
                setBrothers(temp);
            })
            .finally(() => setLoading(false));
    }, [refreshTable]);

    function onRefreshTable() {
        setRefreshTable(!refreshTable);
        setAddModal(false);
        setEditingBrother(undefined);
        setGraduatingBrother(undefined);
    }


    return (
        <>
            {canWrite && addModal && <AddBrotherModalComponent onClose={() => onRefreshTable()}></AddBrotherModalComponent>}
            {canWrite && editingBrother && <EditBrotherModalComponent newBrother={editingBrother} onClose={() => onRefreshTable()}></EditBrotherModalComponent>}
            {canWrite && graduatingBrother && <GraduateBrotherModalComponent graduatingBrother={graduatingBrother} onClose={() => onRefreshTable()}></GraduateBrotherModalComponent>}

            <Stack spacing={2} sx={{pointerEvents: addModal || editingBrother || graduatingBrother ? "none" : "auto"}}>
                <Paper elevation={0} sx={{p: 2, border: "1px solid", borderColor: "divider"}}>
                    <Stack direction={{xs: "column", sm: "row"}} spacing={2} alignItems={{sm: "center"}} justifyContent="space-between">
                        <div>
                            <Typography variant="h5">Brothers</Typography>
                            <Typography variant="body2" color="text.secondary">
                                Manage roster, contact info, and status.
                            </Typography>
                        </div>
                        {canWrite ? (
                          <Button variant="contained" onClick={() => { setAddModal(true); }}>
                              <AddIcon /> Add Brother
                          </Button>
                        ) : null}
                    </Stack>
                </Paper>

                {loading ? (
                    <CircularProgress />
                ) : (
                    <BrotherTableComponent
                      canWrite={canWrite}
                      setGraduatingBrother={setGraduatingBrother}
                      setEditingBrother={setEditingBrother}
                      data={brothers}
                    ></BrotherTableComponent>
                )}
            </Stack>
        </>
    )
}