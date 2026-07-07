#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MedicalRecord {
    pub pet_id: String,
    pub record_hash: BytesN<32>,
    pub vet_address: Address,
    pub written_at: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Vet(Address),
    Record(BytesN<32>),
}

#[contract]
pub struct MedicalRecordRegistry;

#[contractimpl]
impl MedicalRecordRegistry {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn approve_vet(env: Env, admin: Address, vet_address: Address) {
        require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Vet(vet_address), &true);
    }

    pub fn revoke_vet(env: Env, admin: Address, vet_address: Address) {
        require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Vet(vet_address), &false);
    }

    pub fn is_vet_approved(env: Env, vet_address: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Vet(vet_address))
            .unwrap_or(false)
    }

    pub fn store_record(
        env: Env,
        pet_id: String,
        record_hash: BytesN<32>,
        vet_address: Address,
    ) -> BytesN<32> {
        vet_address.require_auth();

        if !Self::is_vet_approved(env.clone(), vet_address.clone()) {
            panic!("vet is not approved");
        }

        let record_id = record_hash.clone();
        let record_key = DataKey::Record(record_id.clone());

        if env.storage().persistent().has(&record_key) {
            panic!("record already stored");
        }

        let record = MedicalRecord {
            pet_id,
            record_hash,
            vet_address,
            written_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&record_key, &record);
        record_id
    }

    pub fn verify_record(env: Env, record_id: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Record(record_id))
    }

    pub fn get_record(env: Env, record_id: BytesN<32>) -> Option<MedicalRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Record(record_id))
    }
}

fn require_admin(env: &Env, admin: &Address) {
    let configured_admin: Address = env
        .storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("not initialized");

    admin.require_auth();

    if configured_admin != *admin {
        panic!("admin required");
    }
}

#[cfg(test)]
mod test {
    extern crate std;

    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    fn setup() -> (
        Env,
        MedicalRecordRegistryClient<'static>,
        Address,
        Address,
        BytesN<32>,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|li| {
            li.timestamp = 1_788_307_200;
        });

        let contract_id = env.register(MedicalRecordRegistry, ());
        let client = MedicalRecordRegistryClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let vet = Address::generate(&env);
        let record_hash = BytesN::from_array(&env, &[7u8; 32]);

        client.initialize(&admin);
        client.approve_vet(&admin, &vet);

        (env, client, admin, vet, record_hash)
    }

    #[test]
    fn stores_and_verifies_record_hash_for_approved_vet() {
        let (env, client, _admin, vet, record_hash) = setup();
        let pet_id = String::from_str(&env, "pet-123");

        let record_id = client.store_record(&pet_id, &record_hash, &vet);

        assert_eq!(record_id, record_hash);
        assert!(client.verify_record(&record_id));

        let stored = client.get_record(&record_id).unwrap();
        assert_eq!(stored.pet_id, pet_id);
        assert_eq!(stored.record_hash, record_hash);
        assert_eq!(stored.vet_address, vet);
        assert_eq!(stored.written_at, 1_788_307_200);
    }

    #[test]
    #[should_panic(expected = "vet is not approved")]
    fn rejects_record_from_unapproved_vet() {
        let (env, client, _admin, _vet, record_hash) = setup();
        let unapproved_vet = Address::generate(&env);

        client.store_record(&String::from_str(&env, "pet-123"), &record_hash, &unapproved_vet);
    }

    #[test]
    #[should_panic(expected = "record already stored")]
    fn rejects_duplicate_record_hashes() {
        let (env, client, _admin, vet, record_hash) = setup();
        let pet_id = String::from_str(&env, "pet-123");

        client.store_record(&pet_id, &record_hash, &vet);
        client.store_record(&pet_id, &record_hash, &vet);
    }

    #[test]
    #[should_panic(expected = "vet is not approved")]
    fn revoke_vet_blocks_future_writes() {
        let (env, client, admin, vet, record_hash) = setup();
        client.revoke_vet(&admin, &vet);

        assert!(!client.is_vet_approved(&vet));
        client.store_record(&String::from_str(&env, "pet-456"), &record_hash, &vet);
    }

    #[test]
    fn store_then_verify_flow_demonstrates_integration_path() {
        let (env, client, _admin, vet, _record_hash) = setup();
        let digest = BytesN::from_array(&env, &[42u8; 32]);

        assert!(!client.verify_record(&digest));
        let record_id = client.store_record(&String::from_str(&env, "pet-abc"), &digest, &vet);

        assert!(client.verify_record(&record_id));
        assert_eq!(client.get_record(&record_id).unwrap().record_hash, digest);
    }
}
