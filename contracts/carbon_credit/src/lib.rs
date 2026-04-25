#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec,
    symbol_short, vec,
};

/// TTL extension in ledgers (~30 days at 5s/ledger).
/// Cost: ~0.00001 XLM per ledger entry extended. See docs/ttl-cost.md.
const TTL_LEDGERS: u32 = 518_400;

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
    AlreadyInitialized     = 19,
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
    /// Current owner of this credit batch. Only the owner may transfer or retire.
    pub owner:        Address,
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
    /// Can only be called once — subsequent calls return [`CarbonError::AlreadyInitialized`].
    pub fn initialize(env: Env, admin: Address, registry_contract: Address) -> Result<(), CarbonError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(CarbonError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::RegistryContract, &registry_contract);
        let ranges: Vec<SerialRange> = vec![&env];
        env.storage().persistent().set(&DataKey::SerialRegistry, &ranges);
        Ok(())
    }

    /// Returns the current year based on the ledger timestamp.
    fn current_year(env: &Env) -> u32 {
        let seconds_per_year: u64 = 31557600; // Approximate seconds in a year
        let timestamp = env.ledger().timestamp();
        1970 + (timestamp / seconds_per_year) as u32
    }

    /// Mint verified carbon credits for a verified project. Assigns unique serial
    /// numbers to each credit, preventing double-counting globally.
    /// The `initial_owner` receives ownership of the batch.
    ///
    /// # Errors
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `amount` is zero.
    /// - [`CarbonError::InvalidSerialRange`] if `serial_end < serial_start`.
    /// - [`CarbonError::SerialNumberConflict`] if serial range overlaps an existing batch.
    /// - [`CarbonError::InvalidVintageYear`] if vintage year is before 1990 or after current year + 1.
    /// - [`CarbonError::ProjectNotFound`] if any string input is empty or too long.
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
        initial_owner: Address,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        // Validate string inputs (non-empty and reasonable length)
        if project_id.is_empty() || project_id.chars().count() > 64 {
            return Err(CarbonError::ProjectNotFound);
        }
        if batch_id.is_empty() || batch_id.chars().count() > 64 {
            return Err(CarbonError::ProjectNotFound);
        }
        if metadata_cid.is_empty() || metadata_cid.chars().count() > 128 {
            return Err(CarbonError::ProjectNotFound);
        }

        // Validate numeric inputs
        if amount <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }
        if serial_end <= serial_start {
            return Err(CarbonError::InvalidSerialRange);
        }

        let current_year = Self::current_year(&env);
        if vintage_year < 1990 || vintage_year > current_year + 1 {
            return Err(CarbonError::InvalidVintageYear);
        }

        if env.storage().persistent().has(&DataKey::Batch(batch_id.clone())) {
            return Err(CarbonError::SerialNumberConflict);
        }

        // AUDIT-NOTE [HIGH]: No cross-contract call to carbon_registry to verify the
        // project is in `Verified` status. Credits can be minted for Pending, Rejected,
        // or Suspended projects. Fix: invoke carbon_registry::get_project() and assert
        // status == ProjectStatus::Verified before proceeding.

        // Enforce global serial uniqueness
        if !Self::verify_serial_range_internal(&env, serial_start, serial_end) {
            return Err(CarbonError::DoubleCountingDetected);
        }

        // ── effects ───────────────────────────────────────────────────────────
        // Register serial range globally
        // AUDIT-NOTE [LOW]: SerialRegistry is an unbounded Vec. The overlap check is
        // O(n) over all historical ranges. With enough batches, this will exceed
        // Soroban's instruction limit, permanently bricking new minting. Fix: replace
        // with a sorted interval structure or a bitmap keyed by range blocks.
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
            owner:        initial_owner.clone(),
        };
        env.storage().persistent().set(&DataKey::Batch(batch_id.clone()), &batch);
        Self::extend_batch_ttl(&env, &batch_id);

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

    /// Permanently and irreversibly retire carbon credits on-chain.
    ///
    /// # Errors
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `amount` is zero.
    /// - [`CarbonError::InsufficientCredits`] if batch has fewer active credits than requested.
    /// - [`CarbonError::AlreadyRetired`] if batch is fully retired.
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

        // AUDIT-NOTE [HIGH]: No ownership check. Any authenticated address can retire
        // any batch, permanently destroying credits they do not own. Fix: maintain an
        // on-chain Map<batch_id, Address> ownership record updated by transfer_credits
        // and mint_credits, and assert ownership here.

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
        let already_retired: i128 = env
            .storage()
            .persistent()
            .get(&RetiredKey::BatchRetired(batch_id.clone()))
            .unwrap_or(0i128);

        // AUDIT-NOTE [HIGH]: Unchecked i128 → u64 cast. If `already_retired` exceeds
        // u64::MAX (~1.8×10¹⁹), the cast wraps silently in release Wasm builds,
        // producing incorrect serial numbers in the certificate and potentially
        // re-issuing serial numbers that were already retired.
        // Fix: use `u64::try_from(already_retired).map_err(|_| CarbonError::InvalidSerialRange)?`
        let retire_serial_start = batch.serial_start + already_retired as u64;
        let retire_serial_end   = retire_serial_start + amount as u64 - 1;

        let mut serial_numbers: Vec<u64> = vec![&env];
        let mut s = retire_serial_start;
        while s <= retire_serial_end {
            serial_numbers.push_back(s);
            s += 1;
        }

        let new_retired = already_retired + amount;
        env.storage().persistent().set(&RetiredKey::BatchRetired(batch_id.clone()), &new_retired);

        let new_active = batch.amount - new_retired;
        batch.status = if new_active == 0 {
            CreditStatus::FullyRetired
        } else {
            CreditStatus::PartiallyRetired
        };
        env.storage().persistent().set(&DataKey::Batch(batch_id.clone()), &batch);
        Self::extend_batch_ttl(&env, &batch_id);

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

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("retired")),
            (retirement_id, batch_id, batch.project_id, amount, holder, beneficiary),
        );
        Ok(cert)
    }

    /// Transfer credits to another account. Only the current batch owner may call this.
    /// No admin bypass exists — ownership is strictly enforced.
    ///
    /// # Errors
    /// - [`CarbonError::UnauthorizedVerifier`] if `from` is not the current batch owner.
    /// - [`CarbonError::AlreadyRetired`] if batch is fully retired.
    /// - [`CarbonError::InsufficientCredits`] if insufficient active credits.
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

        let mut batch = Self::load_batch(&env, &batch_id)?;

        // Enforce owner-only: no admin bypass
        if batch.owner != from {
            return Err(CarbonError::UnauthorizedVerifier);
        }

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
        // AUDIT-NOTE [HIGH]: Transfer is a no-op — no ownership record is updated.
        // Only an event is emitted. This means on-chain state does not reflect the
        // new owner, so retire_credits cannot enforce ownership. Fix: maintain a
        // Map<batch_id, Address> and update it here and in mint_credits.
        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("transfer")),
            (batch_id, from, to, amount),
        );
        Ok(())
    }

    /// Returns a [`CreditBatch`] by ID.
    pub fn get_credit_batch(env: Env, batch_id: String) -> Result<CreditBatch, CarbonError> {
        Self::load_batch(&env, &batch_id)
    }

    /// Returns a permanent [`RetirementCertificate`] by retirement ID.
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
    pub fn verify_serial_range(env: Env, serial_start: u64, serial_end: u64) -> bool {
        Self::verify_serial_range_internal(&env, serial_start, serial_end)
    }

    /// Returns all [`CreditBatch`] records for a given project.
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

    /// Extend TTL on a batch entry so it is not evicted by Soroban rent.
    /// Called on every read/write to active batches.
    fn extend_batch_ttl(env: &Env, batch_id: &String) {
        let key = DataKey::Batch(batch_id.clone());
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(&key, TTL_LEDGERS, TTL_LEDGERS);
        }
    }

    fn load_batch(env: &Env, batch_id: &String) -> Result<CreditBatch, CarbonError> {
        let key = DataKey::Batch(batch_id.clone());
        let batch = env.storage()
            .persistent()
            .get(&key)
            .ok_or(CarbonError::ProjectNotFound)?;
        // Extend TTL on every read so active batches never expire
        env.storage().persistent().extend_ttl(&key, TTL_LEDGERS, TTL_LEDGERS);
        Ok(batch)
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

    fn get_current_year(env: &Env) -> u32 {
        let timestamp = env.ledger().timestamp();
        let seconds_in_day = 86400;
        let mut days = (timestamp / seconds_in_day) as i64;
        let mut year = 1970;

        loop {
            let is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
            let days_in_year = if is_leap { 366 } else { 365 };
            if days < days_in_year {
                break;
            }
            days -= days_in_year;
            year += 1;
        }
        year as u32
    }

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
    use soroban_sdk::{testutils::Address as _, Env, String};

    fn s(env: &Env, v: &str) -> String { String::from_str(env, v) }

    fn setup(env: &Env) -> (CarbonCreditContractClient, Address, Address) {
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let client = CarbonCreditContractClient::new(&env, &id);
        client.initialize(&admin, &registry).unwrap();
        (client, admin, registry)
    }

    fn mint_batch(env: &Env, client: &CarbonCreditContractClient, admin: &Address, owner: &Address) {
        client.mint_credits(
            admin,
            &s(env, "proj-001"),
            &1000_i128,
            &2023_u32,
            &s(env, "batch-001"),
            &1_u64,
            &1000_u64,
            &s(env, "QmCID"),
            owner,
        ).unwrap();
    }

    // ── Issue #59: transfer authorization ────────────────────────────────────

    #[test]
    fn test_transfer_from_owner_succeeds() {
        let env = Env::default();
        let (client, admin, _) = setup(&env);
        let owner = Address::generate(&env);
        let buyer = Address::generate(&env);
        mint_batch(&env, &client, &admin, &owner);

        client.transfer_credits(&owner, &buyer, &s(&env, "batch-001"), &100_i128).unwrap();

        let batch = client.get_credit_batch(&s(&env, "batch-001")).unwrap();
        assert_eq!(batch.owner, buyer);
    }

    #[test]
    fn test_transfer_from_non_owner_fails() {
        let env = Env::default();
        let (client, admin, _) = setup(&env);
        let owner   = Address::generate(&env);
        let attacker = Address::generate(&env);
        let victim   = Address::generate(&env);
        mint_batch(&env, &client, &admin, &owner);

        let result = client.try_transfer_credits(&attacker, &victim, &s(&env, "batch-001"), &100_i128);
        assert!(result.is_err());
    }

    #[test]
    fn test_admin_cannot_bypass_transfer_authorization() {
        let env = Env::default();
        let (client, admin, _) = setup(&env);
        let owner = Address::generate(&env);
        let to    = Address::generate(&env);
        mint_batch(&env, &client, &admin, &owner);

        // Admin is not the batch owner — must be rejected
        let result = client.try_transfer_credits(&admin, &to, &s(&env, "batch-001"), &100_i128);
        assert!(result.is_err());
    }

    #[test]
    fn test_transfer_updates_owner() {
        let env = Env::default();
        let (client, admin, _) = setup(&env);
        let owner = Address::generate(&env);
        let new_owner = Address::generate(&env);
        mint_batch(&env, &client, &admin, &owner);

        client.transfer_credits(&owner, &new_owner, &s(&env, "batch-001"), &500_i128).unwrap();

        // New owner can transfer again; old owner cannot
        let third = Address::generate(&env);
        client.transfer_credits(&new_owner, &third, &s(&env, "batch-001"), &200_i128).unwrap();
        let result = client.try_transfer_credits(&owner, &third, &s(&env, "batch-001"), &100_i128);
        assert!(result.is_err());
    }

    // ── Existing tests (updated for new mint_credits signature) ──────────────

    #[test]
    fn test_mint_credits_success() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry).unwrap();

        c.mint_credits(
            &admin,
            &s(&env, "proj-002"),
            &500_i128,
            &2023_u32,
            &s(&env, "batch-A"),
            &1_u64,
            &500_u64,
            &s(&env, "QmCID"),
            &owner,
        ).unwrap();

        let b = client.get_credit_batch(&s(&env, "batch-A")).unwrap();
        assert_eq!(b.amount, 500);
        assert_eq!(b.status, CreditStatus::Active);
        assert_eq!(b.owner, owner);
    }

    #[test]
    fn test_serial_conflict_detection() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry).unwrap();

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
        c.initialize(&admin, &registry).unwrap();

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
        c.initialize(&admin, &registry).unwrap();

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
        let batch = client.get_credit_batch(&s(&env, "b1")).unwrap();
        assert_eq!(batch.status, CreditStatus::FullyRetired);
    }

    #[test]
    fn test_retired_credits_cannot_be_transferred() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry).unwrap();

        c.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid")).unwrap();

        client.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid"), &owner).unwrap();
        client.retire_credits(&owner, &s(&env, "b1"), &100_i128, &s(&env, "reason"), &s(&env, "Corp"), &s(&env, "ret-001"), &s(&env, "tx")).unwrap();

        let to = Address::generate(&env);
        let result = client.try_transfer_credits(&owner, &to, &s(&env, "b1"), &10_i128);
        assert!(result.is_err());
    }

    #[test]
    fn test_retired_credits_cannot_be_retired_again() {
        let (env, _) = setup();
        let admin = Address::generate(&env);
        let registry = Address::generate(&env);
        let id = env.register_contract(None, CarbonCreditContract);
        let c = CarbonCreditContractClient::new(&env, &id);
        c.initialize(&admin, &registry).unwrap();

        c.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid")).unwrap();

        client.mint_credits(&admin, &s(&env, "p1"), &100_i128, &2023_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid"), &owner).unwrap();
        client.retire_credits(&owner, &s(&env, "b1"), &100_i128, &s(&env, "reason"), &s(&env, "Corp"), &s(&env, "ret-001"), &s(&env, "tx")).unwrap();

        let result = client.try_retire_credits(&owner, &s(&env, "b1"), &100_i128, &s(&env, "reason"), &s(&env, "Corp"), &s(&env, "ret-002"), &s(&env, "tx2"));
        assert!(result.is_err());
    }

    #[test]
    fn test_partial_retirement_updates_status() {
        let env = Env::default();
        let (client, admin, _) = setup(&env);
        let owner = Address::generate(&env);
        mint_batch(&env, &client, &admin, &owner);

        client.retire_credits(&owner, &s(&env, "batch-001"), &500_i128, &s(&env, "partial"), &s(&env, "me"), &s(&env, "ret-001"), &s(&env, "tx")).unwrap();
        let batch = client.get_credit_batch(&s(&env, "batch-001")).unwrap();
        assert_eq!(batch.status, CreditStatus::PartiallyRetired);
    }

    // ── Vintage Year Range Enforcement Tests ──────────────────────────────────

    #[test]
    fn test_vintage_year_boundary_1989_fails() {
        let env = Env::default();
        let (client, admin, _) = setup(&env);
        let owner = Address::generate(&env);
        
        let result = client.try_mint_credits(
            &admin, &s(&env, "p1"), &100_i128, &1989_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid"), &owner
        );
        assert_eq!(result.unwrap_err(), Ok(CarbonError::InvalidVintageYear));
    }

    #[test]
    fn test_vintage_year_boundary_1990_succeeds() {
        let env = Env::default();
        let (client, admin, _) = setup(&env);
        let owner = Address::generate(&env);
        
        // Set ledger time to 2026-01-01
        env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 1767225600, // 2026-01-01
            protocol_version: 20,
            sequence_number: 1,
            network_id: [0; 32],
            base_reserve: 10,
        });

        client.mint_credits(
            &admin, &s(&env, "p1"), &100_i128, &1990_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid"), &owner
        ).unwrap();
    }

    #[test]
    fn test_vintage_year_boundary_current_plus_1_succeeds() {
        let env = Env::default();
        let (client, admin, _) = setup(&env);
        let owner = Address::generate(&env);
        
        // Set ledger time to 2026-01-01
        env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 1767225600, // 2026-01-01
            protocol_version: 20,
            sequence_number: 1,
            network_id: [0; 32],
            base_reserve: 10,
        });

        // Current year 2026, so 2027 should succeed
        client.mint_credits(
            &admin, &s(&env, "p1"), &100_i128, &2027_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid"), &owner
        ).unwrap();
    }

    #[test]
    fn test_vintage_year_boundary_current_plus_2_fails() {
        let env = Env::default();
        let (client, admin, _) = setup(&env);
        let owner = Address::generate(&env);
        
        // Set ledger time to 2026-01-01
        env.ledger().set(soroban_sdk::testutils::LedgerInfo {
            timestamp: 1767225600, // 2026-01-01
            protocol_version: 20,
            sequence_number: 1,
            network_id: [0; 32],
            base_reserve: 10,
        });

        // Current year 2026, so 2028 should fail
        let result = client.try_mint_credits(
            &admin, &s(&env, "p1"), &100_i128, &2028_u32, &s(&env, "b1"), &1_u64, &100_u64, &s(&env, "cid"), &owner
        );
        assert_eq!(result.unwrap_err(), Ok(CarbonError::InvalidVintageYear));
    }
