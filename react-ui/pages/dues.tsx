import "../app/globals.css";
import styles from "./brothers.module.css";
import HeaderComponent from "../components/header/header";
import DuesTable from "../components/duesTable/duesTable";
import { useEffect, useState } from "react";
import { IBrother, IDues } from "../interfaces/api.interface";
import { getDues } from "../services/duesService";
import { getAllBrothers } from "../services/brotherService";
import { CircularProgress } from "@mui/material";
import EditDuesComponentModal from "../components/editDues/editDues";

export default function DuesPage() {
  const [brothersLoading, setBrothersLoading] = useState(true);
  const [duesLoading, setDuesLoading] = useState(true);
  const [payingBrother, setPayingBrother] = useState(undefined);
  const [brothers, setBrothers] = useState(new Array<IBrother>());
  const [dues, setDues] = useState(new Array<IDues>());
  const [refreshTable, setRefreshTable] = useState(false);

  useEffect(() => {
    setBrothersLoading(true);
    setDuesLoading(true);
    getAllBrothers()
      .then((response) => {
        let temp: Array<IBrother> = [];
        response.forEach((row) => temp.push(row));
        setBrothers(temp);
      })
      .finally(() => setBrothersLoading(false));
    getDues()
      .then((response) => {
        let temp: Array<IDues> = [];
        response.forEach((row) => temp.push(row));
        setDues(temp);
      })
      .finally(() => setDuesLoading(false));
  }, [refreshTable]);

  function onRefreshTable() {
    setRefreshTable(!refreshTable);
    setPayingBrother(undefined);
  }

  return (
    <main className={styles.main}>
      <div className={styles.full}>
        <HeaderComponent headerText="Dues"></HeaderComponent>
        {payingBrother && (
          <EditDuesComponentModal
            duesRecord={payingBrother.dues}
            instalment={payingBrother.instalment}
            onClose={onRefreshTable}
          ></EditDuesComponentModal>
        )}
        {brothersLoading || duesLoading ? (
          <CircularProgress></CircularProgress>
        ) : (
          <DuesTable
            brothersData={brothers}
            duesData={dues}
            setPayingBrother={setPayingBrother}
          ></DuesTable>
        )}
      </div>
    </main>
  );
}
