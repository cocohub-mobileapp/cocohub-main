use soroban_sdk::{contractimpl, symbol_short, vec, Address, Env, Symbol};

#[derive(Clone)]
pub struct PetRecord {
    pub owner: Address,
    pub vet: Option<Address>,
    pub record_hash: Vec<u8>,
}

pub struct PetRecordRegistry;

#[contractimpl]
impl PetRecordRegistry {
    pub fn register_pet(env: Env, owner: Address, record_hash: Vec<u8>) -> () {
        let records: Vec<PetRecord> = env.storage().persistent().get(&symbol_short!("records")).unwrap_or_default();
        let new_record = PetRecord {
            owner,
            vet: None,
            record_hash,
        };
        let mut updated_records = records;
        updated_records.push(new_record);
        env.storage().persistent().set(&symbol_short!("records"), &updated_records);
    }

    pub fn grant_vet_access(env: Env, pet_id: u32, vet: Address) -> () {
        let mut records: Vec<PetRecord> = env.storage().persistent().get(&symbol_short!("records")).unwrap_or_default();
        if let Some(record) = records.get_mut(pet_id as usize) {
            record.vet = Some(vet);
            env.storage().persistent().set(&symbol_short!("records"), &records);
        }
    }

    pub fn revoke_vet_access(env: Env, pet_id: u32) -> () {
        let mut records: Vec<PetRecord> = env.storage().persistent().get(&symbol_short!("records")).unwrap_or_default();
        if let Some(record) = records.get_mut(pet_id as usize) {
            record.vet = None;
            env.storage().persistent().set(&symbol_short!("records"), &records);
        }
    }

    pub fn get_pet_record(env: Env, pet_id: u32) -> Option<PetRecord> {
        let records: Vec<PetRecord> = env.storage().persistent().get(&symbol_short!("records")).unwrap_or_default();
        records.get(pet_id as usize).cloned()
    }
}
