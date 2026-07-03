# Pet Record Registry Soroban Contract

This contract stores only deterministic record identifiers and SHA-256 medical record hashes on chain. Personal health data stays off chain in Cocohub.

## Methods

- `upsert_record(owner, record_id, record_hash)`: owner-authorized create/update for a 32-byte derived record key and 32-byte record hash.
- `grant_vet(owner, record_id, vet)`: owner-authorized grant for a vet account.
- `revoke_vet(owner, record_id, vet)`: owner-authorized revoke for a vet account.
- `can_read(record_id, reader)`: read-only access check.
- `get_record_hash(record_id, reader)`: authenticated read that returns the hash for the owner or a granted vet.
- `owner_of(record_id)`: returns the owner address for a record.

## Build And Test

```sh
cd contracts/pet-record-registry
cargo test
cargo build --target wasm32-unknown-unknown --release
```

After deploying the optimized WASM to Stellar testnet, set `EXPO_PUBLIC_SOROBAN_PET_REGISTRY_CONTRACT_ID` and call the helpers in `src/services/blockchainService.ts`.
