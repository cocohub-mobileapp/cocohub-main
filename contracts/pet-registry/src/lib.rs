#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, String,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NotFound = 1,
    Unauthorized = 2,
    AlreadyExists = 3,
    InvalidRecord = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PetRecord {
    pub pet_id: String,
    pub record_hash: BytesN<32>,
    pub owner: Address,
    pub updated_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Record(String),
    VetAccess(String, Address),
}

#[contract]
pub struct PetRegistryContract;

#[contractimpl]
impl PetRegistryContract {
    /// Store or update an on-chain pet record hash (non-PII)
    pub fn store_record(
        env: Env,
        owner: Address,
        pet_id: String,
        record_hash: BytesN<32>,
    ) -> Result<PetRecord, Error> {
        owner.require_auth();

        let key = DataKey::Record(pet_id.clone());
        let now = env.ledger().timestamp();

        let record = PetRecord {
            pet_id: pet_id.clone(),
            record_hash,
            owner,
            updated_at: now,
        };

        env.storage().persistent().set(&key, &record);
        Ok(record)
    }

    /// Grant a licensed veterinarian access to the pet record
    pub fn grant_vet_access(
        env: Env,
        owner: Address,
        pet_id: String,
        vet: Address,
    ) -> Result<(), Error> {
        owner.require_auth();

        let record_key = DataKey::Record(pet_id.clone());
        let record: PetRecord = env
            .storage()
            .persistent()
            .get(&record_key)
            .ok_or(Error::NotFound)?;

        if record.owner != owner {
            return Err(Error::Unauthorized);
        }

        let access_key = DataKey::VetAccess(pet_id, vet);
        env.storage().persistent().set(&access_key, &true);
        Ok(())
    }

    /// Revoke veterinarian access
    pub fn revoke_vet_access(
        env: Env,
        owner: Address,
        pet_id: String,
        vet: Address,
    ) -> Result<(), Error> {
        owner.require_auth();

        let record_key = DataKey::Record(pet_id.clone());
        let record: PetRecord = env
            .storage()
            .persistent()
            .get(&record_key)
            .ok_or(Error::NotFound)?;

        if record.owner != owner {
            return Err(Error::Unauthorized);
        }

        let access_key = DataKey::VetAccess(pet_id, vet);
        env.storage().persistent().remove(&access_key);
        Ok(())
    }

    /// Retrieve pet record with role-based access control
    pub fn get_record(env: Env, caller: Address, pet_id: String) -> Result<PetRecord, Error> {
        let record_key = DataKey::Record(pet_id.clone());
        let record: PetRecord = env
            .storage()
            .persistent()
            .get(&record_key)
            .ok_or(Error::NotFound)?;

        // Owner always has access
        if record.owner == caller {
            return Ok(record);
        }

        // Check if caller is authorized vet
        let access_key = DataKey::VetAccess(pet_id, caller);
        let has_access: bool = env.storage().persistent().get(&access_key).unwrap_or(false);

        if has_access {
            Ok(record)
        } else {
            Err(Error::Unauthorized)
        }
    }

    /// Check if vet has access to pet record
    pub fn has_vet_access(env: Env, pet_id: String, vet: Address) -> bool {
        let access_key = DataKey::VetAccess(pet_id, vet);
        env.storage().persistent().get(&access_key).unwrap_or(false)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};

    #[test]
    fn test_pet_registry_workflow() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PetRegistryContract);
        let client = PetRegistryContractClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let vet = Address::generate(&env);
        let stranger = Address::generate(&env);

        let pet_id = String::from_str(&env, "pet_coco_101");
        let hash_bytes = [7u8; 32];
        let record_hash = BytesN::from_array(&env, &hash_bytes);

        // Store record
        env.mock_all_auths();
        let record = client.store_record(&owner, &pet_id, &record_hash);
        assert_eq!(record.pet_id, pet_id);
        assert_eq!(record.owner, owner);

        // Owner can read
        let fetched_owner = client.get_record(&owner, &pet_id);
        assert_eq!(fetched_owner.record_hash, record_hash);

        // Stranger cannot read
        assert_eq!(client.try_get_record(&stranger, &pet_id), Err(Ok(Error::Unauthorized)));

        // Grant vet access
        client.grant_vet_access(&owner, &pet_id, &vet);
        assert_eq!(client.has_vet_access(&pet_id, &vet), true);

        // Vet can now read
        let fetched_vet = client.get_record(&vet, &pet_id);
        assert_eq!(fetched_vet.record_hash, record_hash);

        // Revoke vet access
        client.revoke_vet_access(&owner, &pet_id, &vet);
        assert_eq!(client.has_vet_access(&pet_id, &vet), false);
        assert_eq!(client.try_get_record(&vet, &pet_id), Err(Ok(Error::Unauthorized)));
    }
}
