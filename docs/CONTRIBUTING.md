# Contributing to Cocohub-MobileApp

Thank you for your interest in contributing to Cocohub-MobileApp! We welcome contributions from the community to help improve this pet management mobile application with blockchain integration.

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior to [project-maintainers@example.com].

## How to Contribute

1. **Fork the Repository**: Click the "Fork" button on the GitHub repository page to create your own copy.

2. **Clone Your Fork**: Clone your forked repository to your local machine.
   ```
   git clone https://github.com/your-username/Cocohub-MobileApp.git
   cd Cocohub-MobileApp
   ```

3. **Create a Branch**: Create a new branch for your feature or bug fix.
   ```
   git checkout -b feature/your-feature-name
   ```

4. **Make Changes**: Implement your changes, following the coding standards below.

5. **Test Your Changes**: Run the test suite and ensure all tests pass.
   ```
   npm test
   ```

6. **Commit Your Changes**: Use clear, descriptive commit messages following the Conventional Commits format.

7. **Push to Your Fork**: Push your changes to your forked repository.
   ```
   git push origin feature/your-feature-name
   ```

8. **Submit a Pull Request**: Create a pull request from your branch to the main branch of the original repository.

## Coding Standards

To maintain high code quality, please follow these guidelines:

- **Clean Code Practices**: Write readable, maintainable code. Use meaningful variable and function names, avoid code duplication, and follow the Single Responsibility Principle.

- **Indentation**: Use 2 spaces for indentation consistently across all files.

- **Linting**: Ensure your code passes TypeScript type checking. Run `npm run typecheck` before submitting.

- **File Organization**: Follow the existing project structure. Place new files in appropriate directories (e.g., services in `src/services/`, utilities in `src/utils/`).

- **Documentation**: Add comments for complex logic and update documentation as needed.

## Commit Message Format

We use the [Conventional Commits](https://conventionalcommits.org/) specification for commit messages. This helps maintain a clear and organized git history.

Format: `type(scope): description`

Common types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
- `feat: add QR code generation for pet profiles`
- `fix: resolve authentication issue with blockchain service`
- `docs: update API documentation for pet service`

## Pull Request Requirements

Before submitting a pull request, ensure:

- Your PR targets the `main` branch.
- It includes a clear description of the changes made and the problem solved.
- All existing tests pass, and new tests are added for new features.
- The code passes TypeScript type checking (`npm run typecheck`).
- CI checks pass (including `npm run test:ci` for continuous integration).

Please keep PRs focused on a single feature or bug fix to make reviews easier.

## Issue Reporting

We use GitHub Issues to track bugs, feature requests, and general discussions.

### Bug Reports
When reporting a bug, please include:

- **Clear Title**: A concise description of the issue.
- **Steps to Reproduce**: Detailed steps to reproduce the bug.
- **Expected Behavior**: What you expected to happen.
- **Actual Behavior**: What actually happened.
- **Environment**: Your operating system, device, app version, and any relevant software versions.
- **Screenshots/Logs**: If applicable, include screenshots or error logs.

### Feature Requests
For new features, provide:
- **Clear Title**: A brief description of the requested feature.
- **Description**: Detailed explanation of the feature and its benefits.
- **Use Case**: How this feature would be used.

### General Guidelines
- Check existing issues before creating a new one.
- Use appropriate labels if available.
- Be respectful and constructive in discussions.

Thank you for contributing to Cocohub-MobileApp!

## Stellar Development Setup

Cocohub uses the [Stellar](https://stellar.org) network for blockchain-verified medical records.
This section guides you through the testnet setup required to work on any feature under
`src/services/stellar*` or `backend/src/stellar*`.

> For full details, Freighter wallet setup, Stellar Laboratory links, and blockchainService.ts test walkthroughs, see the comprehensive [Stellar Testnet Setup Guide](./STELLAR-SETUP.md).

### Prerequisites

- Node.js 20+
- The project dependencies installed (`npm install`)
- A Stellar testnet account (steps below)

### 1. Create a testnet account

Use the Stellar Laboratory or the `stellar-sdk` CLI to generate a new keypair:

```bash
node -e "
const { Keypair } = require('@stellar/stellar-sdk');
const kp = Keypair.random();
console.log('Public key:', kp.publicKey());
console.log('Secret key:', kp.secret());
"
```

Save the output — you will need both keys in the next steps.

### 2. Fund the account via Friendbot

Friendbot is a testnet-only faucet that credits 10 000 XLM to a new account:

```bash
curl "https://friendbot.stellar.org?addr=<YOUR_PUBLIC_KEY>"
```

Verify the account is funded:

```bash
curl "https://horizon-testnet.stellar.org/accounts/<YOUR_PUBLIC_KEY>" | \
  node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.parse(d).balances)"
```

### 3. Point `.env.development` at testnet Horizon

Add the following to your `.env.development` file (create it from `.env.example` if it does not
exist):

```bash
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SECRET_KEY=<YOUR_SECRET_KEY>
STELLAR_PUBLIC_KEY=<YOUR_PUBLIC_KEY>
```

> **Never commit secret keys.** `.env.development` is gitignored; double-check with
> `git status` before pushing.

### 4. Run the local SEP-24 anchor mock

Cocohub uses [SEP-24](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md)
for deposit/withdrawal flows. A mock anchor server is provided for local development:

```bash
# Start the mock anchor (runs on http://localhost:8000)
npm run server:anchor:mock

# Verify the TOML is reachable
curl http://localhost:8000/.well-known/stellar.toml
```

The `TRANSFER_SERVER_SEP0024` key in the response confirms the mock is running. Configure your
`.env.development` with:

```bash
STELLAR_ANCHOR_URL=http://localhost:8000
```

### Troubleshooting

**`OperationError: op_underfunded` when submitting a transaction**

Your testnet account has run out of XLM. Re-fund it with Friendbot (step 2 above). Testnet
accounts reset periodically; bookmark the Friendbot URL and re-run it if you see this error after
a testnet reset.

**`NotFoundError: The resource at the url requested was not found`**

The account does not exist on testnet yet. This happens when the public key has never been funded.
Run the Friendbot curl command (step 2) before making any Horizon API calls.

**`stellar-sdk` throws `TypeError: Cannot read properties of undefined (reading 'sequence')`**

The `loadAccount` call failed silently. Ensure `STELLAR_HORIZON_URL` is set to
`https://horizon-testnet.stellar.org` (not the mainnet URL) and that the account is funded. Add
`console.log` around the `loadAccount` call to inspect the raw Horizon response.

---

## End-to-End (E2E) Testing with Detox

Cocohub uses [Detox](https://wix.github.io/Detox/) for end-to-end testing on iOS Simulator and Android Emulator.

### Prerequisites

- Xcode (iOS) or Android Studio (Android) installed
- A running simulator/emulator
- App built in debug or release mode (see below)

### Setup

```bash
# Install Detox CLI globally
npm install -g detox-cli

# Install project dependencies (Detox is included as a devDependency)
npm install
```

### Build the app for E2E

```bash
# iOS debug build
detox build --configuration ios.sim.debug

# Android debug build
detox build --configuration android.emu.debug
```

### Run E2E tests

```bash
# iOS
detox test --configuration ios.sim.debug

# Android
detox test --configuration android.emu.debug
```

### Run against a seeded test database

```bash
# Seed minimal test data first
npm run seed:test

# Then run E2E tests
detox test --configuration ios.sim.debug
```

### Test suites

| File | Covers |
|------|--------|
| `e2e/onboarding.test.ts` | User registration → login flow |
| `e2e/addPet.test.ts` | Add a new pet |
| `e2e/healthRecord.test.ts` | Log a health record + search |
| `e2e/sos.test.ts` | Emergency SOS flow |

### Configuration

Detox is configured in `.detoxrc.js` at the project root. Supported configurations:

- `ios.sim.debug` / `ios.sim.release`
- `android.emu.debug` / `android.emu.release`
