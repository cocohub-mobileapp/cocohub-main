#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env};

#[derive(Clone)]
#[contracttype]
pub struct PetRecord {
    pub owner: Address,
    pub hash: BytesN<32>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Record(BytesN<32>),
    VetAccess(BytesN<32>, Address),
}

#[contract]
pub struct PetRecordRegistry;

#[contractimpl]
impl PetRecordRegistry {
    pub fn upsert_record(env: Env, owner: Address, record_id: BytesN<32>, record_hash: BytesN<32>) {
        owner.require_auth();

        let key = DataKey::Record(record_id.clone());
        let now = env.ledger().timestamp();
        let previous: Option<PetRecord> = env.storage().persistent().get(&key);

        if let Some(existing) = previous.clone() {
            if existing.owner != owner {
                panic!("record owner required");
            }
        }

        let created_at = previous.map(|record| record.created_at).unwrap_or(now);
        let record = PetRecord {
            owner,
            hash: record_hash,
            created_at,
            updated_at: now,
        };

        env.storage().persistent().set(&key, &record);
        env.events()
            .publish((symbol_short!("record"), symbol_short!("upsert")), record_id);
    }

    pub fn grant_vet(env: Env, owner: Address, record_id: BytesN<32>, vet: Address) {
        owner.require_auth();
        Self::require_owner(&env, &record_id, &owner);

        env.storage()
            .persistent()
            .set(&DataKey::VetAccess(record_id.clone(), vet.clone()), &true);
        env.events()
            .publish((symbol_short!("access"), symbol_short!("grant")), (record_id, vet));
    }

    pub fn revoke_vet(env: Env, owner: Address, record_id: BytesN<32>, vet: Address) {
        owner.require_auth();
        Self::require_owner(&env, &record_id, &owner);

        env.storage()
            .persistent()
            .remove(&DataKey::VetAccess(record_id.clone(), vet.clone()));
        env.events()
            .publish((symbol_short!("access"), symbol_short!("revoke")), (record_id, vet));
    }

    pub fn can_read(env: Env, record_id: BytesN<32>, reader: Address) -> bool {
        match Self::record(&env, &record_id) {
            Some(record) if record.owner == reader => true,
            Some(_) => env
                .storage()
                .persistent()
                .get::<DataKey, bool>(&DataKey::VetAccess(record_id, reader))
                .unwrap_or(false),
            None => false,
        }
    }

    pub fn get_record_hash(env: Env, record_id: BytesN<32>, reader: Address) -> BytesN<32> {
        reader.require_auth();
        let record = Self::record(&env, &record_id).unwrap_or_else(|| panic!("record not found"));

        if record.owner == reader {
            return record.hash;
        }

        let allowed = env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::VetAccess(record_id, reader))
            .unwrap_or(false);

        if !allowed {
            panic!("record access denied");
        }

        record.hash
    }

    pub fn owner_of(env: Env, record_id: BytesN<32>) -> Address {
        Self::record(&env, &record_id)
            .unwrap_or_else(|| panic!("record not found"))
            .owner
    }

    fn record(env: &Env, record_id: &BytesN<32>) -> Option<PetRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Record(record_id.clone()))
    }

    fn require_owner(env: &Env, record_id: &BytesN<32>, owner: &Address) {
        let record = Self::record(env, record_id).unwrap_or_else(|| panic!("record not found"));
        if &record.owner != owner {
            panic!("record owner required");
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    fn bytes(env: &Env, fill: u8) -> BytesN<32> {
        BytesN::from_array(env, &[fill; 32])
    }

    #[test]
    fn owner_can_store_and_read_hash() {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|ledger| ledger.timestamp = 123);
        let contract_id = env.register_contract(None, PetRecordRegistry);
        let client = PetRecordRegistryClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let record_id = bytes(&env, 1);
        let record_hash = bytes(&env, 2);

        client.upsert_record(&owner, &record_id, &record_hash);

        assert_eq!(client.owner_of(&record_id), owner);
        assert_eq!(client.get_record_hash(&record_id, &owner), record_hash);
    }

    #[test]
    fn owner_can_grant_and_revoke_vet_read_access() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, PetRecordRegistry);
        let client = PetRecordRegistryClient::new(&env, &contract_id);
        let owner = Address::generate(&env);
        let vet = Address::generate(&env);
        let record_id = bytes(&env, 3);

        client.upsert_record(&owner, &record_id, &bytes(&env, 4));
        assert!(!client.can_read(&record_id, &vet));

        client.grant_vet(&owner, &record_id, &vet);
        assert!(client.can_read(&record_id, &vet));
        assert_eq!(client.get_record_hash(&record_id, &vet), bytes(&env, 4));

        client.revoke_vet(&owner, &record_id, &vet);
        assert!(!client.can_read(&record_id, &vet));
    }
}
