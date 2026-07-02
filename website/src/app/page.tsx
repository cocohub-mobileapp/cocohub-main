import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

const FEATURES = [
  { icon: '🔒', title: 'Blockchain-Verified Records', desc: 'Every medical record is anchored on the Stellar blockchain — tamper-proof and verifiable by any vet, anywhere, instantly.' },
  { icon: '💊', title: 'Medication Reminders', desc: 'Smart notifications for doses and refills. Drug interaction detection. Refill tracking. Never miss a medication again.' },
  { icon: '📅', title: 'Appointment Management', desc: 'Book vet visits, detect scheduling conflicts, and sync to your device calendar automatically.' },
  { icon: '🚨', title: 'Emergency SOS', desc: 'One-tap alert to emergency contacts with your live GPS location. Works even when offline.' },
  { icon: '🩺', title: 'AI Symptom Checker', desc: 'Describe your pet\'s symptoms and get an instant urgency assessment, probable conditions, and next steps.' },
  { icon: '📊', title: 'Health Dashboard', desc: 'Visual health scoring, weight trends, breed-specific insights, and AI-powered predictive alerts.' },
  { icon: '📱', title: 'QR Code Scanner', desc: 'Scan any Cocohub QR code to instantly pull up records and vaccination history — no app needed on the vet\'s end.' },
  { icon: '🌐', title: 'Offline-First', desc: 'Full functionality without internet. Records sync automatically when connection is restored.' },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:8081';

const PHOTOS = [
  { src: 'https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=600&q=80&fit=crop', alt: 'Woman hugging golden retriever' },
  { src: 'https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=600&q=80&fit=crop', alt: 'Veterinarian examining a dog' },
  { src: 'https://images.unsplash.com/photo-1532710093739-9470acff878f?w=600&q=80&fit=crop', alt: 'Vet and owner with cat' },
  { src: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=600&q=80&fit=crop', alt: 'Family with their dog' },
  { src: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=600&q=80&fit=crop', alt: 'Owner caring for dog at home' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Create your pet\'s profile', desc: 'Add your pet\'s details, upload a photo, and enter their medical history in minutes.' },
  { step: '02', title: 'Log health & medications', desc: 'Track doses, book vet appointments, and log vitals. Everything syncs to the blockchain.' },
  { step: '03', title: 'Share with any vet', desc: 'Share a QR code or PDF health summary with any veterinarian — no account needed on their end.' },
];

export default function Home() {
  return (
    <main>
      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <div className={`container ${styles.navInner}`}>
          <Link href="/" className={styles.logo}>🐾 Cocohub</Link>
          <div className={styles.navLinks}>
            <Link href="#features">Features</Link>
            <Link href="#how-it-works">How it works</Link>
            <Link href="#waitlist">Get notified</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href={APP_URL} className={styles.navCta}>Open App →</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>Powered by Stellar Blockchain</div>
            <h1 className={styles.heroTitle}>
              Your pets deserve<br />
              <span className={styles.heroAccent}>the best care.</span>
            </h1>
            <p className={styles.heroSub}>
              Cocohub keeps every record, reminder, and vet visit in one secure place.
              Blockchain-verified. Offline-first. Built for pet owners who care.
            </p>
            <div className={styles.heroCtas}>
              <Link href="https://apps.apple.com/app/cocohub/id000000000" className={styles.ctaStore}>
                <span className={styles.ctaIcon}>🍎</span>
                <div>
                  <div className={styles.ctaSmall}>Download on the</div>
                  <div className={styles.ctaBig}>App Store</div>
                </div>
              </Link>
              <Link href="https://play.google.com/store/apps/details?id=app.cocohub.mobile" className={styles.ctaStore}>
                <span className={styles.ctaIcon}>▶</span>
                <div>
                  <div className={styles.ctaSmall}>Get it on</div>
                  <div className={styles.ctaBig}>Google Play</div>
                </div>
              </Link>
              <Link href={APP_URL} className={styles.ctaWeb}>
                Use on Web →
              </Link>
            </div>
            <p className={styles.heroNote}>Free to start · No credit card required</p>
          </div>

          <div className={styles.heroPhotoStack}>
            {PHOTOS.slice(0, 3).map((p, i) => (
              <div key={i} className={`${styles.photoCard} ${styles[`photoCard${i}`]}`}>
                <Image src={p.src} alt={p.alt} width={260} height={340} className={styles.photoImg} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className={styles.stats}>
        <div className="container">
          <div className={styles.statsGrid}>
            {[
              { num: '900M+', label: 'Pets worldwide' },
              { num: '75+', label: 'App screens' },
              { num: 'AES-256', label: 'Encryption' },
              { num: 'Free', label: 'To start' },
            ].map((s) => (
              <div key={s.label} className={styles.statItem}>
                <div className={styles.statNum}>{s.num}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Waitlist ── */}
      <section className={styles.waitlist} id="waitlist">
        <div className="container">
          <div className={styles.waitlistCard}>
            <div className={styles.waitlistBadge}>🐾 Early Access</div>
            <h2 className={styles.waitlistTitle}>Join the waitlist. Get notified when we launch.</h2>
            <p className={styles.waitlistSub}>Be first in line for early access, exclusive features, and a free premium trial when the app launches on the App Store and Google Play.</p>
            <form
              className={styles.waitlistForm}
              action="https://formspree.io/f/xpqgodnz"
              method="POST"
            >
              <input type="hidden" name="_subject" value="New Cocohub waitlist signup!" />
              <input type="hidden" name="_next" value="https://cocohub.app/?joined=1" />
              <input
                type="email"
                name="email"
                placeholder="your@email.com"
                required
                className={styles.waitlistInput}
              />
              <button type="submit" className={styles.waitlistBtn}>
                Notify me →
              </button>
            </form>
            <p className={styles.waitlistNote}>No spam. Unsubscribe anytime. We hate spam too.</p>
          </div>
        </div>
      </section>

      {/* ── Photo gallery ── */}
      <section className={styles.gallery}>
        <div className={styles.galleryTrack}>
          {[...PHOTOS, ...PHOTOS].map((p, i) => (
            <div key={i} className={styles.galleryItem}>
              <Image src={p.src} alt={p.alt} width={320} height={220} className={styles.galleryImg} />
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className={styles.features}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>FEATURES</div>
            <h2 className={styles.sectionTitle}>Everything your pet needs, in one place.</h2>
            <p className={styles.sectionSub}>Built for pet owners who take health seriously.</p>
          </div>
          <div className={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className={styles.howItWorks}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>HOW IT WORKS</div>
            <h2 className={styles.sectionTitle}>Up and running in minutes.</h2>
          </div>
          <div className={styles.stepsGrid}>
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className={styles.stepCard}>
                <div className={styles.stepNum}>{s.step}</div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Download CTA ── */}
      <section className={styles.download}>
        <div className="container">
          <div className={styles.downloadCard}>
            <div className={styles.downloadContent}>
              <h2 className={styles.downloadTitle}>Start protecting your pet's health today.</h2>
              <p className={styles.downloadSub}>Available on iOS, Android, and the web. Free to start.</p>
              <div className={styles.downloadCtas}>
                <Link href="https://apps.apple.com/app/cocohub/id000000000" className={styles.ctaStore}>
                  <span className={styles.ctaIcon}>🍎</span>
                  <div>
                    <div className={styles.ctaSmall}>Download on the</div>
                    <div className={styles.ctaBig}>App Store</div>
                  </div>
                </Link>
                <Link href="https://play.google.com/store/apps/details?id=app.cocohub.mobile" className={styles.ctaStore}>
                  <span className={styles.ctaIcon}>▶</span>
                  <div>
                    <div className={styles.ctaSmall}>Get it on</div>
                    <div className={styles.ctaBig}>Google Play</div>
                  </div>
                </Link>
                <Link href={APP_URL} className={styles.ctaWeb}>
                  Use on Web →
                </Link>
              </div>
            </div>
            <div className={styles.downloadPhotoWrap}>
              <Image
                src="https://images.unsplash.com/photo-1601758125946-6ec2ef64daf8?w=500&q=85&fit=crop"
                alt="Pet owner with dog"
                width={400}
                height={500}
                className={styles.downloadPhoto}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={`container ${styles.footerInner}`}>
          <div className={styles.footerBrand}>
            <Link href="/" className={styles.logo}>🐾 Cocohub</Link>
            <p className={styles.footerTagline}>Pet health, secured by blockchain.</p>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Product</div>
              <Link href="#features">Features</Link>
              <Link href="#how-it-works">How it works</Link>
              <Link href={APP_URL}>Web App</Link>
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Download</div>
              <Link href="https://apps.apple.com/app/cocohub/id000000000">App Store</Link>
              <Link href="https://play.google.com/store/apps/details?id=app.cocohub.mobile">Google Play</Link>
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Legal</div>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Support</div>
              <Link href="mailto:support@cocohub.app">support@cocohub.app</Link>
              <Link href="https://github.com/DogStark/Cocohub-MobileApp/issues">GitHub Issues</Link>
              <Link href="https://twitter.com/cocohubapp">@cocohubapp</Link>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <div className="container">
            <p>© 2026 Cocohub. All rights reserved. · Built with ❤️ for pet lovers · Powered by <a href="https://stellar.org" style={{color:'var(--coco-accent)'}}>Stellar</a></p>
            <p className={styles.footerDisclaimer}>Cocohub is not a substitute for professional veterinary care. Always consult a licensed veterinarian.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
