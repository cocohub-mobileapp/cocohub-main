# Medical Record Registry Contract

Soroban contract for storing pet medical record hashes on Stellar without writing personal data on chain.

## Contract API

- `initialize(admin)` sets the contract admin once.
- `approve_vet(admin, vet_address)` allows a vet address to write records.
- `revoke_vet(admin, vet_address)` removes write access.
- `store_record(pet_id, record_hash, vet_address) -> record_id` stores a 32-byte medical record hash for an approved vet.
- `verify_record(record_id) -> bool` returns whether the hash was stored.
- `get_record(record_id)` returns the stored pet id, hash, vet address, and ledger timestamp.

`record_id` is the 32-byte record hash. Cocohub stores hashes only, so the contract never receives diagnoses, notes, attachments, owner names, or other medical details.

## Local Tests

```bash
cargo test --manifest-path contracts/medical-record-registry/Cargo.toml
```

## Testnet Deployment

Current deployed testnet instance:

- Contract ID: `CCMVO2NWSL2EQATEDUDWJOG5UVBNV57V4MIXGGE5NC5W2B25Y52DHYNN`
- Admin: `GAMRBYWBKXRVKMEC4UAS3GFDQLSJSARR6TGAJLWK4562MMMND7IUUVQO`
- Upload tx: `d3b973eef44edc7078255083f8323e843f2896a7df644fa7be9b4980ba8b126f`
- Create tx: `0964a9c9914ca97f1feca8c5360f490e161d29748f1b8d1462c19d05370e261d`
- Initialize tx: `8d1ae1c86854e4f95e459a6e9310361e16991eefdf2f8e3fe0943f0ce1114b07`

To deploy a new instance:

Install the Stellar CLI and WASM target:

```bash
cargo install --locked stellar-cli
rustup target add wasm32v1-none
```

Configure a funded testnet identity:

```bash
stellar keys generate cocohub-testnet --network testnet
stellar keys fund cocohub-testnet --network testnet
```

Build and deploy:

```bash
cargo build --manifest-path contracts/medical-record-registry/Cargo.toml --target wasm32v1-none --release
stellar contract deploy \
  --wasm contracts/medical-record-registry/target/wasm32v1-none/release/medical_record_registry.wasm \
  --source cocohub-testnet \
  --network testnet
```

Initialize and approve a vet:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source cocohub-testnet \
  --network testnet \
  -- initialize \
  --admin <ADMIN_PUBLIC_KEY>

stellar contract invoke \
  --id <CONTRACT_ID> \
  --source cocohub-testnet \
  --network testnet \
  -- approve_vet \
  --admin <ADMIN_PUBLIC_KEY> \
  --vet_address <VET_PUBLIC_KEY>
```

Set the deployed contract in the app environment:

```bash
EXPO_PUBLIC_MEDICAL_RECORD_REGISTRY_CONTRACT_ID=CCMVO2NWSL2EQATEDUDWJOG5UVBNV57V4MIXGGE5NC5W2B25Y52DHYNN
EXPO_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
```
