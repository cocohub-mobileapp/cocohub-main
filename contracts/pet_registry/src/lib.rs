#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    PetRecord(Symbol), // Pet ID -> Record Hash
    Owner(Symbol),     // Pet ID -> Owner Address
    VetAccess(Symbol), // Pet ID -> Set of Vet Addresses
    Admin,
}

#[contracttype]
#[derive(Clone)]
pub struct PetRecord {
    pub hash: [u8; 32],
}

#[contract]
pub struct PetRegistry;

#[contractimpl]
impl PetRegistry {
    /// Registra um novo pet no sistema. Apenas o chamador pode ser o dono inicial.
    pub fn register_pet(env: Env, pet_id: Symbol, record_hash: [u8; 32], owner: Address) {
        owner.require_auth();
        
        // Verifica se o pet já existe
        if env.storage().persistent().has(&DataKey::PetRecord(pet_id)) {
            panic!("Pet already registered");
        }

        env.storage().persistent().set(&DataKey::PetRecord(pet_id), record_hash);
        env.storage().persistent().set(&DataKey::Owner(pet_id), owner);
    }

    /// Concede acesso de leitura a um veterinário para um pet específico.
    pub fn grant_vet_access(env: Env, pet_id: Symbol, vet: Address) {
        let owner: Address = env.storage().persistent().get(&DataKey::Owner(pet_id))
            .expect("Pet not found");
        
        owner.require_auth();
        vet.require_auth();

        let mut vets: Vec<Address> = env.storage().persistent().get(&DataKey::VetAccess(pet_id))
            .unwrap_or(Vec::new());
        
        if !vets.includes(&vet) {
            vets.push_back(vet);
            env.storage().persistent().set(&DataKey::VetAccess(pet_id), vets);
        }
    }

    /// Revoga acesso de um veterinário.
    pub fn revoke_vet_access(env: Env, pet_id: Symbol, vet: Address) {
        let owner: Address = env.storage().persistent().get(&DataKey::Owner(pet_id))
            .expect("Pet not found");
        
        owner.require_auth();

        let mut vets: Vec<Address> = env.storage().persistent().get(&DataKey::VetAccess(pet_id))
            .unwrap_or(Vec::new());
        
        let mut new_vets = Vec::new();
        let mut found = false;
        for i in 0..vets.len() {
            let v = vets.get(i).unwrap();
            if v != vet {
                new_vets.push_back(v);
            } else {
                found = true;
            }
        }

        if found {
            env.storage().persistent().set(&DataKey::VetAccess(pet_id), new_vets);
        }
    }

    /// Recupera o hash do registro do pet. Apenas dono ou vet autorizado podem ler.
    pub fn get_pet_record(env: Env, pet_id: Symbol, caller: Address) -> [u8; 32] {
        let owner: Address = env.storage().persistent().get(&DataKey::Owner(pet_id))
            .expect("Pet not found");

        if caller != owner {
            let vets: Vec<Address> = env.storage().persistent().get(&DataKey::VetAccess(pet_id))
                .unwrap_or(Vec::new());
            
            if !vets.includes(&caller) {
                panic!("Unauthorized: Only owner or authorized vet can access");
            }
        }

        env.storage().persistent().get(&DataKey::PetRecord(pet_id))
            .expect("Record not found")
    }
}
