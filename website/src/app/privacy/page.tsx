import Link from 'next/link';
import styles from './legal.module.css';

export const metadata = {
  title: 'Privacy Policy — Cocohub',
  description: 'How Cocohub collects, uses, and protects your data.',
};

export default function PrivacyPolicy() {
  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>🐾 Cocohub</Link>
        <Link href="https://app.cocohub.app" className={styles.navCta}>Open App →</Link>
      </nav>
      <main className={`container ${styles.content}`}>
        <div className={styles.breadcrumb}>
          <Link href="/" className={styles.breadcrumbLink}>Home</Link> / Privacy Policy
        </div>
        <h1 className={styles.pageTitle}>Privacy Policy</h1>
        <p className={styles.updated}>Last updated: July 1, 2026</p>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Introduction</h2>
          <p className={styles.body}>Cocohub (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information when you use the Cocohub mobile and web application.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Information We Collect</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}><span className={styles.bold}>Account information:</span> Name, email address, and password (hashed)</li>
            <li className={styles.listItem}><span className={styles.bold}>Pet data:</span> Pet profiles, medical records, medication schedules, and appointments you create</li>
            <li className={styles.listItem}><span className={styles.bold}>Device data:</span> Device type, OS, and app version for crash reporting</li>
            <li className={styles.listItem}><span className={styles.bold}>Location data:</span> Only when you use Emergency SOS — never stored persistently</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>3. How We Use Your Data</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>To provide and improve the Cocohub service</li>
            <li className={styles.listItem}>To anchor medical record hashes on the Stellar blockchain for verification</li>
            <li className={styles.listItem}>To send medication and appointment reminders you have configured</li>
            <li className={styles.listItem}>To provide emergency SOS location sharing when you initiate it</li>
          </ul>
          <p className={styles.body}>We <span className={styles.bold}>never sell your data</span> to third parties.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Data Security</h2>
          <p className={styles.body}>All sensitive data is encrypted at rest using AES-256. Authentication tokens are stored in your device&apos;s secure enclave (Keychain on iOS, SecureStore on Android). We use TLS 1.3 for all data in transit.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Blockchain Data</h2>
          <p className={styles.body}>Medical records are stored on our servers. Only a SHA-256 hash of each record is anchored on the Stellar blockchain — no personal information is ever written to the blockchain.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Your Rights (GDPR)</h2>
          <p className={styles.body}>You have the right to access, correct, export, or delete your data at any time. Use the Privacy Dashboard in the app, or email <a href="mailto:privacy@cocohub.app" className={styles.link}>privacy@cocohub.app</a>.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Contact</h2>
          <p className={styles.body}>Questions? Email <a href="mailto:privacy@cocohub.app" className={styles.link}>privacy@cocohub.app</a></p>
        </div>
      </main>
      <footer className={styles.footer}>
        <p>© 2026 Cocohub · <Link href="/privacy" className={styles.footerLink}>Privacy</Link> · <Link href="/terms" className={styles.footerLink}>Terms</Link></p>
      </footer>
    </div>
  );
}
