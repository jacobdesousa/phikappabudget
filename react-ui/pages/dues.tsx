import '../src/app/globals.css'
import styles from "./dues.module.css"
import Image from "next/image";
import HeaderComponent from "../components/header/header";
import BrotherTableComponent from "../components/brotherTable/brotherTable";

export default function DuesPage() {
    return (
        <main className={styles.main}>
            <HeaderComponent headerText="Dues"></HeaderComponent>
            <BrotherTableComponent></BrotherTableComponent>
        </main>
    )
}