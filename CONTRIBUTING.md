# Contributing to Cocohub 🐾

Thank you for your interest in contributing to Cocohub — the open-source pet health records app powered by the Stellar blockchain.

We welcome developers, designers, and writers at all skill levels. Contributions are rewarded with **XLM (Stellar Lumens)** via smart escrow through [GrantFox](https://grantfox.xyz).

---

## 📋 Table of Contents

- [What We're Building](#what-were-building)
- [Ways to Contribute](#ways-to-contribute)
- [Bounty Program](#bounty-program)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Submitting a PR](#submitting-a-pr)
- [Getting Paid](#getting-paid)
- [Community](#community)

---

## What We're Building

Cocohub is a full-stack mobile and web app for pet owners to:
- Store encrypted, blockchain-verified medical records on Stellar
- Track medications, vaccinations, and vet appointments
- Trigger emergency SOS with live GPS + pet profile
- Share pet health records via QR codes

**Tech stack:** React Native 0.85 · Expo SDK 56 · TypeScript 5 · Node.js 18 · PostgreSQL 15 · Stellar SDK

---

## Ways to Contribute

| Type | Examples | Reward |
|------|----------|--------|
| 🐛 **Bug fixes** | Crash fixes, UI glitches, broken flows | XLM bounty |
| ✨ **Features** | New screens, API endpoints, Stellar integrations | XLM bounty |
| 🧪 **Tests** | Unit tests, integration tests, E2E flows | XLM bounty |
| 📖 **Docs** | README improvements, API docs, tutorials | XLM bounty |
| 🎨 **Design** | UI polish, accessibility improvements, icons | XLM bounty |
| 🌍 **i18n** | Translations (French, Portuguese, Arabic, more) | XLM bounty |

---

## Bounty Program

All paid bounties are listed in **[BOUNTIES.md](./BOUNTIES.md)** and on our [GrantFox project page](https://grantfox.xyz).

Bounty sizes:
- 🟢 **Small** (5–15 XLM) — isolated bug fixes, docs, small UI tasks
- 🟡 **Medium** (20–50 XLM) — new features, test suites, API endpoints
- 🔴 **Large** (75–150 XLM) — major features, Stellar integrations, architecture work

**To claim a bounty:**
1. Comment `I'd like to work on this` on the GitHub issue
2. A maintainer will assign it to you (first-come, first-served)
3. Submit your PR referencing the issue (`Closes #123`)
4. After review and merge, payment is released from escrow within 48 hours

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- Docker Desktop (for the backend)
- A Stellar wallet address (for receiving bounty payments)

### 1. Fork and clone

```bash
git clone https://github.com/cocohub-mobileapp/cocohub-main.git
cd cocohub-main
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Set up Stellar testnet account

First, create a Stellar testnet account and fund it via Friendbot:

```bash
# See full guide: docs/STELLAR-SETUP.md
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

### 4. Set up environment

```bash
cp .env.example .env.development
# Edit .env.development with your local values
# (see docs/STELLAR-SETUP.md for Stellar environment variables)
```

### 5. Start the backend

```bash
docker-compose up
npm run migrate
npm run seed:dev
```

### 6. Run the app

```bash
# Web (fastest for development)
npx expo start --web

# Mobile (requires Expo Go on your phone)
npx expo start
```

**Test credentials after seeding:**
```
Email:    owner1@example.com
Password: Password123!
```

---

## Development Workflow

```
main          ← stable, protected
  └── dev     ← integration branch, PRs target here
        └── feat/your-feature-name
        └── fix/issue-description
        └── test/what-youre-testing
        └── docs/what-youre-documenting
```

### Branch naming

| Type | Format | Example |
|------|--------|---------|
| Feature | `feat/short-description` | `feat/dark-mode-toggle` |
| Bug fix | `fix/short-description` | `fix/sos-button-crash` |
| Test | `test/short-description` | `test/medication-service` |
| Docs | `docs/short-description` | `docs/api-setup-guide` |

---

## Code Standards

We use ESLint + Prettier. Before every commit, run:

```bash
npm run lint
npm run typecheck
npm test
```

Or let the pre-commit hook handle it automatically (via Husky).

### Key rules
- **TypeScript strict** — no `any`, proper return types
- **No console.log** in production code — use `loggerService`
- **Encryption** — never store sensitive data in plain AsyncStorage; use `encryptedAsyncStorage` or SecureStore
- **Stellar** — all blockchain operations go through `src/services/blockchainService.ts`
- **Tests** — new features must include at least one unit test

---

## Submitting a PR

1. Make sure your branch is up to date with `dev`
2. Run `npm run lint && npm run typecheck && npm test`
3. Open a PR against the `dev` branch
4. Fill in the PR template (description, screenshots for UI changes, test steps)
5. Reference the issue: `Closes #123`
6. A maintainer will review within **3 business days**

### PR checklist

- [ ] Lint and type checks pass
- [ ] Tests pass (or new tests added)
- [ ] No `.env` secrets committed
- [ ] UI changes include a screenshot or screen recording
- [ ] Stellar-related changes tested on testnet first

---

## Getting Paid

Once your PR is merged:

1. Post your **Stellar wallet address** in the issue (or DM a maintainer)
2. Payment is released from GrantFox escrow within **48 hours**
3. You can use any Stellar wallet — [Freighter](https://freighter.app), [Lobstr](https://lobstr.co), or any other

Don't have a Stellar wallet yet? Create a free one at [Freighter.app](https://freighter.app) in under 2 minutes.

---

## Reporting Bugs

Open a [GitHub Issue](https://github.com/cocohub-mobileapp/cocohub-main/issues/new/choose) using the **Bug Report** template. Include:
- Steps to reproduce
- Expected vs actual behavior
- Device / OS / app version
- Screenshots or logs if possible

**Security vulnerabilities** — please do NOT open a public issue. Email `security@cocohub.app` instead.

---

## Community

| Channel | Link |
|---------|------|
| 💬 GitHub Discussions | [Discussions tab](https://github.com/cocohub-mobileapp/cocohub-main/discussions) |
| 🐦 Twitter / X | [@cocohubapp](https://twitter.com/cocohubapp) |
| 📧 Email | support@cocohub.app |
| 🌐 Website | [cocohub.app](https://cocohub.app) |

---

## Code of Conduct

Be respectful. We welcome contributors from all backgrounds and experience levels. Harassment of any kind will not be tolerated.

---

*Built with ❤️ for pet lovers everywhere · Powered by [Stellar](https://stellar.org) · Funded via [GrantFox](https://grantfox.xyz)*
