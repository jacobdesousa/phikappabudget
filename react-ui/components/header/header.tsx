import styles from "./header.module.css";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import Image from "next/image";
import Link from "next/link";

export default function HeaderComponent(props: any) {
  return (
    <div className={styles.header}>
      <div className={styles.header}>
        <Link href="/">
          <Image
            className={styles.logo}
            src="/pks.png"
            alt="PKS Logo"
            width={100}
            height={125}
            priority
          />
          <Image
            src="/alphabeta.png"
            alt="Alpha Beta Logo"
            className={styles.abLogo}
            width={100}
            height={100}
            priority
          />
        </Link>
        <h2 className={styles.headerText}>{props.headerText}</h2>
      </div>
      <div className={styles.buttons}>
        <Link href="/">
          <HomeOutlinedIcon sx={{ fontSize: 40 }} />
        </Link>
      </div>
    </div>
  );
}
