import "../app/globals.css";
import RevenueToolbarComponent from "../components/revenueToolbar/revenueToolbar";
import { useEffect, useState } from "react";
import { getRevenueCategories } from "../services/revenueCategoryService";
import { IRevenue, IRevenueCategory } from "../interfaces/api.interface";
import { CircularProgress } from "@mui/material";
import styles from "./revenue.module.css";
import HeaderComponent from "../components/header/header";
import RevenueTableComponent from "../components/revenueTable/revenueTable";
import { getRevenue } from "../services/revenueService";

export default function RevenuePage() {
  const [revenueCategories, setRevenueCategories] = useState(
    new Array<IRevenueCategory>(),
  );
  const [revenueCategoriesLoading, setRevenueCategoriesLoading] =
    useState(false);

  const [revenue, setRevenue] = useState(new Array<IRevenue>());
  const [revenueLoading, setRevenueLoading] = useState(false);

  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    setRevenueCategoriesLoading(true);
    setRevenueLoading(true);
    getRevenueCategories()
      .then((response) => {
        setRevenueCategories(response);
      })
      .finally(() => setRevenueCategoriesLoading(false));

    getRevenue()
      .then((response) => {
        setRevenue(response);
      })
      .finally(() => setRevenueLoading(false));
  }, [refresh]);

  function onRefreshTable() {
    setRefresh(!refresh);
  }

  return (
    <main className={styles.main}>
      <HeaderComponent headerText="Revenue"></HeaderComponent>
      <div className={styles.contentContainer}>
        {revenueLoading ? (
          <CircularProgress></CircularProgress>
        ) : (
          <RevenueTableComponent
            revenueData={revenue}
            categoryData={revenueCategories}
          ></RevenueTableComponent>
        )}
        {revenueCategoriesLoading ? (
          <CircularProgress></CircularProgress>
        ) : (
          <RevenueToolbarComponent
            onRefresh={onRefreshTable}
            revenueCategories={revenueCategories}
          ></RevenueToolbarComponent>
        )}
      </div>
    </main>
  );
}
