import '../app/globals.css'
import styles from "./brothers.module.css"
import HeaderComponent from "../components/header/header";
import BrotherTableComponent from "../components/brotherTable/brotherTable";
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import {useEffect, useState} from "react";
import AddBrotherModalComponent from "../components/addBrother/addBrother";
import {getAllBrothers} from "../services/brotherService";
import {IBrother} from "../interfaces/api.interface";
import {CircularProgress} from "@mui/material";
import EditBrotherModalComponent from "../components/editBrother/editBrother";
import GraduateBrotherModalComponent from "../components/graduateBrother/graduateBrother";

export default function BrothersPage() {

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


    // @ts-ignore
    return (
        <main className={styles.main}>
            {addModal && <AddBrotherModalComponent onClose={() => onRefreshTable()}></AddBrotherModalComponent>}
            {editingBrother && <EditBrotherModalComponent newBrother={editingBrother} onClose={() => onRefreshTable()}></EditBrotherModalComponent>}
            {graduatingBrother && <GraduateBrotherModalComponent graduatingBrother={graduatingBrother} onClose={() => onRefreshTable()}></GraduateBrotherModalComponent>}
            <div className={addModal || editingBrother || graduatingBrother ? styles.unclickable : styles.full}>
                <HeaderComponent headerText="Brothers"></HeaderComponent>
                {loading ? (<CircularProgress></CircularProgress>
                ) : <BrotherTableComponent setGraduatingBrother={setGraduatingBrother} setEditingBrother={setEditingBrother} data={brothers}></BrotherTableComponent>}
                <div className={styles.buttonWrapper}>
                    <Button className={styles.button} variant="outlined" onClick={() => {
                        setAddModal(true); window.scrollTo(0, 0);}
                    }><AddIcon></AddIcon>Add Brother</Button>
                </div>
            </div>
        </main>
    )
}