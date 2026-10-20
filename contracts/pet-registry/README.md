# Cocohub Soroban Pet Record Registry Contract (#28)

On-chain medical record hash registry with cryptographically enforced role-based access control (Owner & Licensed Vet roles).

## Key Features
- **Privacy First**: Only cryptographic hashes (SHA-256) are committed on-chain. Zero PII is stored.
- **RBAC**: Pet owners grant and revoke read permissions to veterinarian addresses via `grant_vet_access` and `revoke_vet_access`.
- **Tamper Proof**: Full audit trail of medical integrity with timestamped ledger commits.

## Testing & Deployment
```bash
cargo test
```
