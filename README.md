# 🐾 Cocohub

> **The pet health app that works like a human medical record — but for your dog, cat, or any animal. Blockchain-verified. Offline-first. Free to start.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/cocohub-mobileapp/cocohub-main/releases)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-lightgrey)](https://cocohub.app)
[![Built with Expo](https://img.shields.io/badge/built%20with-Expo-4630EB)](https://expo.dev)
[![Stellar](https://img.shields.io/badge/blockchain-Stellar-00B4E2)](https://stellar.org)
[![Open Issues](https://img.shields.io/github/issues/cocohub-mobileapp/cocohub-main)](https://github.com/cocohub-mobileapp/cocohub-main/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Bounties on GrantFox](https://img.shields.io/badge/bounties-GrantFox-6C3CF7)](https://grantfox.xyz)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://cocohub.app/app)

---

## The problem

Every time you switch vets, move cities, or face a pet emergency — your animal's medical history is either lost, on paper in a drawer, or locked inside another clinic's software. There is no portable, owner-controlled pet health record. **Until now.**

---

## What Cocohub does

Cocohub gives every pet a **tamper-proof digital health passport** — medication schedules, vaccination history, vet records, and emergency contacts — that lives on your phone, works offline, and can be shared with any vet via a QR code in seconds.

Records are verified on the **Stellar blockchain** (hashes only — no personal data ever on-chain), so any vet anywhere can independently confirm a record hasn't been altered.

---

## 🎬 See it in action

> **[▶ Try the web app live →](https://cocohub.app/app)** — use `owner1@example.com` / `Password123!`

<div align="center">

![Cocohub App](website/public/screenshots/login.png)
![Cocohub App](website/public/screenshots/dashboard.png)
![Cocohub App](website/public/screenshots/pets.png)
![Cocohub App](website/public/screenshots/care.png)
![Cocohub App](website/public/screenshots/appointments.png)

</div>

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 🔒 | **Blockchain Records** | SHA-256 hash of every record anchored on Stellar — tamper-proof forever |
| 💊 | **Medication Reminders** | Smart daily/weekly schedules, dose logging, refill tracking, drug interaction detection |
| 📅 | **Appointments** | Book vet visits, conflict detection, calendar sync |
| 🚨 | **Emergency SOS** | One-tap alert with live GPS to all emergency contacts |
| 📊 | **Health Dashboard** | A–F health score, weight trend chart, vitals history, AI predictive alerts |
| 📱 | **QR Scanner** | Scan any pet's QR code — instant record access, no app needed on vet's side |
| 🗺️ | **Vet Finder** | Nearby clinics on a live map via OpenStreetMap + Google Places |
| 🩺 | **AI Symptom Checker** | Describe symptoms → urgency triage + probable conditions + next actions |
| 🧬 | **Breed Insights** | Breed-specific health risks and care recommendations per pet |
| 📄 | **PDF Import (OCR)** | Photograph old paper records — AI extracts the data |
| 🎂 | **Birthday Reminders** | Annual birthday + age-based health milestone notifications |
| 🌐 | **Offline-First** | Full functionality with no internet — syncs when back online |
| 🔐 | **Privacy-First** | AES-256 encryption, biometric login, GDPR compliant |
| 🌍 | **Multi-Language** | English + Spanish, RTL support |
| 🩻 | **Telemedicine** | Video consultations via WebRTC |
| 👥 | **Community** | Forum, Lost & Found network, adoption matching |

---

## 🚀 Try it now — no install needed

**Web app:** [cocohub.app/app](https://cocohub.app/app)

```
Test account:
Email:    owner1@example.com
Password: Password123!
```

> The web app works in demo mode even without the backend running — you'll see real UI with sample data.

Or run locally in 2 minutes — see [Quick Start](#-quick-start) below.

---

## 💰 Earn XLM by contributing

**Cocohub pays contributors in XLM (Stellar Lumens)** via [GrantFox](https://grantfox.xyz) smart escrow — released within 48 hours of your PR being merged.

| Size | Reward | Examples |
|---|---|---|
| 🟢 Small | 5–15 XLM | Bug fixes, docs, UI polish |
| 🟡 Medium | 20–50 XLM | New features, translations, test suites |
| 🔴 Large | 75–150 XLM | Soroban contracts, AI features, wearable sync |

👉 **[View all 25 open bounties →](BOUNTIES.md)**
👉 **[How to claim & get paid →](CONTRIBUTING.md)**

New to Stellar? Get a free wallet at [Freighter.app](https://freighter.app) in 2 minutes.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Mobile/Web | React Native 0.85 + Expo SDK 56 |
| Language | TypeScript 5 |
| Navigation | React Navigation v6 |
| State | React Context + SQLite (offline) |
| Backend | Node.js 18, Express 5, PostgreSQL 15, Redis 7 |
| Blockchain | Stellar SDK + Soroban smart contracts |
| Local DB | expo-sqlite (AES-256 encrypted) |
| Auth | JWT + refresh tokens + OAuth (Google/Apple/Facebook) + biometrics |
| Push | Expo Notifications (APNs + FCM) |
| Maps | react-native-maps + OpenStreetMap |
| Video | react-native-webrtc |
| Error Tracking | Sentry |
| CI/CD | GitHub Actions (11 workflows) |
| Testing | Jest, Vitest, Testing Library, Detox, Maestro |

---

## 📁 Project Structure

```
cocohub/
├── src/                   # React Native app (75+ screens, 85+ services)
│   ├── screens/           # All UI screens
│   ├── components/        # 60+ shared components
│   ├── services/          # API + business logic
│   ├── navigation/        # App, Care, More navigators
│   ├── context/           # Auth, Pet, Theme, Toast providers
│   └── utils/             # Encryption, haptics, validators
├── backend/               # Node.js/Express API (50+ routes)
│   ├── server/            # Express app + route modules
│   ├── migrations/        # 30+ PostgreSQL migrations
│   └── seeds/             # Dev seed data
├── website/               # Next.js marketing site
├── android-widget/        # Android home screen widget (Java)
├── ios-widget/            # iOS home screen widget (Swift)
├── legal/                 # Privacy Policy, Terms of Service
└── storelisting/          # App Store + Google Play metadata
```

---

## 🚀 Quick Start

**Prerequisites:** Node.js ≥ 18, Docker Desktop

```bash
# 1. Clone
git clone https://github.com/cocohub-mobileapp/cocohub-main.git
cd cocohub-main

# 2. Install
npm install --legacy-peer-deps

# 3. Run web app instantly (no backend needed)
npx expo start --web
# → open http://localhost:8081
```

**Full stack with backend:**
```bash
docker-compose up          # PostgreSQL + Redis + API
npm run migrate            # Run DB migrations
npm run seed:dev           # Seed test data
```

**Test credentials:** `owner1@example.com` / `Password123!`

---

## ⛓️ Blockchain Architecture

Cocohub uses a **dual-layer** approach — your data stays private:

1. **Storage** — Records stored encrypted on the Cocohub backend (AES-256)
2. **Verification** — A SHA-256 hash of each record is anchored on Stellar via `manageData`
   or the Soroban medical-record registry contract in
   `contracts/medical-record-registry`

**No personal data is ever written to the blockchain.** Only hashes. Any vet can verify a record independently by recomputing the hash and checking it against the on-chain value.

```
Record → SHA-256 hash → Stellar manageData tx → tamper-evident audit trail
```

### Soroban Medical Record Registry

The registry contract stores pet medical record hashes for approved vet
addresses and exposes `store_record(pet_id, record_hash, vet_address)` plus
`verify_record(record_id) -> bool`. Build and test it with:

```bash
cargo test --manifest-path contracts/medical-record-registry/Cargo.toml
cargo build --manifest-path contracts/medical-record-registry/Cargo.toml --target wasm32v1-none --release
```

The contract has been deployed and initialized on Stellar testnet:

- Contract ID: `CCMVO2NWSL2EQATEDUDWJOG5UVBNV57V4MIXGGE5NC5W2B25Y52DHYNN`
- Admin: `GAMRBYWBKXRVKMEC4UAS3GFDQLSJSARR6TGAJLWK4562MMMND7IUUVQO`
- Upload tx: `d3b973eef44edc7078255083f8323e843f2896a7df644fa7be9b4980ba8b126f`
- Create tx: `0964a9c9914ca97f1feca8c5360f490e161d29748f1b8d1462c19d05370e261d`
- Initialize tx: `8d1ae1c86854e4f95e459a6e9310361e16991eefdf2f8e3fe0943f0ce1114b07`

Configure the app with:

```bash
MEDICAL_RECORD_REGISTRY_CONTRACT_ID=CCMVO2NWSL2EQATEDUDWJOG5UVBNV57V4MIXGGE5NC5W2B25Y52DHYNN
EXPO_PUBLIC_MEDICAL_RECORD_REGISTRY_CONTRACT_ID=CCMVO2NWSL2EQATEDUDWJOG5UVBNV57V4MIXGGE5NC5W2B25Y52DHYNN
EXPO_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```

Full deployment commands are in
[`contracts/medical-record-registry/README.md`](contracts/medical-record-registry/README.md).

**Stellar assets:**
- `PETC` — Cocohub utility token
- `VETH` — Vet Health Credits
- `PAWP` — PawPoints loyalty rewards

---

## 🧪 Testing

```bash
npm test              # Unit tests (Jest)
npm run typecheck     # TypeScript
npm run lint          # ESLint
npm run e2e:test      # Maestro E2E smoke test
```

---

## 🤝 Contributing

We welcome everyone — from first-timers to senior engineers. See [CONTRIBUTING.md](./CONTRIBUTING.md).

### Good first issues
Look for issues tagged [`good first issue`](https://github.com/cocohub-mobileapp/cocohub-main/labels/good%20first%20issue) — these are scoped, self-contained, and come with a bounty.

---

## 🔒 Security

- AES-256-GCM encryption on all local SQLite data
- Tokens in device Keychain (iOS) / SecureStore (Android)
- HMAC-SHA256 request signing
- SSL certificate pinning
- Biometric re-auth on foreground
- Screen capture prevention on sensitive screens
- Rate limiting + Helmet headers on the backend

Report vulnerabilities privately to **security@cocohub.app** — do not open a public issue.

---

## 📄 Legal

- [Privacy Policy](https://cocohub.app/privacy)
- [Terms of Service](https://cocohub.app/terms)

> Cocohub is not a substitute for professional veterinary care. Always consult a licensed veterinarian.

---

## 📞 Support & Community

| Channel | Link |
|---|---|
| 🐛 Issues | [GitHub Issues](https://github.com/cocohub-mobileapp/cocohub-main/issues) |
| 💬 Discussions | [GitHub Discussions](https://github.com/cocohub-mobileapp/cocohub-main/discussions) |
| 📧 Email | support@cocohub.app |
| 🐦 Twitter | [@cocohubapp](https://twitter.com/cocohubapp) |
| 🌐 Website | [cocohub.app](https://cocohub.app) |

---

## 📢 License

MIT — see [LICENSE](LICENSE) for details.

---

*Built with ❤️ for pet lovers everywhere · Powered by [Stellar](https://stellar.org) · Bounties via [GrantFox](https://grantfox.xyz)*
