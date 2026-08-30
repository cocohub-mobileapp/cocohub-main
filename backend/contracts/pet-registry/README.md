# Pet Record Registry - Soroban Smart Contract

A decentralized, privacy-preserving Pet Record Registry smart contract built with Soroban (Rust SDK) for the Stellar network.

## Features

- **Privacy-First**: Stores cryptographic hashes (SHA-256) of pet medical records rather than personal identifiable information (PII) or sensitive health details.
- **Granular Access Control**:
  - **Owner Role**: Full control to register, update records, and grant/revoke veterinary access permissions.
  - **Vet Role**: Read-only authorization to retrieve records granted explicitly by the pet owner.
- **Auditable History & Events**: Emits standardized Soroban contract events for all registrations, updates, and access grants/revocations.
- **State Lifetime Management**: Automatically extends persistent and instance storage TTLs to guarantee data availability on Stellar.

## Contract Interface

### State Operations

| Method | Parameters | Caller | Description |
|---|---|---|---|
| `initialize` | `admin: Address` | Admin | Initializes contract admin |
| `register_pet_record` | `owner: Address, pet_id: Symbol, record_hash: BytesN<32>` | Owner | Registers a new pet's medical record hash |
| `update_pet_record` | `owner: Address, pet_id: Symbol, new_record_hash: BytesN<32>` | Owner | Updates an existing pet's record hash |
| `grant_vet_access` | `owner: Address, vet: Address, pet_id: Symbol` | Owner | Grants read access to a specific veterinarian |
| `revoke_vet_access` | `owner: Address, vet: Address, pet_id: Symbol` | Owner | Revokes veterinarian read access |

### Read Queries

| Method | Parameters | Caller | Description |
|---|---|---|---|
| `get_record` | `requester: Address, pet_id: Symbol` | Owner or Authorized Vet | Fetches `PetRecord` struct `{ owner, record_hash, timestamp }` |
| `check_vet_access` | `vet: Address, pet_id: Symbol` | Any | Returns `bool` whether vet is authorized |
| `get_vet_pets` | `vet: Address` | Any | Returns list of pet IDs accessible by the vet |
| `get_owner_pets` | `owner: Address` | Any | Returns list of pet IDs registered by the owner |
| `get_admin` | - | Any | Returns contract admin address |

## Building and Testing

### Prerequisites

- Rust & Cargo (1.80+)
- `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
- Soroban CLI: `cargo install --locked stellar-cli` (or `cargo install soroban-cli`)

### Run Tests

```bash
cargo test
```

### Build Optimized WASM

```bash
cargo build --target wasm32-unknown-unknown --release
```

The optimized contract binary will be generated at:
`target/wasm32-unknown-unknown/release/pet_record_registry.wasm`

## Deployment to Stellar Testnet

Using Stellar CLI:

```bash
# 1. Install contract WASM
stellar contract install \
  --network testnet \
  --source-account <OWNER_SECRET_OR_IDENTITY> \
  --wasm target/wasm32-unknown-unknown/release/pet_record_registry.wasm

# 2. Deploy contract instance
stellar contract deploy \
  --network testnet \
  --source-account <OWNER_SECRET_OR_IDENTITY> \
  --wasm-hash <WASM_HASH>

# 3. Initialize contract
stellar contract invoke \
  --network testnet \
  --source-account <OWNER_SECRET_OR_IDENTITY> \
  --id <CONTRACT_ID> \
  -- initialize \
  --admin <ADMIN_PUBLIC_KEY>
```
