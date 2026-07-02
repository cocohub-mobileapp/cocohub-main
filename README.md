# 🐾 Cocohub

> Secure pet health records, medication reminders, QR scanning, and emergency SOS — powered by blockchain.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/cocohub-mobileapp/cocohub-main/releases)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-lightgrey)](https://cocohub.app)
[![Built with Expo](https://img.shields.io/badge/built%20with-Expo-4630EB)](https://expo.dev)
[![Stellar](https://img.shields.io/badge/blockchain-Stellar-00B4E2)](https://stellar.org)
[![Bounties on GrantFox](https://img.shields.io/badge/bounties-GrantFox-6C3CF7)](https://grantfox.xyz)
[![Contributors Welcome](https://img.shields.io/badge/contributors-welcome-brightgreen)](CONTRIBUTING.md)

**Cocohub** is a full-stack mobile and web application for pet owners to securely manage their pets' medical records, medication schedules, vet appointments, and emergency contacts. Built with React Native and Expo, backed by a Node.js/PostgreSQL API, and anchored to the Stellar blockchain for tamper-proof record verification.

---

## 💰 Contribute & Earn XLM

**Cocohub is an open-source project with paid bounties.** We pay contributors in XLM (Stellar Lumens) via [GrantFox](https://grantfox.xyz) smart escrow for bug fixes, features, tests, translations, and docs.

| Bounty Size | Reward | Examples |
|-------------|--------|---------|
| 🟢 Small | 5–15 XLM | Bug fixes, docs, UI polish |
| 🟡 Medium | 20–50 XLM | New features, translations, test suites |
| 🔴 Large | 75–150 XLM | Soroban contracts, AI features, wearables |

👉 **[View all open bounties →](BOUNTIES.md)**
👉 **[How to contribute & get paid →](CONTRIBUTING.md)**

---

## 🌐 Links

| | URL |
|---|---|
| **Marketing site** | https://cocohub.app |
| **Web app** | https://app.cocohub.app |
| **iOS App Store** | https://apps.apple.com/app/cocohub/id000000000 |
| **Google Play** | https://play.google.com/store/apps/details?id=app.cocohub.mobile |
| **Support** | support@cocohub.app |

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔒 **Blockchain Records** | Medical history anchored on Stellar — tamper-proof and verifiable by any vet |
| 💊 **Medication Reminders** | Smart daily/weekly schedules with dose logging, refill tracking, and drug interaction detection |
| 📅 **Appointment Management** | Book vet visits, detect conflicts, reschedule, sync to device calendar |
| 🚨 **Emergency SOS** | One-tap alert to emergency contacts with live GPS location |
| 📊 **Health Dashboard** | Health score, weight trends, vitals chart, AI predictive alerts |
| 📱 **QR Scanner** | Instant pet identification and blockchain-verified record sharing |
| 🗺️ **Vet Finder** | Nearby vet clinics on a live map with availability slots |
| 👥 **Multi-Pet** | Manage unlimited pets with per-pet settings (Premium) |
| 🌐 **Offline-First** | Full functionality without internet — syncs when back online |
| 🔐 **Privacy-First** | AES-256 encryption, biometric login, GDPR compliant |
| 🌍 **Multi-Language** | English and Spanish, with RTL support |
| 🩺 **Telemedicine** | Video consultations via WebRTC |
| 👥 **Community** | Forum, Lost & Found network, adoption matching |
| ⛓️ **Trustlines** | Stellar trustlines for PETC, VETH, and PawPoints tokens |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Mobile/Web Framework** | React Native 0.85 + Expo SDK 56 |
| **Language** | TypeScript 5 |
| **Navigation** | React Navigation v6 (native stack + bottom tabs) |
| **State** | React Context + SQLite (offline) |
| **Backend** | Node.js 18, Express 5, PostgreSQL 15, Redis 7 |
| **Blockchain** | Stellar SDK, Soroban smart contracts |
| **Local DB** | expo-sqlite (AES-256 encrypted) |
| **Auth** | JWT, refresh tokens, OAuth (Google/Apple/Facebook), biometrics |
| **Push** | Expo Notifications (APNs & FCM) |
| **Maps** | react-native-maps + OpenStreetMap tiles |
| **Video** | react-native-webrtc (WebRTC telemedicine) |
| **Error Tracking** | Sentry |
| **CI/CD** | GitHub Actions (lint, test, build, deploy) |
| **Testing** | Jest, Vitest, React Native Testing Library, Detox, Maestro |
| **Website** | Next.js 16 + React 19 |

---

## 🗂 Project Structure

```
cocohub/
├── src/                      # React Native app
│   ├── navigation/           # AppNavigator, CareNavigator, MoreScreen
│   ├── screens/              # 75+ screens
│   ├── components/           # 60+ shared components
│   ├── services/             # 85+ API + business logic services
│   ├── context/              # Auth, Pet, Theme, Toast providers
│   ├── theme/                # Colors, tokens, dark/light mode
│   ├── hooks/                # Custom hooks
│   ├── utils/                # Encryption, validators, animations
│   └── __web_stubs__/        # Web-safe stubs for native modules
├── backend/                  # Node.js API
│   ├── server/               # Express app + routes
│   ├── src/                  # Services, models, middleware
│   ├── migrations/           # PostgreSQL migrations
│   └── seeds/                # Development seed data
├── website/                  # Next.js marketing site
│   └── src/app/              # Landing page, Privacy, Terms
├── assets/                   # App icons, splash screen
├── legal/                    # Privacy Policy, Terms of Service
├── storelisting/             # App Store + Google Play metadata
├── App.tsx                   # Native entry point
├── App.web.tsx               # Web entry point
├── metro.config.js           # Metro bundler config
└── docker-compose.yml        # PostgreSQL + Redis + backend
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- Docker Desktop (for backend)
- [Expo Go](https://expo.dev/go) on your phone (for mobile testing)

### 1. Install dependencies

```bash
git clone https://github.com/DogStark/Cocohub-MobileApp.git
cd Cocohub-MobileApp
npm install --legacy-peer-deps
```

### 2. Run the web app

```bash
npx expo start --web
```

Open **http://localhost:8081** in your browser.

### 3. Run on your phone (Expo Go)

```bash
npx expo start
```

Scan the QR code with **Expo Go** on iOS or Android. Phone and PC must be on the same Wi-Fi.

### 4. Run the full stack (backend + database)

```bash
# Start PostgreSQL + Redis + API
docker-compose up

# In a new terminal — run migrations and seed test data
npm run migrate
npm run seed:dev
```

**Test credentials after seeding:**
```
Email:    owner1@example.com
Password: Password123!
```

---

## � Marketing Website

The `website/` folder contains the Next.js marketing site.

```bash
cd website
npm install
npm run dev        # http://localhost:3001
```

**Pages:**
- `/` — Landing page (hero, features, download CTAs)
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service

**Environment:**
```bash
# website/.env.local
NEXT_PUBLIC_APP_URL=http://localhost:8081   # local
# NEXT_PUBLIC_APP_URL=https://app.cocohub.app  # production
```

**Deploy to Vercel:**
```bash
cd website
npx vercel --prod
```

---

## 📱 Testing on Device

### Expo Go (fastest — no build needed)
1. Install Expo Go from [App Store](https://apps.apple.com/app/expo-go/id982107779) or [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
2. Run `npx expo start`
3. Scan the QR code

### Build a preview APK (Android)
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```
EAS builds it in the cloud and gives you a direct APK download link — no Play Store needed.

### Build for iOS
```bash
eas build --platform ios --profile preview
```
Requires an Apple Developer account.

---

## 🌱 Database Seeding

```bash
npm run seed:dev     # 5 owners, 10 pets, records, appointments, medications
npm run seed:test    # Minimal — 2 owners, 1 vet, 1 pet
npm run seed:large   # 20 owners, 30 pets, large dataset
```

Seed data flags:

| Flag | Default | Description |
|---|---|---|
| `--owners` | 5 | Number of pet owner accounts |
| `--vets` | 3 | Number of vet accounts |
| `--pets` | 2 | Pets per owner |
| `--records` | 3 | Medical records per pet |
| `--appointments` | 2 | Appointments per pet |
| `--medications` | 1 | Medications per pet |

---

## 🧪 Testing

```bash
npm test                    # Unit tests (Jest)
npm run test:ci             # CI mode with coverage
npm run typecheck           # TypeScript check
npm run lint                # ESLint
npm run e2e:test            # Maestro E2E smoke test (requires device)
```

---

## ⛓️ Blockchain Architecture

Cocohub uses a **dual-layer verification** approach:

1. **Storage layer** — Medical records are stored encrypted on the Cocohub backend
2. **Verification layer** — A SHA-256 hash of each record is anchored on the Stellar blockchain via `manageData` operations

**No personal data is ever written to the blockchain** — only hashes.

**Stellar assets:**
| Asset | Description |
|---|---|
| `PETC` | Cocohub utility token |
| `VETH` | Vet Health Credits (redeemable for services) |
| `PAWP` | PawPoints loyalty rewards |

Future: Soroban smart contract for on-chain pet record registry with vet access control.

For local testnet development, see [Stellar Testnet Setup](docs/STELLAR-SETUP.md).

---

## 📦 App Store Submission

Assets and metadata are ready in:
- `storelisting/` — App Store + Google Play descriptions, keywords, release notes
- `legal/` — Privacy Policy and Terms of Service
- `assets/` — Icons and splash screen

See [storelisting/README.md](storelisting/README.md) for the submission checklist.

---

## 🔒 Security

- All local data encrypted with AES-256-GCM via `expo-sqlite`
- Auth tokens stored in device Keychain (iOS) / SecureStore (Android)
- HMAC-SHA256 request signing on all API calls
- SSL pinning for production API endpoints
- Biometric re-authentication on foreground
- Screen capture prevention on sensitive screens
- Circuit breaker + exponential backoff on all network calls
- Rate limiting and Helmet security headers on the backend

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development workflow, branch naming, and PR guidelines.

---

## 📄 Legal

- [Privacy Policy](https://cocohub.app/privacy)
- [Terms of Service](https://cocohub.app/terms)

> Cocohub is not a substitute for professional veterinary care. Always consult a licensed veterinarian for medical advice.

---

## 📞 Support

| Channel | Link |
|---|---|
| Issues | https://github.com/DogStark/Cocohub-MobileApp/issues |
| Email | support@cocohub.app |
| Twitter | [@cocohubapp](https://twitter.com/cocohubapp) |
| Website | https://cocohub.app |

---

## 📢 License

MIT — see [LICENSE](LICENSE) for details.

---

*Built with ❤️ for pet lovers everywhere · Powered by [Stellar](https://stellar.org)*
