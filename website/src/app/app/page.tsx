'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

// ── Types ──────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';

interface User { id: string; name: string; email: string; role: string; }
interface Pet {
  id: string; name: string; species: string; breed?: string;
  dateOfBirth?: string; weightKg?: number; photoUrl?: string;
}

type Screen = 'login' | 'register' | 'dashboard' | 'pets' | 'care' | 'appointments';

const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐕', cat: '🐈', bird: '🐦', rabbit: '🐇',
  hamster: '🐹', guinea_pig: '🐾', fish: '🐠',
  reptile: '🦎', horse: '🐴', ferret: '🦔', turtle: '🐢', other: '🐾',
};

const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'pets',      icon: '🐾', label: 'My Pets' },
  { id: 'care',      icon: '💊', label: 'Care' },
  { id: 'appointments', icon: '📅', label: 'Appointments' },
];

const DEMO_PETS: Pet[] = [
  { id: 'p1', name: 'Max', species: 'dog', breed: 'Labrador', weightKg: 28, dateOfBirth: '2020-03-15' },
  { id: 'p2', name: 'Luna', species: 'cat', breed: 'British Shorthair', weightKg: 4.5 },
  { id: 'p3', name: 'Fluffy', species: 'rabbit', breed: 'Holland Lop', weightKg: 1.8 },
];
function LoginForm({ onLogin, onSwitch }: { onLogin: (u: User, t: string) => void; onSwitch: () => void }) {
  const [email, setEmail] = useState('owner1@example.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      // Demo mode — works without backend running
      if (email === 'owner1@example.com' && password === 'Password123!') {
        onLogin(
          { id: 'demo-1', name: 'Demo User', email: 'owner1@example.com', role: 'owner' },
          'demo-token'
        );
        return;
      }
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Login failed');
      onLogin(data.user ?? data.data?.user, data.token ?? data.data?.token);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      if (msg.includes('fetch') || msg.includes('network') || msg.toLowerCase().includes('failed to fetch')) {
        // Backend not running — offer demo mode
        setError('Backend offline. Use demo credentials: owner1@example.com / Password123!');
      } else {
        setError(msg);
      }
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.authWrap}>
      <div className={styles.authLeft}>
        <div className={styles.authLogo}>🐾 Cocohub</div>
        <h1 className={styles.authTitle}>Welcome back</h1>
        <p className={styles.authSub}>Sign in to manage your pet&apos;s health records.</p>
        <form className={styles.authForm} onSubmit={submit}>
          {error && <div className={styles.authError}>{error}</div>}
          <div><div className={styles.fieldLabel}>Email</div>
            <input className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" /></div>
          <div><div className={styles.fieldLabel}>Password</div>
            <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Your password" /></div>
          <button className={styles.submitBtn} disabled={loading}>{loading ? 'Signing in…' : 'Sign in →'}</button>
        </form>
        <p className={styles.authSwitch}>No account? <a onClick={onSwitch}>Create one free</a></p>
        <p style={{ fontSize: 12, color: '#666', marginTop: 16 }}>
          Demo: owner1@example.com / Password123!
        </p>
      </div>
      <div className={styles.authRight}>
        <div className={styles.authFeatureList}>
          {[
            { icon: '🔒', title: 'Blockchain-verified records', desc: 'Every record anchored on Stellar — tamper-proof forever.' },
            { icon: '💊', title: 'Smart medication reminders', desc: 'Never miss a dose. Drug interaction detection built in.' },
            { icon: '🚨', title: 'Emergency SOS', desc: 'One tap sends your location to all emergency contacts.' },
            { icon: '🩺', title: 'AI symptom checker', desc: 'Describe symptoms, get instant triage and next steps.' },
          ].map(f => (
            <div key={f.title} className={styles.authFeatureItem}>
              <span className={styles.authFeatureIcon}>{f.icon}</span>
              <div className={styles.authFeatureText}><strong>{f.title}</strong>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RegisterForm({ onLogin, onSwitch }: { onLogin: (u: User, t: string) => void; onSwitch: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Registration failed');
      onLogin(data.user ?? data.data?.user, data.token ?? data.data?.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.authWrap}>
      <div className={styles.authLeft}>
        <div className={styles.authLogo}>🐾 Cocohub</div>
        <h1 className={styles.authTitle}>Create account</h1>
        <p className={styles.authSub}>Free forever. No credit card required.</p>
        <form className={styles.authForm} onSubmit={submit}>
          {error && <div className={styles.authError}>{error}</div>}
          <div><div className={styles.fieldLabel}>Full name</div>
            <input className={styles.input} value={name} onChange={e => setName(e.target.value)} required placeholder="Your name" /></div>
          <div><div className={styles.fieldLabel}>Email</div>
            <input className={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" /></div>
          <div><div className={styles.fieldLabel}>Password</div>
            <input className={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 8 characters" /></div>
          <button className={styles.submitBtn} disabled={loading}>{loading ? 'Creating account…' : 'Create account →'}</button>
        </form>
        <p className={styles.authSwitch}>Already have an account? <a onClick={onSwitch}>Sign in</a></p>
      </div>
      <div className={styles.authRight}>
        <div className={styles.authFeatureList}>
          {[
            { icon: '🐕', title: '12 species supported', desc: 'Dogs, cats, birds, rabbits, reptiles and more.' },
            { icon: '🌐', title: 'Works fully offline', desc: 'All your data available even without internet.' },
            { icon: '🔐', title: 'Privacy-first', desc: 'AES-256 encryption. GDPR compliant. Your data is yours.' },
            { icon: '💰', title: 'Free to start', desc: 'Manage 1 pet free forever. Upgrade for unlimited.' },
          ].map(f => (
            <div key={f.title} className={styles.authFeatureItem}>
              <span className={styles.authFeatureIcon}>{f.icon}</span>
              <div className={styles.authFeatureText}><strong>{f.title}</strong>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── App Shell ──────────────────────────────────────────────────────────
function AppShell({ user, token, screen, setScreen, onLogout, children }: {
  user: User; token: string; screen: Screen;
  setScreen: (s: Screen) => void; onLogout: () => void; children: React.ReactNode;
}) {
  const screenTitles: Record<Screen, string> = {
    login: '', register: '',
    dashboard: 'Dashboard', pets: 'My Pets',
    care: 'Care', appointments: 'Appointments',
  };
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>🐾 Cocohub</div>
        <nav className={styles.sidebarNav}>
          {NAV.map(n => (
            <button key={n.id} className={`${styles.sidebarLink} ${screen === n.id ? styles.sidebarLinkActive : ''}`}
              onClick={() => setScreen(n.id as Screen)}>
              <span className={styles.sidebarIcon}>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <button className={styles.sidebarLink} onClick={onLogout}>
            <span className={styles.sidebarIcon}>🚪</span>Sign out
          </button>
        </div>
      </aside>
      <div className={styles.main}>
        <div className={styles.topbar}>
          <span className={styles.topbarTitle}>{screenTitles[screen]}</span>
          <div className={styles.topbarRight}>
            {token === 'demo-token' && (
              <span style={{ background: 'rgba(200,133,74,0.15)', color: '#C8854A', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(200,133,74,0.3)' }}>
                DEMO MODE
              </span>
            )}
            <span style={{ fontSize: 13, color: '#A89880' }}>👋 {user.name}</span>
          </div>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}

// ── Dashboard screen ────────────────────────────────────────────────────
function Dashboard({ user, token }: { user: User; token: string }) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token === 'demo-token') { setPets(DEMO_PETS); setLoading(false); return; }
    fetch(`${API}/pets`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setPets(d.data?.pets ?? d.data ?? []); setLoading(false); })
      .catch(() => { setPets(DEMO_PETS); setLoading(false); });
  }, [token]);

  const ACTIVITY = [
    { text: 'Medication reminder: Fluffy — Amoxicillin due', time: '2h ago' },
    { text: 'Appointment scheduled: Dr. Smith on July 10', time: '1d ago' },
    { text: 'Record verified on Stellar blockchain', time: '2d ago' },
    { text: 'Vaccination updated: Rabies — Max', time: '3d ago' },
  ];

  return (
    <>
      <h1 className={styles.pageTitle}>Good day, {user.name.split(' ')[0]} 👋</h1>
      <div className={styles.statsRow}>
        {[
          { icon: '🐾', num: loading ? '…' : pets.length, label: 'Pets' },
          { icon: '💊', num: '3', label: 'Active meds' },
          { icon: '📅', num: '1', label: 'Upcoming appts' },
          { icon: '✅', num: '12', label: 'Records logged' },
        ].map(s => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statCardIcon}>{s.icon}</div>
            <div className={styles.statCardNum}>{s.num}</div>
            <div className={styles.statCardLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className={styles.quickActions}>
        {[
          { icon: '➕', label: 'Add pet' },
          { icon: '💊', label: 'Log dose' },
          { icon: '📅', label: 'Book appointment' },
          { icon: '🚨', label: 'Emergency SOS' },
          { icon: '📱', label: 'Scan QR' },
        ].map(a => (
          <button key={a.label} className={styles.quickAction}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <div className={styles.sectionTitle}>Your pets</div>
          {loading ? <div className={styles.spinner}>Loading pets…</div> :
            pets.length === 0 ? (
              <div className={styles.card} style={{ textAlign: 'center', padding: 32, color: '#A89880' }}>
                No pets yet. Add your first pet to get started. 🐾
              </div>
            ) : (
              <div className={styles.petsGrid}>
                {pets.slice(0, 4).map(p => (
                  <div key={p.id} className={styles.petCard}>
                    <div className={styles.petCardEmoji}>{SPECIES_EMOJI[p.species] ?? '🐾'}</div>
                    <div className={styles.petCardName}>{p.name}</div>
                    <div className={styles.petCardBreed}>{p.breed ?? p.species}</div>
                    <span className={styles.petCardBadge}>Healthy</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
        <div>
          <div className={styles.sectionTitle}>Recent activity</div>
          <div className={styles.card}>
            <div className={styles.activityList}>
              {ACTIVITY.map((a, i) => (
                <div key={i} className={styles.activityItem}>
                  <div className={styles.activityDot} />
                  <div className={styles.activityText}>{a.text}</div>
                  <div className={styles.activityTime}>{a.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Pets screen ──────────────────────────────────────────────────────────
function PetsScreen({ token }: { token: string }) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', species: 'dog', breed: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    if (token === 'demo-token') { setPets(DEMO_PETS); setLoading(false); return; }
    fetch(`${API}/pets`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setPets(d.data?.pets ?? d.data ?? []); setLoading(false); })
      .catch(() => { setPets(DEMO_PETS); setLoading(false); });
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (token === 'demo-token') {
        setPets(p => [...p, { id: `demo-${Date.now()}`, ...form }]);
        setShowForm(false); setForm({ name: '', species: 'dog', breed: '' }); setSaving(false); return;
      }
      const res = await fetch(`${API}/pets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Failed to add pet');
      setShowForm(false); setForm({ name: '', species: 'dog', breed: '' }); load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add pet');
    } finally { setSaving(false); }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>My Pets</h1>
        <button className={styles.submitBtn} style={{ width: 'auto', padding: '10px 20px', margin: 0 }}
          onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Pet'}
        </button>
      </div>

      {showForm && (
        <div className={styles.card} style={{ marginBottom: 24 }}>
          <div className={styles.sectionTitle}>Add a new pet</div>
          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 400 }}>
            {error && <div className={styles.authError}>{error}</div>}
            <div><div className={styles.fieldLabel}>Name *</div>
              <input className={styles.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Buddy" /></div>
            <div><div className={styles.fieldLabel}>Species *</div>
              <select className={styles.input} value={form.species} onChange={e => setForm(f => ({ ...f, species: e.target.value }))}>
                {Object.entries(SPECIES_EMOJI).map(([v, emoji]) => (
                  <option key={v} value={v}>{emoji} {v.replace('_', ' ')}</option>
                ))}
              </select></div>
            <div><div className={styles.fieldLabel}>Breed</div>
              <input className={styles.input} value={form.breed} onChange={e => setForm(f => ({ ...f, breed: e.target.value }))} placeholder="e.g. Labrador" /></div>
            <button className={styles.submitBtn} style={{ width: 'auto', alignSelf: 'flex-start', padding: '11px 24px' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save Pet'}
            </button>
          </form>
        </div>
      )}

      {loading ? <div className={styles.spinner}>Loading pets…</div> :
        pets.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>🐾</div>
            <div className={styles.emptyStateTitle}>No pets yet</div>
            <div className={styles.emptyStateText}>Add your first pet to start tracking their health records, medications, and appointments.</div>
            <button className={styles.emptyStateBtn} onClick={() => setShowForm(true)}>Add your first pet →</button>
          </div>
        ) : (
          <div className={styles.petsGrid}>
            {pets.map(p => (
              <div key={p.id} className={styles.petCard}>
                <div className={styles.petCardEmoji}>{SPECIES_EMOJI[p.species] ?? '🐾'}</div>
                <div className={styles.petCardName}>{p.name}</div>
                <div className={styles.petCardBreed}>{p.breed ?? p.species}</div>
                {p.weightKg && <div className={styles.petCardBreed} style={{ marginTop: 4 }}>{p.weightKg} kg</div>}
                <span className={styles.petCardBadge}>Active</span>
              </div>
            ))}
          </div>
        )
      }
    </>
  );
}

// ── Care screen ──────────────────────────────────────────────────────────
function CareScreen({ token }: { token: string }) {
  const MEDS = [
    { name: 'Amoxicillin', pet: 'Fluffy', dose: '50mg', freq: 'Every 8h', status: 'Active', next: 'In 2 hours' },
    { name: 'Flea treatment', pet: 'Max', dose: '1 tablet', freq: 'Monthly', status: 'Active', next: 'In 12 days' },
    { name: 'Vitamin D', pet: 'Luna', dose: '200IU', freq: 'Daily', status: 'Paused', next: '—' },
  ];
  const VACCINES = [
    { name: 'Rabies', pet: 'Max', date: '2025-06-01', due: '2026-06-01', status: 'Valid' },
    { name: 'FVRCP', pet: 'Luna', date: '2025-03-15', due: '2026-03-15', status: 'Valid' },
    { name: 'Bordetella', pet: 'Fluffy', date: '2024-12-01', due: '2025-12-01', status: 'Due soon' },
  ];

  return (
    <>
      <h1 className={styles.pageTitle}>Care</h1>
      <div className={styles.sectionTitle}>💊 Medications</div>
      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#1e1e1e', borderBottom: '1px solid #2a2a2a' }}>
              {['Medication', 'Pet', 'Dose', 'Frequency', 'Next dose', 'Status'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#A89880', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEDS.map((m, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '14px 16px', fontWeight: 600 }}>{m.name}</td>
                <td style={{ padding: '14px 16px', color: '#A89880' }}>{m.pet}</td>
                <td style={{ padding: '14px 16px', color: '#A89880' }}>{m.dose}</td>
                <td style={{ padding: '14px 16px', color: '#A89880' }}>{m.freq}</td>
                <td style={{ padding: '14px 16px', color: '#C8854A' }}>{m.next}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ background: m.status === 'Active' ? 'rgba(76,175,80,0.15)' : 'rgba(107,114,128,0.2)', color: m.status === 'Active' ? '#4CAF50' : '#9CA3AF', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{m.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 28 }}>💉 Vaccinations</div>
      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#1e1e1e', borderBottom: '1px solid #2a2a2a' }}>
              {['Vaccine', 'Pet', 'Last given', 'Due date', 'Status'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#A89880', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VACCINES.map((v, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '14px 16px', fontWeight: 600 }}>{v.name}</td>
                <td style={{ padding: '14px 16px', color: '#A89880' }}>{v.pet}</td>
                <td style={{ padding: '14px 16px', color: '#A89880' }}>{v.date}</td>
                <td style={{ padding: '14px 16px', color: '#A89880' }}>{v.due}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ background: v.status === 'Valid' ? 'rgba(76,175,80,0.15)' : 'rgba(239,68,68,0.15)', color: v.status === 'Valid' ? '#4CAF50' : '#FCA5A5', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{v.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Appointments screen ──────────────────────────────────────────────────
function AppointmentsScreen({ token }: { token: string }) {
  const APPTS = [
    { type: 'Annual Checkup', pet: 'Max', vet: 'Dr. Smith', date: 'July 10, 2026', time: '10:00 AM', status: 'Confirmed' },
    { type: 'Dental Cleaning', pet: 'Luna', vet: 'Dr. Patel', date: 'July 18, 2026', time: '2:30 PM', status: 'Pending' },
    { type: 'Vaccination', pet: 'Fluffy', vet: 'Dr. Chen', date: 'Aug 3, 2026', time: '9:00 AM', status: 'Confirmed' },
  ];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 className={styles.pageTitle} style={{ margin: 0 }}>Appointments</h1>
        <button className={styles.submitBtn} style={{ width: 'auto', padding: '10px 20px', margin: 0 }}>+ Schedule</button>
      </div>
      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#1e1e1e', borderBottom: '1px solid #2a2a2a' }}>
              {['Type', 'Pet', 'Veterinarian', 'Date', 'Time', 'Status'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#A89880', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {APPTS.map((a, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #2a2a2a' }}>
                <td style={{ padding: '14px 16px', fontWeight: 600 }}>{a.type}</td>
                <td style={{ padding: '14px 16px', color: '#A89880' }}>{a.pet}</td>
                <td style={{ padding: '14px 16px', color: '#A89880' }}>{a.vet}</td>
                <td style={{ padding: '14px 16px', color: '#C8854A', fontWeight: 600 }}>{a.date}</td>
                <td style={{ padding: '14px 16px', color: '#A89880' }}>{a.time}</td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ background: a.status === 'Confirmed' ? 'rgba(76,175,80,0.15)' : 'rgba(200,133,74,0.15)', color: a.status === 'Confirmed' ? '#4CAF50' : '#C8854A', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{a.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.card} style={{ marginTop: 20, textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Calendar sync</div>
        <div style={{ fontSize: 13, color: '#A89880', marginBottom: 16 }}>Sync all your pet appointments to Google Calendar or Apple Calendar.</div>
        <button className={styles.submitBtn} style={{ width: 'auto', padding: '10px 20px', margin: '0 auto' }}>Connect Calendar</button>
      </div>
    </>
  );
}

// ── Main export ──────────────────────────────────────────────────────────
export default function AppPage() {
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [screen, setScreen] = useState<Screen>('dashboard');

  // Persist session in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cocohub_session');
      if (saved) {
        const { user: u, token: t } = JSON.parse(saved);
        setUser(u); setToken(t);
      }
    } catch { /* ignore */ }
  }, []);

  const handleLogin = (u: User, t: string) => {
    setUser(u); setToken(t);
    try { localStorage.setItem('cocohub_session', JSON.stringify({ user: u, token: t })); } catch { /* ignore */ }
  };

  const handleLogout = () => {
    setUser(null); setToken(''); setScreen('dashboard');
    try { localStorage.removeItem('cocohub_session'); } catch { /* ignore */ }
  };

  // Not logged in — show auth
  if (!user) {
    return (
      <div className={styles.root}>
        {authScreen === 'login'
          ? <LoginForm onLogin={handleLogin} onSwitch={() => setAuthScreen('register')} />
          : <RegisterForm onLogin={handleLogin} onSwitch={() => setAuthScreen('login')} />
        }
      </div>
    );
  }

  // Logged in — show app shell
  const renderScreen = () => {
    switch (screen) {
      case 'dashboard':    return <Dashboard user={user} token={token} />;
      case 'pets':         return <PetsScreen token={token} />;
      case 'care':         return <CareScreen token={token} />;
      case 'appointments': return <AppointmentsScreen token={token} />;
      default:             return <Dashboard user={user} token={token} />;
    }
  };

  return (
    <div className={styles.root}>
      <AppShell user={user} token={token} screen={screen} setScreen={setScreen} onLogout={handleLogout}>
        {renderScreen()}
      </AppShell>
    </div>
  );
}
