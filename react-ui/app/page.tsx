import Image from 'next/image'
import styles from './page.module.css'
import Link from "next/link";

export default function LandingPage() {
  return (
    <main className={styles.main}>
      <div className={styles.description}>
        <div>
            <Image
              src="/alphabeta.png"
              alt="Alpha Beta Logo"
              className={styles.abLogo}
              width={100}
              height={100}
              priority
            />
        </div>
      </div>

      <div className={styles.center}>
        <Image
          className={styles.logo}
          src="/pks.png"
          alt="PKS Logo"
          width={281}
          height={355}
          priority
        />
      </div>

      <div className={styles.grid}>
        <Link
            href="/brothers"
        >
          <h2>
            Brothers <span>-&gt;</span>
          </h2>
          <p>Brothers' information.</p>
        </Link>
      </div>
    </main>
  )
}
