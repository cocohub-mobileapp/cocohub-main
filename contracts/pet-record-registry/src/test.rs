#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{BytesN, Env, String};

#[test]
fn test_initialize_and_register_pet() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, PetRecordRegistry);
    let client = PetRecordRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let pet_id = String::from_str(&env, "pet_golden_001");

    client.initialize(&admin);
    client.register_pet(&owner, &pet_id);

    let fetched_owner = client.get_pet_owner(&pet_id);
    assert_eq!(fetched_owner, owner);
}

#[test]
fn test_vet_access_control() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, PetRecordRegistry);
    let client = PetRecordRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let vet = Address::generate(&env);
    let stranger = Address::generate(&env);
    let pet_id = String::from_str(&env, "pet_cat_002");

    client.initialize(&admin);
    client.register_pet(&owner, &pet_id);

    // Initial access is false
    assert_eq!(client.has_vet_access(&pet_id, &vet), false);

    // Grant access
    client.grant_vet_access(&owner, &pet_id, &vet);
    assert_eq!(client.has_vet_access(&pet_id, &vet), true);

    // Anchor a record by vet
    let record_id = String::from_str(&env, "rec_vaccine_rabies");
    let record_hash = BytesN::from_array(&env, &[7u8; 32]);
    client.anchor_record(&vet, &pet_id, &record_id, &record_hash);

    // Vet can read records
    let records = client.get_records(&vet, &pet_id);
    assert_eq!(records.len(), 1);
    assert_eq!(records.get(0).unwrap().record_id, record_id);

    // Revoke access
    client.revoke_vet_access(&owner, &pet_id, &vet);
    assert_eq!(client.has_vet_access(&pet_id, &vet), false);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_unauthorized_record_access_denied() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, PetRecordRegistry);
    let client = PetRecordRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let owner = Address::generate(&env);
    let intruder = Address::generate(&env);
    let pet_id = String::from_str(&env, "pet_husky_003");

    client.initialize(&admin);
    client.register_pet(&owner, &pet_id);

    // Intruder attempting to read records should trigger AccessDenied (code 7)
    client.get_records(&intruder, &pet_id);
}
