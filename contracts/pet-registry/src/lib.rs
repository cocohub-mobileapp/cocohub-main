//! Pet Record Registry - Soroban Smart Contract
//!
//! On-chain pet record registry with owner and vet access control.
//! Stores pet record hashes (not PII) with grant/revoke vet access.

#![no_std]
use soroban_sdk::{contract, contractimpl, BytesN, Address, Env, Map, Symbol, Vec, symbol_short};

// Contract storage keys
const PETS: Symbol = symbol_short!("PETS");
const VET_ACCESS: Symbol = symbol_short!("VET_ACC");
const OWNERS: Symbol = symbol_short!("OWNERS");

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct PetRecord {
    /// The owner of this pet
    pub owner: Address,
    /// Hash of the pet medical record (SHA-256, not PII)
    pub record_hash: BytesN<32>,
    /// Whether this record is active
    pub active: bool,
    /// Unix timestamp of last update
    pub updated_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Pet record by hash identifier
    Pet(BytesN<32>),
    /// Vets authorized for a given pet hash
    VetsForPet(BytesN<32>),
    /// Pet owner
    Owner(Address),
}

#[contract]
pub struct PetRegistryContract;

#[contractimpl]
impl PetRegistryContract {
    /// Register a new pet record on-chain
    /// Stores the hash of the pet medical record and assigns the caller as owner.
    pub fn register_pet(env: Env, record_hash: BytesN<32>) {
        let owner = env.invoker();

        // Verify this record hash hasn't been registered
        let key = DataKey::Pet(record_hash.clone());
        assert!(!env.storage().instance().has(&key), "record hash already registered");

        let timestamp = env.ledger().timestamp();

        let pet = PetRecord {
            owner: owner.clone(),
            record_hash: record_hash.clone(),
            active: true,
            updated_at: timestamp,
        };

        // Store pet record
        env.storage().instance().set(&key, &pet);

        // Track owner's pets
        let owner_key = DataKey::Owner(owner.clone());
        let mut owner_pets: Vec<BytesN<32>> = env.storage().instance().get(&owner_key).unwrap_or(Vec::new(&env));
        owner_pets.push_back(record_hash.clone());
        env.storage().instance().set(&owner_key, &owner_pets);

        // Emit event
        env.events().publish(
            (symbol_short!("PET_REG"), owner),
            record_hash,
        );
    }

    /// Get pet record by its hash
    pub fn get_pet(env: Env, record_hash: BytesN<32>) -> Option<PetRecord> {
        let key = DataKey::Pet(record_hash);
        env.storage().instance().get(&key)
    }

    /// Grant a vet read access to a specific pet record
    /// Only the owner can grant access.
    pub fn grant_vet_access(env: Env, record_hash: BytesN<32>, vet: Address) {
        let owner = env.invoker();

        // Verify caller is the owner
        let pet_key = DataKey::Pet(record_hash.clone());
        let pet: PetRecord = env.storage().instance().get(&pet_key)
            .expect("pet record not found");
        assert_eq!(pet.owner, owner, "only owner can grant access");

        // Add vet to authorized list
        let vets_key = DataKey::VetsForPet(record_hash.clone());
        let mut vets: Vec<Address> = env.storage().instance().get(&vets_key).unwrap_or(Vec::new(&env));

        // Check if vet is already authorized
        for existing_vet in vets.iter() {
            if existing_vet == vet {
                panic!("vet already authorized");
            }
        }

        vets.push_back(vet.clone());
        env.storage().instance().set(&vets_key, &vets);

        // Emit event
        env.events().publish(
            (symbol_short!("VET_GRNT"), owner, vet),
            record_hash,
        );
    }

    /// Revoke a vet's read access to a specific pet record
    /// Only the owner can revoke access.
    pub fn revoke_vet_access(env: Env, record_hash: BytesN<32>, vet: Address) {
        let owner = env.invoker();

        // Verify caller is the owner
        let pet_key = DataKey::Pet(record_hash.clone());
        let pet: PetRecord = env.storage().instance().get(&pet_key)
            .expect("pet record not found");
        assert_eq!(pet.owner, owner, "only owner can revoke access");

        // Remove vet from authorized list
        let vets_key = DataKey::VetsForPet(record_hash.clone());
        let vets: Vec<Address> = env.storage().instance().get(&vets_key).unwrap_or(Vec::new(&env));

        let mut new_vets: Vec<Address> = Vec::new(&env);
        let mut found = false;
        for existing_vet in vets.iter() {
            if existing_vet != vet {
                new_vets.push_back(existing_vet);
            } else {
                found = true;
            }
        }
        assert!(found, "vet not found in authorized list");

        env.storage().instance().set(&vets_key, &new_vets);

        // Emit event
        env.events().publish(
            (symbol_short!("VET_REV"), owner, vet),
            record_hash,
        );
    }

    /// Check if a vet has access to a pet record
    /// Can be called by anyone (read method)
    pub fn has_vet_access(env: Env, record_hash: BytesN<32>, vet: Address) -> bool {
        let vets_key = DataKey::VetsForPet(record_hash);
        let vets: Vec<Address> = match env.storage().instance().get(&vets_key) {
            Some(v) => v,
            None => return false,
        };

        for existing_vet in vets.iter() {
            if existing_vet == vet {
                return true;
            }
        }
        false
    }

    /// Get all authorized vets for a pet record
    /// Only the owner can view the full list
    pub fn get_authorized_vets(env: Env, record_hash: BytesN<32>) -> Vec<Address> {
        let owner = env.invoker();

        // Verify caller is the owner
        let pet_key = DataKey::Pet(record_hash.clone());
        let pet: PetRecord = env.storage().instance().get(&pet_key)
            .expect("pet record not found");
        assert_eq!(pet.owner, owner, "only owner can view vet list");

        let vets_key = DataKey::VetsForPet(record_hash);
        env.storage().instance().get(&vets_key).unwrap_or(Vec::new(&env))
    }

    /// Get all pets owned by an address
    pub fn get_owner_pets(env: Env, owner: Address) -> Vec<BytesN<32>> {
        let owner_key = DataKey::Owner(owner);
        env.storage().instance().get(&owner_key).unwrap_or(Vec::new(&env))
    }

    /// Deactivate a pet record (soft delete)
    /// Only the owner can deactivate
    pub fn deactivate_pet(env: Env, record_hash: BytesN<32>) {
        let owner = env.invoker();

        let pet_key = DataKey::Pet(record_hash.clone());
        let mut pet: PetRecord = env.storage().instance().get(&pet_key)
            .expect("pet record not found");
        assert_eq!(pet.owner, owner, "only owner can deactivate");

        pet.active = false;
        pet.updated_at = env.ledger().timestamp();
        env.storage().instance().set(&pet_key, &pet);

        env.events().publish(
            (symbol_short!("PET_DEAC"), owner),
            record_hash,
        );
    }
}
