#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, vec, Address, BytesN, Env, Map, Symbol, Vec};

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
    Records(Symbol),       // pet_id -> PetRecord
    VetAccess(Address),    // vet -> Vec<Symbol> (pet_ids they can access)
    Admin,
}

#[contract]
pub struct PetRecordRegistry;

#[contractimpl]
impl PetRecordRegistry {
    /// Initialize the contract with an admin address
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Store a pet record hash on-chain. Only the pet owner can register.
    pub fn register_pet_record(
        env: Env,
        owner: Address,
        pet_id: Symbol,
        record_hash: BytesN<32>,
    ) {
        owner.require_auth();

        let key = DataKey::Records(pet_id.clone());
        if env.storage().persistent().has(&key) {
            panic!("record already exists");
        }

        let record = PetRecord {
            record_hash: record_hash.clone(),
            owner: owner.clone(),
            timestamp: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &record);

        // Emit event for off-chain indexing
        env.events()
            .publish(
                (symbol_short!("recorded"), pet_id),
                record_hash,
            );
    }

    /// Grant vet access to a specific pet's records
    pub fn grant_vet_access(
        env: Env,
        owner: Address,
        vet: Address,
        pet_id: Symbol,
    ) {
        owner.require_auth();

        // Verify the owner actually owns this pet
        let record_key = DataKey::Records(pet_id.clone());
        let record: PetRecord = env
            .storage()
            .persistent()
            .get(&record_key)
            .unwrap_or_else(|| panic!("record not found"));

        if record.owner != owner {
            panic!("not the pet owner");
        }

        // Add to vet access list
        let vet_key = DataKey::VetAccess(vet.clone());
        let mut pet_ids: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&vet_key)
            .unwrap_or_else(|| Vec::new(&env));

        if !pet_ids.contains(&pet_id) {
            pet_ids.push_back(pet_id.clone());
            env.storage().persistent().set(&vet_key, &pet_ids);
        }

        env.events()
            .publish(
                (symbol_short!("vet_grant"), vet, pet_id),
                owner,
            );
    }

    /// Revoke vet access to a specific pet's records
    pub fn revoke_vet_access(
        env: Env,
        owner: Address,
        vet: Address,
        pet_id: Symbol,
    ) {
        owner.require_auth();

        let vet_key = DataKey::VetAccess(vet.clone());
        let mut pet_ids: Vec<Symbol> = env
            .storage()
            .persistent()
            .get(&vet_key)
            .unwrap_or_else(|| Vec::new(&env));

        let len = pet_ids.len();
        for i in 0..len {
            if pet_ids.get(i).unwrap() == pet_id {
                pet_ids.remove(i);
                break;
            }
        }

        env.storage().persistent().set(&vet_key, &pet_ids);

        env.events()
            .publish(
                (symbol_short!("vet_revoke"), vet, pet_id),
                owner,
            );
    }

    /// Get a pet record hash. Callable by owner or authorized vet.
    pub fn get_record(env: Env, requester: Address, pet_id: Symbol) -> PetRecord {
        requester.require_auth();

        let record_key = DataKey::Records(pet_id.clone());
        let record: PetRecord = env
            .storage()
            .persistent()
            .get(&record_key)
            .unwrap_or_else(|| panic!("record not found"));

        // Allow if requester is the owner
        if record.owner == requester {
            return record;
        }

        // Allow if requester is an authorized vet
        let vet_key = DataKey::VetAccess(requester);
        if let Some(pet_ids) = env.storage().persistent().get::<DataKey, Vec<Symbol>>(&vet_key) {
            if pet_ids.contains(&pet_id) {
                return record;
            }
        }

        panic!("access denied");
    }

    /// Check if a vet has access to a specific pet
    pub fn check_vet_access(env: Env, vet: Address, pet_id: Symbol) -> bool {
        let vet_key = DataKey::VetAccess(vet);
        if let Some(pet_ids) = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<Symbol>>(&vet_key)
        {
            return pet_ids.contains(&pet_id);
        }
        false
    }

    /// Get all pets a vet has access to
    pub fn get_vet_pets(env: Env, vet: Address) -> Vec<Symbol> {
        let vet_key = DataKey::VetAccess(vet);
        env.storage()
            .persistent()
            .get(&vet_key)
            .unwrap_or_else(|| Vec::new(&env))
    }
}

mod test;
