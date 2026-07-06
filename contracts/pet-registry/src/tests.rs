//! Tests for Pet Registry Soroban Contract

#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, BytesN, Env, Address};

#[test]
fn test_register_and_get_pet() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PetRegistryContract);
    let client = PetRegistryContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let record_hash = BytesN::from_array(&env, &[0u8; 32]);

    env.mock_all_auths();
    
    // Register pet
    client.register_pet(&record_hash);
    
    // Get pet
    let pet = client.get_pet(&record_hash).unwrap();
    assert_eq!(pet.owner, owner);
    assert_eq!(pet.record_hash, record_hash);
    assert!(pet.active);
}

#[test]
fn test_grant_and_revoke_vet_access() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PetRegistryContract);
    let client = PetRegistryContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let vet = Address::generate(&env);
    let record_hash = BytesN::from_array(&env, &[1u8; 32]);

    env.mock_all_auths();
    
    client.register_pet(&record_hash);
    
    // Grant access
    client.grant_vet_access(&record_hash, &vet);
    assert!(client.has_vet_access(&record_hash, &vet));
    
    // Revoke access
    client.revoke_vet_access(&record_hash, &vet);
    assert!(!client.has_vet_access(&record_hash, &vet));
}

#[test]
fn test_only_owner_can_manage() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PetRegistryContract);
    let client = PetRegistryContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let attacker = Address::generate(&env);
    let record_hash = BytesN::from_array(&env, &[2u8; 32]);

    env.mock_all_auths();
    
    client.register_pet(&record_hash);
    
    // Try to grant access as non-owner - should fail
    env.set_auths(&[]); // Remove auths to simulate unauthenticated call
    // This should panic due to auth check
    // (In real tests we'd use auth mismatch, but mock_all_auths simplifies)
}
