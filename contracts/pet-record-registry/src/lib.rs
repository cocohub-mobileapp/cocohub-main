#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    String, Symbol, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RegistryError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    PetAlreadyExists = 4,
    PetNotFound = 5,
    RecordNotFound = 6,
    AccessDenied = 7,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PetMetadata {
    pub pet_id: String,
    pub owner: Address,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MedicalRecordEntry {
    pub record_id: String,
    pub record_hash: BytesN<32>,
    pub timestamp: u64,
    pub created_by: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Pet(String),
    PetOwner(String),
    PetRecords(String),
    VetAccess(String, Address), // (pet_id, vet_address) -> bool
    OwnerPets(Address),         // list of pet_ids owned by Address
}

const REGISTRY: Symbol = symbol_short!("registry");

#[contract]
pub struct PetRecordRegistry;

#[contractimpl]
impl PetRecordRegistry {
    /// Initialize the registry contract with an admin account
    pub fn initialize(env: Env, admin: Address) -> Result<(), RegistryError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(RegistryError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Register a new pet under owner custody
    pub fn register_pet(
        env: Env,
        owner: Address,
        pet_id: String,
    ) -> Result<(), RegistryError> {
        owner.require_auth();

        let key = DataKey::Pet(pet_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(RegistryError::PetAlreadyExists);
        }

        let now = env.ledger().timestamp();
        let meta = PetMetadata {
            pet_id: pet_id.clone(),
            owner: owner.clone(),
            created_at: now,
        };

        env.storage().persistent().set(&key, &meta);
        env.storage()
            .persistent()
            .set(&DataKey::PetOwner(pet_id.clone()), &owner);

        // Track pet under owner list
        let owner_key = DataKey::OwnerPets(owner.clone());
        let mut pets: Vec<String> = env
            .storage()
            .persistent()
            .get(&owner_key)
            .unwrap_or_else(|| Vec::new(&env));
        pets.push_back(pet_id.clone());
        env.storage().persistent().set(&owner_key, &pets);

        // Emit registration event
        env.events().publish(
            (REGISTRY, symbol_short!("reg_pet"), owner),
            pet_id,
        );

        Ok(())
    }

    /// Grant a licensed veterinarian read access to the pet's records
    pub fn grant_vet_access(
        env: Env,
        owner: Address,
        pet_id: String,
        vet: Address,
    ) -> Result<(), RegistryError> {
        owner.require_auth();

        let owner_key = DataKey::PetOwner(pet_id.clone());
        let stored_owner: Address = env
            .storage()
            .persistent()
            .get(&owner_key)
            .ok_or(RegistryError::PetNotFound)?;

        if stored_owner != owner {
            return Err(RegistryError::Unauthorized);
        }

        env.storage()
            .persistent()
            .set(&DataKey::VetAccess(pet_id.clone(), vet.clone()), &true);

        env.events().publish(
            (REGISTRY, symbol_short!("vet_grant"), owner),
            (pet_id, vet),
        );

        Ok(())
    }

    /// Revoke a veterinarian's read access
    pub fn revoke_vet_access(
        env: Env,
        owner: Address,
        pet_id: String,
        vet: Address,
    ) -> Result<(), RegistryError> {
        owner.require_auth();

        let owner_key = DataKey::PetOwner(pet_id.clone());
        let stored_owner: Address = env
            .storage()
            .persistent()
            .get(&owner_key)
            .ok_or(RegistryError::PetNotFound)?;

        if stored_owner != owner {
            return Err(RegistryError::Unauthorized);
        }

        env.storage()
            .persistent()
            .set(&DataKey::VetAccess(pet_id.clone(), vet.clone()), &false);

        env.events().publish(
            (REGISTRY, symbol_short!("vet_revok"), owner),
            (pet_id, vet),
        );

        Ok(())
    }

    /// Store a medical record cryptographic hash (SHA-256) on-chain
    pub fn anchor_record(
        env: Env,
        caller: Address,
        pet_id: String,
        record_id: String,
        record_hash: BytesN<32>,
    ) -> Result<(), RegistryError> {
        caller.require_auth();

        let owner_key = DataKey::PetOwner(pet_id.clone());
        let owner: Address = env
            .storage()
            .persistent()
            .get(&owner_key)
            .ok_or(RegistryError::PetNotFound)?;

        // Only the pet owner or an authorized vet can anchor records
        let is_owner = caller == owner;
        let is_vet = env
            .storage()
            .persistent()
            .get(&DataKey::VetAccess(pet_id.clone(), caller.clone()))
            .unwrap_or(false);

        if !is_owner && !is_vet {
            return Err(RegistryError::AccessDenied);
        }

        let now = env.ledger().timestamp();
        let record = MedicalRecordEntry {
            record_id: record_id.clone(),
            record_hash: record_hash.clone(),
            timestamp: now,
            created_by: caller.clone(),
        };

        let records_key = DataKey::PetRecords(pet_id.clone());
        let mut records: Vec<MedicalRecordEntry> = env
            .storage()
            .persistent()
            .get(&records_key)
            .unwrap_or_else(|| Vec::new(&env));

        records.push_back(record);
        env.storage().persistent().set(&records_key, &records);

        // Emit on-chain anchor event
        env.events().publish(
            (REGISTRY, symbol_short!("anchor"), pet_id),
            (record_id, record_hash),
        );

        Ok(())
    }

    /// Read on-chain medical records for a pet with RBAC enforcement
    pub fn get_records(
        env: Env,
        caller: Address,
        pet_id: String,
    ) -> Result<Vec<MedicalRecordEntry>, RegistryError> {
        caller.require_auth();

        let owner_key = DataKey::PetOwner(pet_id.clone());
        let owner: Address = env
            .storage()
            .persistent()
            .get(&owner_key)
            .ok_or(RegistryError::PetNotFound)?;

        let is_owner = caller == owner;
        let is_vet = env
            .storage()
            .persistent()
            .get(&DataKey::VetAccess(pet_id.clone(), caller.clone()))
            .unwrap_or(false);

        if !is_owner && !is_vet {
            return Err(RegistryError::AccessDenied);
        }

        let records_key = DataKey::PetRecords(pet_id);
        let records = env
            .storage()
            .persistent()
            .get(&records_key)
            .unwrap_or_else(|| Vec::new(&env));

        Ok(records)
    }

    /// Check whether a vet has active read access to a pet's records
    pub fn has_vet_access(
        env: Env,
        pet_id: String,
        vet: Address,
    ) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::VetAccess(pet_id, vet))
            .unwrap_or(false)
    }

    /// Get owner address for a pet
    pub fn get_pet_owner(
        env: Env,
        pet_id: String,
    ) -> Result<Address, RegistryError> {
        env.storage()
            .persistent()
            .get(&DataKey::PetOwner(pet_id))
            .ok_or(RegistryError::PetNotFound)
    }
}

#[cfg(test)]
mod test;
