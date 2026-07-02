import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

const FEATURES = [
  { icon: '🔒', title: 'Blockchain-Verified Records', desc: 'Every medical record anchored on Stellar — tamper-proof, verifiable by any vet, anywhere.' },
  { icon: '💊', title: 'Medication Reminders', desc: 'Smart dose schedules, refill alerts, and drug interaction detection. Never miss a dose again.' },
  { icon: '📅', title: 'Appointment Management', desc: 'Book vet visits, detect conflicts, and sync to your device calendar automatically.' },
  { icon: '🚨', title: 'Emergency SOS', desc: 'One tap sends your live GPS location and pet details to all emergency contacts instantly.' },
  { icon: '🩺', title: 'AI Symptom Checker', desc: 'Describe symptoms, get instant urgency triage, probable conditions, and recommended next steps.' },
  { icon: '📊', title: 'Health Dashboard', desc: 'Visual health score, weight chart, breed-specific insights, and AI predictive alerts.' },
  { icon: '📱', title: 'QR Code Scanner', desc: 'Share your pet\'s full record via QR — any vet can scan it, no account needed.' },
  { icon: '🌐', title: 'Offline-First', desc: 'Everything works without internet. Records sync automatically when you reconnect.' },
];

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:8081';

// All pet-relevant photos — no barbershop, no unrelated content
const PHOTOS = [
  {
    src: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&q=85&fit=crop',
    alt: 'Golden retriever at vet checkup',
  },
  {
    src: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&q=85&fit=crop',
    alt: 'Dog being bathed and groomed',
  },
  {
    src: 'https://images.unsplash.com/photo-1548802673-380ab8ebc7b7?w=600&q=85&fit=crop',
    alt: 'Cat being examined by vet',
  },
  {
    src: 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=600&q=85&fit=crop',
    alt: 'Vet giving dog a vaccination',
  },
  {
    src: 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=600&q=85&fit=crop',
    alt: 'Happy dog with owner outdoors',
  },
  {
    src: 'https://images.unsplash.com/photo-1601758174493-45d0a4d2e2d8?w=600&q=85&fit=crop',
    alt: 'Cat being washed',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: '🐾',
    title: 'Create your pet\'s profile',
    desc: 'Add your pet\'s details, photo, and medical history. Supports dogs, cats, birds, rabbits, and 8 more species.',
  },
  {
    step: '02',
    icon: '💊',
    title: 'Log health & medications',
    desc: 'Track doses, book vet visits, and log vitals. Every record is automatically verified on the Stellar blockchain.',
  },
  {
    step: '03',
    icon: '📤',
    title: 'Share with any vet instantly',
    desc: 'Show a QR code or send a PDF health summary. Your vet sees everything — no account, no friction.',
  },
];

const TESTIMONIALS = [
  {
    quote: "Finally an app that keeps all my dog's records in one place. The QR share at the vet is a game changer.",
    name: 'Sarah M.',
    pet: 'Owner of Biscuit 🐕',
  },
  {
    quote: "The medication reminders have been a lifesaver. My cat never misses a dose now.",
    name: 'James K.',
    pet: 'Owner of Luna 🐈',
  },
  {
    quote: "I used the emergency SOS feature when my dog got hurt on a hike. It got help to us in minutes.",
    name: 'Priya R.',
    pet: 'Owner of Max 🐕',
  },
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
          </div>
          <Link href={APP_URL} className={styles.navCta} target="_blank" rel="noopener noreferrer">
            Open App →
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot} />
              Powered by Stellar Blockchain
            </div>
            <h1 className={styles.heroTitle}>
              Your pet&apos;s health<br />
              <span className={styles.heroAccent}>always with you.</span>
            </h1>
            <p className={styles.heroSub}>
              Cocohub is the secure health passport for your pet — records, medications,
              vet appointments and emergency SOS in one place. Blockchain-verified. Free to start.
            </p>
            <div className={styles.heroCtas}>
              <Link
                href={APP_URL}
                className={styles.ctaPrimary}
                target="_blank"
                rel="noopener noreferrer"
              >
                🌐 Use Web App — Free
              </Link>
              <Link href="#waitlist" className={styles.ctaSecondary}>
                Get the mobile app →
              </Link>
            </div>
            <p className={styles.heroNote}>
              ✓ Free forever &nbsp;·&nbsp; ✓ No credit card &nbsp;·&nbsp; ✓ Works offline
            </p>

            {/* Social proof row */}
            <div className={styles.socialProof}>
              <div className={styles.avatarRow}>
                {['🐕','🐈','🐇','🐦','🐕'].map((emoji, i) => (
                  <div key={i} className={styles.avatar}>{emoji}</div>
                ))}
              </div>
              <p className={styles.socialProofText}>
                Join pet owners already on the waitlist
              </p>
            </div>
          </div>

          {/* Photo stack — all pet-related */}
          <div className={styles.heroPhotoStack}>
            <div className={`${styles.photoCard} ${styles.photoCard0}`}>
              <Image src={PHOTOS[0].src} alt={PHOTOS[0].alt} width={260} height={340} className={styles.photoImg} priority />
              <div className={styles.photoCaption}>🩺 Vet visit</div>
            </div>
            <div className={`${styles.photoCard} ${styles.photoCard1}`}>
              <Image src={PHOTOS[1].src} alt={PHOTOS[1].alt} width={220} height={290} className={styles.photoImg} />
              <div className={styles.photoCaption}>🛁 Grooming</div>
            </div>
            <div className={`${styles.photoCard} ${styles.photoCard2}`}>
              <Image src={PHOTOS[2].src} alt={PHOTOS[2].alt} width={200} height={260} className={styles.photoImg} />
              <div className={styles.photoCaption}>😺 Health check</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <div className={styles.trustBar}>
        <div className="container">
          <div className={styles.trustGrid}>
            {[
              { icon: '🔒', text: 'AES-256 encrypted' },
              { icon: '⛓️', text: 'Stellar blockchain verified' },
              { icon: '📴', text: 'Works fully offline' },
              { icon: '🌍', text: 'GDPR compliant' },
              { icon: '🆓', text: 'Free to start' },
            ].map((t) => (
              <div key={t.text} className={styles.trustItem}>
                <span>{t.icon}</span>
                <span>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <section className={styles.stats}>
        <div className="container">
          <div className={styles.statsGrid}>
            {[
              { num: '900M+', label: 'Pets worldwide' },
              { num: '75+', label: 'App screens' },
              { num: '50+', label: 'API endpoints' },
              { num: '12', label: 'Species supported' },
            ].map((s) => (
              <div key={s.label} className={styles.statItem}>
                <div className={styles.statNum}>{s.num}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Photo gallery strip — all pets ── */}
      <section className={styles.gallery} aria-hidden="true">
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
            <p className={styles.sectionSub}>Built by pet owners, for pet owners who take health seriously.</p>
          </div>
          <div className={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIconWrap}>
                  <span className={styles.featureIcon}>{f.icon}</span>
                </div>
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
            <h2 className={styles.sectionTitle}>Up and running in 2 minutes.</h2>
            <p className={styles.sectionSub}>No setup. No paperwork. Just open the app and start.</p>
          </div>
          <div className={styles.stepsGrid}>
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.step} className={styles.stepCard}>
                <div className={styles.stepIconWrap}>{s.icon}</div>
                <div className={styles.stepNum}>{s.step}</div>
                <h3 className={styles.stepTitle}>{s.title}</h3>
                <p className={styles.stepDesc}>{s.desc}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className={styles.stepArrow}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className={styles.testimonials}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <div className={styles.sectionLabel}>TESTIMONIALS</div>
            <h2 className={styles.sectionTitle}>Pet owners love Cocohub.</h2>
          </div>
          <div className={styles.testimonialsGrid}>
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className={styles.testimonialCard}>
                <div className={styles.testimonialStars}>★★★★★</div>
                <p className={styles.testimonialQuote}>&ldquo;{t.quote}&rdquo;</p>
                <div className={styles.testimonialAuthor}>
                  <span className={styles.testimonialName}>{t.name}</span>
                  <span className={styles.testimonialPet}>{t.pet}</span>
                </div>
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
            <h2 className={styles.waitlistTitle}>Be first when we launch on mobile.</h2>
            <p className={styles.waitlistSub}>
              Sign up for early access to the iOS and Android apps. You&apos;ll get a
              free 3-month Premium trial when we launch.
            </p>
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
            <p className={styles.waitlistNote}>
              No spam. Unsubscribe anytime. Or &nbsp;
              <a href={APP_URL} target="_blank" rel="noopener noreferrer" className={styles.waitlistWebLink}>
                try the web app now →
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── Download CTA ── */}
      <section className={styles.download}>
        <div className="container">
          <div className={styles.downloadCard}>
            <div className={styles.downloadContent}>
              <div className={styles.sectionLabel}>GET STARTED FREE</div>
              <h2 className={styles.downloadTitle}>Start protecting your pet&apos;s health today.</h2>
              <p className={styles.downloadSub}>Available on web now. iOS and Android coming soon.</p>
              <div className={styles.downloadCtas}>
                <Link
                  href={APP_URL}
                  className={styles.ctaPrimary}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  🌐 Open Web App — Free
                </Link>
                <Link href="#waitlist" className={styles.ctaSecondary}>
                  📱 Get mobile app →
                </Link>
              </div>
            </div>
            <div className={styles.downloadPhotoWrap}>
              <Image
                src="https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=500&q=85&fit=crop"
                alt="Golden retriever at vet getting checked"
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
            <div className={styles.footerSocial}>
              <a href="https://twitter.com/cocohubapp" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>𝕏</a>
              <a href="https://github.com/cocohub-mobileapp/cocohub-main" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>GitHub</a>
            </div>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Product</div>
              <Link href="#features">Features</Link>
              <Link href="#how-it-works">How it works</Link>
              <a href={APP_URL} target="_blank" rel="noopener noreferrer">Web App</a>
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Download</div>
              <Link href="#waitlist">iOS (coming soon)</Link>
              <Link href="#waitlist">Android (coming soon)</Link>
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Open Source</div>
              <a href="https://github.com/cocohub-mobileapp/cocohub-main" target="_blank" rel="noopener noreferrer">GitHub</a>
              <a href="https://github.com/cocohub-mobileapp/cocohub-main/blob/main/BOUNTIES.md" target="_blank" rel="noopener noreferrer">Earn XLM</a>
            </div>
            <div className={styles.footerCol}>
              <div className={styles.footerColTitle}>Legal</div>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
              <a href="mailto:support@cocohub.app">Support</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <div className="container">
            <p>© 2026 Cocohub. All rights reserved. · Built with ❤️ for pet lovers · Powered by{' '}
              <a href="https://stellar.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--coco-accent)' }}>Stellar</a>
            </p>
            <p className={styles.footerDisclaimer}>Cocohub is not a substitute for professional veterinary care. Always consult a licensed veterinarian.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
