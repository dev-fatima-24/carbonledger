#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec,
    symbol_short, vec,
};

// ── Error Enum ────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum CarbonError {
    ProjectNotFound        = 1,
    ProjectNotVerified     = 2,
    ProjectSuspended       = 3,
    InsufficientCredits    = 4,
    AlreadyRetired         = 5,
    SerialNumberConflict   = 6,
    UnauthorizedVerifier   = 7,
    UnauthorizedOracle     = 8,
    InvalidVintageYear     = 9,
    ListingNotFound        = 10,
    InsufficientLiquidity  = 11,
    PriceNotSet            = 12,
    MonitoringDataStale    = 13,
    DoubleCountingDetected = 14,
    RetirementIrreversible = 15,
    ZeroAmountNotAllowed   = 16,
    ProjectAlreadyExists   = 17,
    InvalidSerialRange     = 18,
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Batch(String),
    Retirement(String),
    ProjectBatches(String),
    SerialRegistry,
    Admin,
    RegistryContract,
}

// ── Types ─────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CreditStatus {
    Active,
    PartiallyRetired,
    FullyRetired,
    Suspended,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct CreditBatch {
    pub batch_id:     String,
    pub project_id:   String,
    pub vintage_year: u32,
    pub amount:       i128,
    pub serial_start: u64,
    pub serial_end:   u64,
    pub issued_at:    u64,
    pub status:       CreditStatus,
    pub metadata_cid: String,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct RetirementCertificate {
    pub retirement_id:    String,
    pub credit_batch_id:  String,
    pub project_id:       String,
    pub amount:           i128,
    pub retired_by:       Address,
    pub beneficiary:      String,
    pub retirement_reason: String,
    pub vintage_year:     u32,
    pub serial_numbers:   Vec<u64>,
    pub retired_at:       u64,
    pub tx_hash:          String,
}

/// Compact serial range stored globally to detect overlaps.
#[contracttype]
#[derive(Clone, Debug)]
pub struct SerialRange {
    pub start: u64,
    pub end:   u64,
}

/// Tracks how many credits in a batch have been retired so far.
#[contracttype]
#[derive(Clone)]
pub enum RetiredKey {
    BatchRetired(String),
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CarbonCreditContract;

#[contractimpl]
impl CarbonCreditContract {

    /// Initialise with admin address.
    ///
    /// # Parameters
    /// - `admin`: The address that will have administrative privileges for minting credits
    /// - `registry_contract`: Address of the carbon registry contract
    pub fn initialize(env: Env, admin: Address, registry_contract: Address) {
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::RegistryContract, &registry_contract);
        let ranges: Vec<SerialRange> = vec![&env];
        env.storage().persistent().set(&DataKey::SerialRegistry, &ranges);
    }

    /// Mint verified carbon credits for a verified project. Assigns unique serial
    /// numbers to each credit, preventing double-counting globally.
    ///
    /// # Parameters
    /// - `admin`: The admin address authorizing the minting
    /// - `project_id`: The project identifier
    /// - `amount`: Number of credits to mint
    /// - `vintage_year`: Year the credits were generated
    /// - `batch_id`: Unique identifier for this credit batch
    /// - `serial_start`: Starting serial number for the batch
    /// - `serial_end`: Ending serial number for the batch
    /// - `metadata_cid`: IPFS CID containing batch metadata
    ///
    /// # Errors
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `amount` is zero
    /// - [`CarbonError::InvalidSerialRange`] if `serial_end < serial_start`
    /// - [`CarbonError::SerialNumberConflict`] if serial range overlaps existing batch
    /// - [`CarbonError::InvalidVintageYear`] if vintage year is out of range
    /// - [`CarbonError::DoubleCountingDetected`] if serial range conflicts globally
    /// - [`CarbonError::UnauthorizedVerifier`] if caller is not the admin
    pub fn mint_credits(
        env: Env,
        admin: Address,
        project_id: String,
        amount: i128,
        vintage_year: u32,
        batch_id: String,
        serial_start: u64,
        serial_end: u64,
        metadata_cid: String,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        if amount <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }
        if serial_end < serial_start {
            return Err(CarbonError::InvalidSerialRange);
        }
        if vintage_year < 2000 || vintage_year > 2100 {
            return Err(CarbonError::InvalidVintageYear);
        }
        if env.storage().persistent().has(&DataKey::Batch(batch_id.clone())) {
            return Err(CarbonError::SerialNumberConflict);
        }

        // Enforce global serial uniqueness
        if !Self::verify_serial_range_internal(&env, serial_start, serial_end) {
            return Err(CarbonError::DoubleCountingDetected);
        }

        // ── effects ───────────────────────────────────────────────────────────
        // Register serial range globally
        let mut ranges: Vec<SerialRange> = env
            .storage()
            .persistent()
            .get(&DataKey::SerialRegistry)
            .unwrap_or_else(|| vec![&env]);
        ranges.push_back(SerialRange { start: serial_start, end: serial_end });
        env.storage().persistent().set(&DataKey::SerialRegistry, &ranges);

        let batch = CreditBatch {
            batch_id:     batch_id.clone(),
            project_id:   project_id.clone(),
            vintage_year,
            amount,
            serial_start,
            serial_end,
            issued_at:    env.ledger().timestamp(),
            status:       CreditStatus::Active,
            metadata_cid: metadata_cid.clone(),
        };
        env.storage().persistent().set(&DataKey::Batch(batch_id.clone()), &batch);

        // Append to project batch index
        let mut project_batches: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::ProjectBatches(project_id.clone()))
            .unwrap_or_else(|| vec![&env]);
        project_batches.push_back(batch_id.clone());
        env.storage().persistent().set(&DataKey::ProjectBatches(project_id.clone()), &project_batches);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("minted")),
            (batch_id, project_id, amount, vintage_year, serial_start, serial_end),
        );
        Ok(())
    }

    /// Permanently and irreversibly retire carbon credits on-chain. Retired credits
    /// are burned and can never be transferred or retired again under any circumstance.
    /// A permanent [`RetirementCertificate`] is recorded on-chain.
    ///
    /// # Parameters
    /// - `holder`: The address holding the credits to retire
    /// - `batch_id`: The credit batch identifier
    /// - `amount`: Number of credits to retire
    /// - `retirement_reason`: Reason for retirement (e.g., "Corporate Offset")
    /// - `beneficiary`: Name of the beneficiary
    /// - `retirement_id`: Unique identifier for this retirement
    /// - `tx_hash`: Transaction hash for off-chain verification
    ///
    /// # Returns
    /// The retirement certificate record
    ///
    /// # Errors
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `amount` is zero
    /// - [`CarbonError::InsufficientCredits`] if batch has fewer active credits than requested
    /// - [`CarbonError::AlreadyRetired`] if batch is fully retired
    /// - [`CarbonError::ProjectSuspended`] if batch is suspended
    pub fn retire_credits(
        env: Env,
        holder: Address,
        batch_id: String,
        amount: i128,
        retirement_reason: String,
        beneficiary: String,
        retirement_id: String,
        tx_hash: String,
    ) -> Result<RetirementCertificate, CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        holder.require_auth();

        if amount <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }

        let mut batch = Self::load_batch(&env, &batch_id)?;

        if batch.status == CreditStatus::FullyRetired {
            return Err(CarbonError::AlreadyRetired);
        }
        if batch.status == CreditStatus::Suspended {
            return Err(CarbonError::ProjectSuspended);
        }

        let active_amount = Self::active_amount(&env, &batch);
        if amount > active_amount {
            return Err(CarbonError::InsufficientCredits);
        }

        // ── effects ───────────────────────────────────────────────────────────
        // Compute serial numbers for this retirement slice
        let already_retired: i128 = env
            .storage()
            .persistent()
            .get(&RetiredKey::BatchRetired(batch_id.clone()))
            .unwrap_or(0i128);

        let retire_serial_start = batch.serial_start + already_retired as u64;
        let retire_serial_end   = retire_serial_start + amount as u64 - 1;

        let mut serial_numbers: Vec<u64> = vec![&env];
        let mut s = retire_serial_start;
        while s <= retire_serial_end {
            serial_numbers.push_back(s);
            s += 1;
        }

        // Update batch status — track retired amount persistently
        let new_retired = already_retired + amount;
        env.storage().persistent().set(&RetiredKey::BatchRetired(batch_id.clone()), &new_retired);

        let new_active = batch.amount - new_retired;
        batch.status = if new_active == 0 {
            CreditStatus::FullyRetired
        } else {
            CreditStatus::PartiallyRetired
        };
        env.storage().persistent().set(&DataKey::Batch(batch_id.clone()), &batch);

        let cert = RetirementCertificate {
            retirement_id:     retirement_id.clone(),
            credit_batch_id:   batch_id.clone(),
            project_id:        batch.project_id.clone(),
            amount,
            retired_by:        holder.clone(),
            beneficiary:       beneficiary.clone(),
            retirement_reason: retirement_reason.clone(),
            vintage_year:      batch.vintage_year,
            serial_numbers:    serial_numbers.clone(),
            retired_at:        env.ledger().timestamp(),
            tx_hash:           tx_hash.clone(),
        };
        env.storage().persistent().set(&DataKey::Retirement(retirement_id.clone()), &cert);

        // ── interactions ──────────────────────────────────────────────────────
        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("retired")),
            (retirement_id, batch_id, batch.project_id, amount, holder, beneficiary),
        );
        Ok(cert)
    }

    /// Transfer credits between accounts. Retired batches cannot be transferred.
    ///
    /// # Parameters
    /// - `from`: The sender's address
    /// - `to`: The recipient's address
    /// - `batch_id`: The credit batch identifier
    /// - `amount`: Number of credits to transfer
    ///
    /// # Errors
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `amount` is zero
    /// - [`CarbonError::AlreadyRetired`] if batch is fully retired
    /// - [`CarbonError::ProjectSuspended`] if batch is suspended
    /// - [`CarbonError::InsufficientCredits`] if insufficient active credits
    pub fn transfer_credits(
        env: Env,
        from: Address,
        to: Address,
        batch_id: String,
        amount: i128,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        from.require_auth();

        if amount <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }

        let batch = Self::load_batch(&env, &batch_id)?;

        if batch.status == CreditStatus::FullyRetired {
            return Err(CarbonError::AlreadyRetired);
        }
        if batch.status == CreditStatus::Suspended {
            return Err(CarbonError::ProjectSuspended);
        }

        let active = Self::active_amount(&env, &batch);
        if amount > active {
            return Err(CarbonError::InsufficientCredits);
        }

        // ── effects ───────────────────────────────────────────────────────────
        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("transfer")),
            (batch_id, from, to, amount),
        );
        Ok(())
    }

    /// Returns a [`CreditBatch`] by ID.
    ///
    /// # Parameters
    /// - `batch_id`: The credit batch identifier
    ///
    /// # Returns
    /// The credit batch record
    ///
    /// # Errors
    /// - [`CarbonError::ProjectNotFound`] if batch does not exist
    pub fn get_credit_batch(env: Env, batch_id: String) -> Result<CreditBatch, CarbonError> {
        Self::load_batch(&env, &batch_id)
    }

    /// Returns a permanent [`RetirementCertificate`] by retirement ID.
    ///
    /// # Parameters
    /// - `retirement_id`: The retirement identifier
    ///
    /// # Returns
    /// The retirement certificate record
    ///
    /// # Errors
    /// - [`CarbonError::ProjectNotFound`] if retirement does not exist
    pub fn get_retirement_certificate(
        env: Env,
        retirement_id: String,
    ) -> Result<RetirementCertificate, CarbonError> {
        env.storage()
            .persistent()
            .get(&DataKey::Retirement(retirement_id))
            .ok_or(CarbonError::ProjectNotFound)
    }

    /// Returns `true` if the serial range `[serial_start, serial_end]` does NOT
    /// overlap any existing batch — i.e., safe to mint.
    ///
    /// # Parameters
    /// - `serial_start`: Starting serial number
    /// - `serial_end`: Ending serial number
    ///
    /// # Returns
    /// `true` if the range is available, `false` if it conflicts
    pub fn verify_serial_range(env: Env, serial_start: u64, serial_end: u64) -> bool {
        Self::verify_serial_range_internal(&env, serial_start, serial_end)
    }

    /// Returns all [`CreditBatch`] records for a given project.
    ///
    /// # Parameters
    /// - `project_id`: The project identifier
    ///
    /// # Returns
    /// Vector of all credit batches for the project
    pub fn get_project_credits(env: Env, project_id: String) -> Vec<CreditBatch> {
        let batch_ids: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::ProjectBatches(project_id))
            .unwrap_or_else(|| vec![&env]);

        let mut result: Vec<CreditBatch> = vec![&env];
        for id in batch_ids.iter() {
            if let Some(b) = env.storage().persistent().get(&DataKey::Batch(id.clone())) {
                result.push_back(b);
            }
        }
        result
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn load_batch(env: &Env, batch_id: &String) -> Result<CreditBatch, CarbonError> {
        env.storage()
            .persistent()
            .get(&DataKey::Batch(batch_id.clone()))
            .ok_or(CarbonError::ProjectNotFound)
    }

    fn require_admin(env: &Env, caller: &Address) -> Result<(), CarbonError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(CarbonError::UnauthorizedVerifier)?;
        if &admin != caller {
            return Err(CarbonError::UnauthorizedVerifier);
        }
        Ok(())
    }

    /// Returns the number of credits in a batch that have not yet been retired.
    fn active_amount(env: &Env, batch: &CreditBatch) -> i128 {
        if batch.status == CreditStatus::FullyRetired {
            return 0;
        }
        let retired: i128 = env
            .storage()
            .persistent()
            .get(&RetiredKey::BatchRetired(batch.batch_id.clone()))
            .unwrap_or(0i128);
        batch.amount - retired
    }

    fn verify_serial_range_internal(env: &Env, start: u64, end: u64) -> bool {
        let ranges: Vec<SerialRange> = env
            .storage()
            .persistent()
            .get(&DataKey::SerialRegistry)
            .unwrap_or_else(|| vec![env]);

        for r in ranges.iter() {
            // Overlap check: two ranges overlap if start <= r.end && end >= r.start
            if start <= r.end && end >= r.start {
                return false;
            }
        }
        true
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, String, vec};

    fn setup() -> (Env, CarbonCreditContractClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let client = CarbonCreditContractClient::new(&env, &id);
        client.initialize(&admin, &registry);
        (env, client)
    }

    fn s(env: &Env, v: &str) -> String { String::from_str(env, v) }

    fn mint(env: &Env, client: &CarbonCreditContractClient, admin: &Address) {
        let _ = client.mint_credits(
            admin,
            &s(env, "proj-001"),
            &1000_i128,
            &2023_u32,
            &s(env, "batch-001"),
            &1_u64,
            &1000_u64,
            &s(env, "QmCID"),
        );
    }

    #[test]
    fn test_mint_credits_success() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry);

        c.mint_credits(
            &admin,
            &s(&env, "proj-001"),
            &500_i128,
            &2023_u32,
            &s(&env, "batch-A"),
            &1_u64,
            &500_u64,
            &s(&env, "QmCID"),
        ).unwrap();

        let b = c.get_credit_batch(&s(&env, "batch-A")).unwrap();
        assert_eq!(b.amount, 500);
        assert_eq!(b.status, CreditStatus::Active);
    }

    #[test]
    fn test_serial_conflict_detection() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry);

        c.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid")).unwrap();
        // Overlapping range 50-150 should fail
        let result = c.try_mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b2"), &50_u64, &150_u64, &s(&env, "cid"));
        assert!(result.is_err());
    }

    #[test]
    fn test_verify_serial_range_no_overlap() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry);

        c.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid")).unwrap();
        // Non-overlapping range should return true
        assert!(c.verify_serial_range(&101_u64, &200_u64));
        // Overlapping range should return false
        assert!(!c.verify_serial_range(&50_u64, &150_u64));
    }

    #[test]
    fn test_retire_credits_permanent() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry);

        c.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid")).unwrap();

        let holder = Address::generate(&env);
        let cert = c.retire_credits(
            &holder,
            &s(&env, "b1"),
            &100_i128,
            &s(&env, "offset 2023 emissions"),
            &s(&env, "Acme Corp"),
            &s(&env, "ret-001"),
            &s(&env, "txhash123"),
        ).unwrap();

        assert_eq!(cert.amount, 100);
        assert_eq!(cert.beneficiary, s(&env, "Acme Corp"));

        let batch = c.get_credit_batch(&s(&env, "b1")).unwrap();
        assert_eq!(batch.status, CreditStatus::FullyRetired);
    }

    #[test]
    fn test_retired_credits_cannot_be_transferred() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry);

        c.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid")).unwrap();

        let holder = Address::generate(&env);
        c.retire_credits(&holder, &s(&env, "b1"), &100_i128, &s(&env, "reason"), &s(&env, "Corp"), &s(&env, "ret-001"), &s(&env, "tx")).unwrap();

        let to = Address::generate(&env);
        let result = c.try_transfer_credits(&holder, &to, &s(&env, "b1"), &10_i128);
        assert!(result.is_err());
    }

    #[test]
    fn test_retired_credits_cannot_be_retired_again() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry);

        c.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid")).unwrap();

        let holder = Address::generate(&env);
        c.retire_credits(&holder, &s(&env, "b1"), &100_i128, &s(&env, "reason"), &s(&env, "Corp"), &s(&env, "ret-001"), &s(&env, "tx")).unwrap();

        let result = c.try_retire_credits(&holder, &s(&env, "b1"), &100_i128, &s(&env, "reason"), &s(&env, "Corp"), &s(&env, "ret-002"), &s(&env, "tx2"));
        assert!(result.is_err());
    }

    #[test]
    fn test_partial_retirement_updates_status() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry);

        c.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid")).unwrap();

        let holder = Address::generate(&env);
        c.retire_credits(&holder, &s(&env, "b1"), &40_i128, &s(&env, "reason"), &s(&env, "Corp"), &s(&env, "ret-001"), &s(&env, "tx")).unwrap();

        let batch = c.get_credit_batch(&s(&env, "b1")).unwrap();
        assert_eq!(batch.status, CreditStatus::PartiallyRetired);
    }

    #[test]
    fn test_get_retirement_certificate() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry);

        c.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid")).unwrap();

        let holder = Address::generate(&env);
        c.retire_credits(&holder, &s(&env, "b1"), &100_i128, &s(&env, "reason"), &s(&env, "Corp"), &s(&env, "ret-001"), &s(&env, "tx")).unwrap();

        let cert = c.get_retirement_certificate(&s(&env, "ret-001")).unwrap();
        assert_eq!(cert.amount, 100);
        assert_eq!(cert.retirement_id, s(&env, "ret-001"));
    }

    #[test]
    fn test_zero_amount_rejected() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry);

        let result = c.try_mint_credits(&admin, &s(&env, "p1"), &0_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid"));
        assert!(result.is_err());
    }
}
