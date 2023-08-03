import '../app/globals.css'
import RevenueToolbarComponent from "../components/revenueToolbar/revenueToolbar";
import {useEffect, useState} from "react";
import {getRevenueCategories} from "../services/revenueCategoryService";
import {IRevenueCategory} from "../interfaces/api.interface";
import {CircularProgress} from "@mui/material";
import styles from "./brothers.module.css";
import HeaderComponent from "../components/header/header";

export default function RevenuePage() {

    const [revenueCategories, setRevenueCategories] = useState(new Array<IRevenueCategory>);
    const [revenueCategoriesLoading, setRevenueCategoriesLoading] = useState(false);

    useEffect(() => {
        setRevenueCategoriesLoading(true);
        getRevenueCategories()
            .then(response => {
                let temp: Array<IRevenueCategory> = [];
                response.forEach(row => temp.push(row));
                setRevenueCategories(temp);
        }).finally(() => setRevenueCategoriesLoading(false))
    }, []);

    return (
        <main className={styles.main}>
            <HeaderComponent headerText="Revenue"></HeaderComponent>
            <div className={styles.tableWrapper}>
                <h1>Test</h1>
            </div>
            <div className={styles.toolbar}>
                {revenueCategoriesLoading ? (<CircularProgress></CircularProgress>
                    ) : <RevenueToolbarComponent revenueCategories={revenueCategories}></RevenueToolbarComponent>
                }
            </div>
        </main>
    )

}