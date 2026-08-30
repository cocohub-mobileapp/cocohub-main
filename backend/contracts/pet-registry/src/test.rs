#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Events}, vec, Address, BytesN, Env, IntoVal, Symbol};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PetRecordRegistry);
    let client = PetRecordRegistryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    env.mock_all_auths();

    client.initialize(&admin);
    assert_eq!(client.get_admin(), admin);

    // Double initialization should fail
    let res = client.try_initialize(&admin);
    assert_eq!(res, Err(Ok(Error::AlreadyInitialized)));
}

#[test]
fn test_register_pet_record() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PetRecordRegistry);
    let client = PetRecordRegistryClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let pet_id = Symbol::new(&env, "pet_coco_1");
    let record_hash: BytesN<32> = BytesN::from_array(&env, &[7u8; 32]);

    env.mock_all_auths();

    // Register record
    client.register_pet_record(&owner, &pet_id, &record_hash);

    // Verify owner pets list
    let owner_pets = client.get_owner_pets(&owner);
    assert_eq!(owner_pets.len(), 1);
    assert_eq!(owner_pets.get(0).unwrap(), pet_id);

    // Owner reads record
    let record = client.get_record(&owner, &pet_id);
    assert_eq!(record.record_hash, record_hash);
    assert_eq!(record.owner, owner);

    // Duplicate registration should fail
    let res = client.try_register_pet_record(&owner, &pet_id, &record_hash);
    assert_eq!(res, Err(Ok(Error::RecordAlreadyExists)));
}

#[test]
fn test_update_pet_record() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PetRecordRegistry);
    let client = PetRecordRegistryClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let imposter = Address::generate(&env);
    let pet_id = Symbol::new(&env, "pet_coco_2");
    let initial_hash: BytesN<32> = BytesN::from_array(&env, &[1u8; 32]);
    let updated_hash: BytesN<32> = BytesN::from_array(&env, &[2u8; 32]);

    env.mock_all_auths();

    client.register_pet_record(&owner, &pet_id, &initial_hash);

    // Imposter cannot update
    let imposter_res = client.try_update_pet_record(&imposter, &pet_id, &updated_hash);
    assert_eq!(imposter_res, Err(Ok(Error::NotOwner)));

    // Owner updates successfully
    client.update_pet_record(&owner, &pet_id, &updated_hash);
    let record = client.get_record(&owner, &pet_id);
    assert_eq!(record.record_hash, updated_hash);
}

#[test]
fn test_grant_and_revoke_vet_access() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PetRecordRegistry);
    let client = PetRecordRegistryClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let vet = Address::generate(&env);
    let unauthorized_user = Address::generate(&env);
    let pet_id = Symbol::new(&env, "pet_coco_3");
    let record_hash: BytesN<32> = BytesN::from_array(&env, &[42u8; 32]);

    env.mock_all_auths();

    client.register_pet_record(&owner, &pet_id, &record_hash);

    // Vet initially has no access
    assert_eq!(client.check_vet_access(&vet, &pet_id), false);
    assert_eq!(client.get_vet_pets(&vet).len(), 0);

    // Unauthorized user cannot read record
    let unauth_res = client.try_get_record(&unauthorized_user, &pet_id);
    assert_eq!(unauth_res, Err(Ok(Error::Unauthorized)));

    // Vet cannot read record before grant
    let vet_res = client.try_get_record(&vet, &pet_id);
    assert_eq!(vet_res, Err(Ok(Error::Unauthorized)));

    // Imposter cannot grant vet access
    let imposter_grant = client.try_grant_vet_access(&unauthorized_user, &vet, &pet_id);
    assert_eq!(imposter_grant, Err(Ok(Error::NotOwner)));

    // Owner grants vet access
    client.grant_vet_access(&owner, &vet, &pet_id);

    // Vet now has access
    assert_eq!(client.check_vet_access(&vet, &pet_id), true);
    let vet_pets = client.get_vet_pets(&vet);
    assert_eq!(vet_pets.len(), 1);
    assert_eq!(vet_pets.get(0).unwrap(), pet_id);

    // Vet can now read the record
    let record = client.get_record(&vet, &pet_id);
    assert_eq!(record.record_hash, record_hash);
    assert_eq!(record.owner, owner);

    // Imposter cannot revoke access
    let imposter_revoke = client.try_revoke_vet_access(&unauthorized_user, &vet, &pet_id);
    assert_eq!(imposter_revoke, Err(Ok(Error::NotOwner)));

    // Owner revokes vet access
    client.revoke_vet_access(&owner, &vet, &pet_id);

    // Vet access is revoked
    assert_eq!(client.check_vet_access(&vet, &pet_id), false);
    assert_eq!(client.get_vet_pets(&vet).len(), 0);

    let vet_revoked_res = client.try_get_record(&vet, &pet_id);
    assert_eq!(vet_revoked_res, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_multiple_pets_and_vets() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PetRecordRegistry);
    let client = PetRecordRegistryClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let vet1 = Address::generate(&env);
    let vet2 = Address::generate(&env);

    let pet1 = Symbol::new(&env, "pet_1");
    let pet2 = Symbol::new(&env, "pet_2");

    let hash1: BytesN<32> = BytesN::from_array(&env, &[11u8; 32]);
    let hash2: BytesN<32> = BytesN::from_array(&env, &[22u8; 32]);

    env.mock_all_auths();

    client.register_pet_record(&owner, &pet1, &hash1);
    client.register_pet_record(&owner, &pet2, &hash2);

    let owner_pets = client.get_owner_pets(&owner);
    assert_eq!(owner_pets.len(), 2);

    // Grant vet1 access to pet1 only
    client.grant_vet_access(&owner, &vet1, &pet1);
    // Grant vet2 access to pet1 and pet2
    client.grant_vet_access(&owner, &vet2, &pet1);
    client.grant_vet_access(&owner, &vet2, &pet2);

    assert_eq!(client.check_vet_access(&vet1, &pet1), true);
    assert_eq!(client.check_vet_access(&vet1, &pet2), false);
    assert_eq!(client.get_vet_pets(&vet1).len(), 1);

    assert_eq!(client.check_vet_access(&vet2, &pet1), true);
    assert_eq!(client.check_vet_access(&vet2, &pet2), true);
    assert_eq!(client.get_vet_pets(&vet2).len(), 2);
}
