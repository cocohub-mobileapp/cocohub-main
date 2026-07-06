import Link from 'next/link';
import styles from '../privacy/legal.module.css';

export const metadata = {
  title: 'Terms of Service — Cocohub',
  description: 'Terms and conditions for using Cocohub.',
};

export default function Terms() {
  return (
    <div className={styles.root}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo}>🐾 Cocohub</Link>
        <Link href="https://app.cocohub.app" className={styles.navCta}>Open App →</Link>
      </nav>
      <main className={`container ${styles.content}`}>
        <div className={styles.breadcrumb}>
          <Link href="/" className={styles.breadcrumbLink}>Home</Link> / Terms of Service
        </div>
        <h1 className={styles.pageTitle}>Terms of Service</h1>
        <p className={styles.updated}>Last updated: July 1, 2026</p>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Acceptance of Terms</h2>
          <p className={styles.body}>By downloading, installing, or using Cocohub, you agree to be bound by these Terms of Service. If you do not agree, do not use the app.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Description of Service</h2>
          <p className={styles.body}>Cocohub provides a mobile and web application for pet owners to manage their pets&apos; medical records, medications, appointments, and emergency contacts. The service includes optional blockchain verification of medical record hashes via the Stellar network.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Not a Medical Service</h2>
          <p className={styles.body}><span className={styles.bold}>Cocohub is not a veterinary service and does not provide medical advice.</span> Always consult a licensed veterinarian for your pet&apos;s health decisions. Information in the app is for organizational and informational purposes only.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>4. User Accounts</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>You are responsible for maintaining the security of your account credentials</li>
            <li className={styles.listItem}>You must provide accurate information when creating an account</li>
            <li className={styles.listItem}>You may not share your account with others</li>
            <li className={styles.listItem}>You must be 16 years or older to create an account</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Your Data</h2>
          <p className={styles.body}>You own all data you enter into Cocohub. You can export or delete your data at any time via the Privacy Dashboard. See our <Link href="/privacy" className={styles.link}>Privacy Policy</Link> for full details.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Blockchain Records</h2>
          <p className={styles.body}>When you choose to verify a record on the Stellar blockchain, a SHA-256 hash of that record is permanently written to the public ledger. This action cannot be reversed. No personal information is stored on-chain.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Free and Premium Plans</h2>
          <p className={styles.body}>Cocohub offers a free tier (1 pet) and a Premium plan (unlimited pets). Premium subscriptions are billed monthly or annually. Cancellation takes effect at the end of the current billing period. No refunds for partial periods.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>8. Prohibited Use</h2>
          <ul className={styles.list}>
            <li className={styles.listItem}>Using the app to store data for commercial veterinary practices without a business agreement</li>
            <li className={styles.listItem}>Attempting to reverse-engineer, scrape, or access the API without authorization</li>
            <li className={styles.listItem}>Uploading false or fraudulent medical records</li>
          </ul>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>9. Limitation of Liability</h2>
          <p className={styles.body}>Cocohub is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from use or inability to use the service, including any pet health outcomes.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>10. Changes to Terms</h2>
          <p className={styles.body}>We may update these terms from time to time. We will notify you of significant changes via email or in-app notification. Continued use after changes constitutes acceptance.</p>
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>11. Contact</h2>
          <p className={styles.body}>Questions? Email <a href="mailto:legal@cocohub.app" className={styles.link}>legal@cocohub.app</a></p>
        </div>
      </main>
      <footer className={styles.footer}>
        <p>© 2026 Cocohub · <Link href="/privacy" className={styles.footerLink}>Privacy</Link> · <Link href="/terms" className={styles.footerLink}>Terms</Link></p>
      </footer>
    </div>
  );
}
