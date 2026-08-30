#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    Symbol, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    RecordAlreadyExists = 3,
    RecordNotFound = 4,
    NotOwner = 5,
    Unauthorized = 6,
    VetAccessAlreadyGranted = 7,
    VetAccessNotFound = 8,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PetRecord {
    pub record_hash: BytesN<32>,
    pub owner: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Record(Symbol),             // pet_id -> PetRecord
    VetAccess(Address, Symbol), // (vet, pet_id) -> bool
    VetPets(Address),           // vet -> Vec<Symbol> (accessible pet_ids)
    OwnerPets(Address),         // owner -> Vec<Symbol> (owned pet_ids)
}

const DAY_IN_LEDGERS: u32 = 17280; // ~5 seconds per ledger
const INSTANCE_BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_LIFETIME_THRESHOLD: u32 = INSTANCE_BUMP_AMOUNT - DAY_IN_LEDGERS;
const PERSISTENT_BUMP_AMOUNT: u32 = 120 * DAY_IN_LEDGERS;
const PERSISTENT_LIFETIME_THRESHOLD: u32 = PERSISTENT_BUMP_AMOUNT - (30 * DAY_IN_LEDGERS);

#[contract]
pub struct PetRecordRegistry;

#[contractimpl]
impl PetRecordRegistry {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().extend_ttl(INSTANCE_LIFETIME_THRESHOLD, INSTANCE_BUMP_AMOUNT);
        Ok(())
    }

    /// Retrieve the admin address
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    /// Store a new pet record hash on-chain. Only the pet owner can register.
    pub fn register_pet_record(
        env: Env,
        owner: Address,
        pet_id: Symbol,
        record_hash: BytesN<32>,
    ) -> Result<(), Error> {
        owner.require_auth();

        let record_key = DataKey::Record(pet_id.clone());
        if env.storage().persistent().has(&record_key) {
            return Err(Error::RecordAlreadyExists);
        }

        let record = PetRecord {
            record_hash: record_hash.clone(),
            owner: owner.clone(),
            timestamp: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&record_key, &record);
        env.storage().persistent().extend_ttl(
            &record_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        // Update owner's list of pets
        let owner_key = DataKey::OwnerPets(owner.clone());
        let mut owner_pets: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&owner_key)
            .unwrap_or_else(|| Vec::new(&env));

        let mut already_present = false;
        for i in 0..owner_pets.len() {
            if owner_pets.get(i).unwrap() == pet_id {
                already_present = true;
                break;
            }
        }
        if !already_present {
            owner_pets.push_back(pet_id.clone());
            env.storage().persistent().set(&owner_key, &owner_pets);
            env.storage().persistent().extend_ttl(
                &owner_key,
                PERSISTENT_LIFETIME_THRESHOLD,
                PERSISTENT_BUMP_AMOUNT,
            );
        }

        // Publish event for indexing
        env.events().publish(
            (symbol_short!("pet_reg"), pet_id, owner),
            record_hash,
        );

        Ok(())
    }

    /// Update an existing pet record hash. Only the pet owner can update.
    pub fn update_pet_record(
        env: Env,
        owner: Address,
        pet_id: Symbol,
        new_record_hash: BytesN<32>,
    ) -> Result<(), Error> {
        owner.require_auth();

        let record_key = DataKey::Record(pet_id.clone());
        let mut record: PetRecord = env
            .storage()
            .persistent()
            .get(&record_key)
            .ok_or(Error::RecordNotFound)?;

        if record.owner != owner {
            return Err(Error::NotOwner);
        }

        record.record_hash = new_record_hash.clone();
        record.timestamp = env.ledger().timestamp();

        env.storage().persistent().set(&record_key, &record);
        env.storage().persistent().extend_ttl(
            &record_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        env.events().publish(
            (symbol_short!("pet_upd"), pet_id, owner),
            new_record_hash,
        );

        Ok(())
    }

    /// Grant a vet read access to a specific pet's record.
    pub fn grant_vet_access(
        env: Env,
        owner: Address,
        vet: Address,
        pet_id: Symbol,
    ) -> Result<(), Error> {
        owner.require_auth();

        let record_key = DataKey::Record(pet_id.clone());
        let record: PetRecord = env
            .storage()
            .persistent()
            .get(&record_key)
            .ok_or(Error::RecordNotFound)?;

        if record.owner != owner {
            return Err(Error::NotOwner);
        }

        // Set direct boolean access key
        let access_key = DataKey::VetAccess(vet.clone(), pet_id.clone());
        env.storage().persistent().set(&access_key, &true);
        env.storage().persistent().extend_ttl(
            &access_key,
            PERSISTENT_LIFETIME_THRESHOLD,
            PERSISTENT_BUMP_AMOUNT,
        );

        // Add to vet's list of accessible pets
        let vet_pets_key = DataKey::VetPets(vet.clone());
        let mut vet_pets: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&vet_pets_key)
            .unwrap_or_else(|| Vec::new(&env));

        let mut exists = false;
        for i in 0..vet_pets.len() {
            if vet_pets.get(i).unwrap() == pet_id {
                exists = true;
                break;
            }
        }
        if !exists {
            vet_pets.push_back(pet_id.clone());
            env.storage().persistent().set(&vet_pets_key, &vet_pets);
            env.storage().persistent().extend_ttl(
                &vet_pets_key,
                PERSISTENT_LIFETIME_THRESHOLD,
                PERSISTENT_BUMP_AMOUNT,
            );
        }

        env.events().publish(
            (symbol_short!("vet_grnt"), vet, pet_id),
            owner,
        );

        Ok(())
    }

    /// Revoke a vet's read access to a specific pet's record.
    pub fn revoke_vet_access(
        env: Env,
        owner: Address,
        vet: Address,
        pet_id: Symbol,
    ) -> Result<(), Error> {
        owner.require_auth();

        let record_key = DataKey::Record(pet_id.clone());
        let record: PetRecord = env
            .storage()
            .persistent()
            .get(&record_key)
            .ok_or(Error::RecordNotFound)?;

        if record.owner != owner {
            return Err(Error::NotOwner);
        }

        // Remove access flag
        let access_key = DataKey::VetAccess(vet.clone(), pet_id.clone());
        env.storage().persistent().remove(&access_key);

        // Remove from vet's pet list
        let vet_pets_key = DataKey::VetPets(vet.clone());
        if let Some(mut vet_pets) = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<Symbol>>(&vet_pets_key)
        {
            let len = vet_pets.len();
            for i in 0..len {
                if vet_pets.get(i).unwrap() == pet_id {
                    vet_pets.remove(i);
                    break;
                }
            }
            env.storage().persistent().set(&vet_pets_key, &vet_pets);
            env.storage().persistent().extend_ttl(
                &vet_pets_key,
                PERSISTENT_LIFETIME_THRESHOLD,
                PERSISTENT_BUMP_AMOUNT,
            );
        }

        env.events().publish(
            (symbol_short!("vet_revk"), vet, pet_id),
            owner,
        );

        Ok(())
    }

    /// Read pet record. Callable by owner or authorized vet.
    pub fn get_record(env: Env, requester: Address, pet_id: Symbol) -> Result<PetRecord, Error> {
        requester.require_auth();

        let record_key = DataKey::Record(pet_id.clone());
        let record: PetRecord = env
            .storage()
            .persistent()
            .get(&record_key)
            .ok_or(Error::RecordNotFound)?;

        // Check if requester is owner
        if record.owner == requester {
            return Ok(record);
        }

        // Check if requester is authorized vet
        let access_key = DataKey::VetAccess(requester, pet_id);
        let has_access = env
            .storage()
            .persistent()
            .get::<DataKey, bool>(&access_key)
            .unwrap_or(false);

        if has_access {
            return Ok(record);
        }

        Err(Error::Unauthorized)
    }

    /// Query vet authorization status for a specific pet.
    pub fn check_vet_access(env: Env, vet: Address, pet_id: Symbol) -> bool {
        let access_key = DataKey::VetAccess(vet, pet_id);
        env.storage()
            .persistent()
            .get::<DataKey, bool>(&access_key)
            .unwrap_or(false)
    }

    /// Get all pet IDs accessible by a specific vet.
    pub fn get_vet_pets(env: Env, vet: Address) -> Vec<Symbol> {
        let vet_pets_key = DataKey::VetPets(vet);
        env.storage()
            .persistent()
            .get(&vet_pets_key)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Get all pet IDs registered by an owner.
    pub fn get_owner_pets(env: Env, owner: Address) -> Vec<Symbol> {
        let owner_pets_key = DataKey::OwnerPets(owner);
        env.storage()
            .persistent()
            .get(&owner_pets_key)
            .unwrap_or_else(|| Vec::new(&env))
    }
}

#[cfg(test)]
mod test;
