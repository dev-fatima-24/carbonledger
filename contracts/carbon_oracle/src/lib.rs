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

// ── Constants ─────────────────────────────────────────────────────────────────

/// 365 days in seconds — monitoring data older than this is considered stale.
const MONITORING_FRESHNESS_SECS: u64 = 365 * 24 * 60 * 60;
/// 24 hours in ledger TTL units (each ledger ~5 s → 17_280 ledgers/day).
const PRICE_CACHE_TTL_LEDGERS: u32 = 17_280;

/// Returns the current year based on the ledger timestamp.
fn current_year(env: &Env) -> u32 {
    let seconds_per_year: u64 = 31557600; // Approximate seconds in a year
    let timestamp = env.ledger().timestamp();
    1970 + (timestamp / seconds_per_year) as u32
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    MonitoringData(String, String), // (project_id, period)
    LatestMonitoring(String),       // project_id → latest timestamp
    BenchmarkPrice(String, u32),    // (methodology, vintage_year)
    FlaggedProject(String),
    OracleAddress,
    Admin,
}

// ── Types ─────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct MonitoringData {
    pub project_id:        String,
    pub period:            String,
    pub tonnes_verified:   i128,
    pub methodology_score: u32,
    pub satellite_cid:     String,
    pub submitted_by:      Address,
    pub submitted_at:      u64,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CarbonOracleContract;

#[contractimpl]
impl CarbonOracleContract {
    /// Initialise oracle with admin and authorised oracle signer address.
    pub fn initialize(env: Env, admin: Address, oracle_address: Address) {
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::OracleAddress, &oracle_address);
    }

    /// Authorised oracle submits satellite-verified monitoring data for a project period.
    /// Methodology score below 70 triggers an on-chain warning event.
    ///
    /// # Errors
    /// - [`CarbonError::UnauthorizedOracle`] if caller is not the registered oracle.
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `tonnes_verified` is zero.
    /// - [`CarbonError::ProjectNotFound`] if any string input is empty or too long.
    /// - [`CarbonError::InvalidVintageYear`] if methodology score is not in 0-100 range.
    pub fn submit_monitoring_data(
        env: Env,
        oracle_signer: Address,
        project_id: String,
        period: String,
        tonnes_verified: i128,
        methodology_score: u32,
        satellite_cid: String,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        oracle_signer.require_auth();
        Self::require_oracle(&env, &oracle_signer)?;

        // Validate string inputs (non-empty and reasonable length)
        if project_id.is_empty() || project_id.chars().count() > 64 {
            return Err(CarbonError::ProjectNotFound);
        }
        if period.is_empty() || period.chars().count() > 32 {
            return Err(CarbonError::ProjectNotFound);
        }
        if satellite_cid.is_empty() || satellite_cid.chars().count() > 128 {
            return Err(CarbonError::ProjectNotFound);
        }

        // Validate numeric inputs
        if tonnes_verified <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }
        if methodology_score > 100 {
            return Err(CarbonError::InvalidVintageYear); // Reusing error for score validation
        }

        // ── effects ───────────────────────────────────────────────────────────
        let now = env.ledger().timestamp();
        let data = MonitoringData {
            project_id:        project_id.clone(),
            period:            period.clone(),
            tonnes_verified,
            methodology_score,
            satellite_cid:     satellite_cid.clone(),
            submitted_by:      oracle_signer.clone(),
            submitted_at:      now,
        };

        env.storage().persistent().set(
            &DataKey::MonitoringData(project_id.clone(), period.clone()),
            &data,
        );
        // Track latest submission timestamp for freshness checks
        env.storage().persistent().set(&DataKey::LatestMonitoring(project_id.clone()), &now);

        if methodology_score < 70 {
            env.events().publish(
                (symbol_short!("c_ledger"), symbol_short!("low_score")),
                (project_id.clone(), methodology_score),
            );
        }

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("mon_data")),
            (project_id, period, tonnes_verified, methodology_score),
        );
        Ok(())
    }

    /// Push updated benchmark price per methodology and vintage year.
    /// Stored in temporary storage with 24-hour TTL.
    ///
    /// # Errors
    /// - [`CarbonError::UnauthorizedOracle`] if caller is not the registered oracle.
    /// - [`CarbonError::ProjectNotFound`] if any string input is empty or too long.
    /// - [`CarbonError::InvalidVintageYear`] if vintage year is before 1990 or after current year + 1.
    pub fn update_credit_price(
        env: Env,
        oracle_signer: Address,
        methodology: String,
        vintage_year: u32,
        price_usdc: i128,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        oracle_signer.require_auth();
        Self::require_oracle(&env, &oracle_signer)?;

        // Validate string inputs
        if methodology.is_empty() || methodology.chars().count() > 64 {
            return Err(CarbonError::ProjectNotFound);
        }

        // Validate numeric inputs
        if price_usdc <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }

        let current_year = Self::current_year(&env);
        if vintage_year < 1990 || vintage_year > current_year + 1 {
            return Err(CarbonError::InvalidVintageYear);
        }

        // ── effects ───────────────────────────────────────────────────────────
        let key = DataKey::BenchmarkPrice(methodology.clone(), vintage_year);
        env.storage().temporary().set(&key, &price_usdc);
        env.storage().temporary().extend_ttl(&key, PRICE_CACHE_TTL_LEDGERS, PRICE_CACHE_TTL_LEDGERS);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("price_upd")),
            (methodology, vintage_year, price_usdc),
        );
        Ok(())
    }

// ── Types ─────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug)]
pub struct MonitoringData {
    pub project_id:        String,
    pub period:            String,
    pub tonnes_verified:   i128,
    pub methodology_score: u32,
    pub satellite_cid:     String,
    pub submitted_by:      Address,
    pub submitted_at:      u64,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CarbonOracleContract;

#[contractimpl]
impl CarbonOracleContract {

    /// Initialise oracle with admin and authorised oracle signer address.
    pub fn initialize(env: Env, admin: Address, oracle_address: Address) {
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::OracleAddress, &oracle_address);
    }

    /// Authorised oracle submits satellite-verified monitoring data for a project period.
    /// Methodology score below 70 triggers an on-chain warning event.
    ///
    /// # Errors
    /// - [`CarbonError::UnauthorizedOracle`] if caller is not the registered oracle.
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `tonnes_verified` is zero.
    pub fn submit_monitoring_data(
        env: Env,
        oracle_signer: Address,
        project_id: String,
        period: String,
        tonnes_verified: i128,
        methodology_score: u32,
        satellite_cid: String,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        oracle_signer.require_auth();
        Self::require_oracle(&env, &oracle_signer)?;

        if tonnes_verified <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }

        // ── effects ───────────────────────────────────────────────────────────
        let now = env.ledger().timestamp();
        let data = MonitoringData {
            project_id:        project_id.clone(),
            period:            period.clone(),
            tonnes_verified,
            methodology_score,
            satellite_cid:     satellite_cid.clone(),
            submitted_by:      oracle_signer.clone(),
            submitted_at:      now,
        };

        env.storage().persistent().set(
            &DataKey::MonitoringData(project_id.clone(), period.clone()),
            &data,
        );
        // Track latest submission timestamp for freshness checks
        env.storage().persistent().set(&DataKey::LatestMonitoring(project_id.clone()), &now);

        if methodology_score < 70 {
            env.events().publish(
                (symbol_short!("c_ledger"), symbol_short!("low_score")),
                (project_id.clone(), methodology_score),
            );
        }

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("mon_data")),
            (project_id, period, tonnes_verified, methodology_score),
        );
        Ok(())
    }

    /// Push updated benchmark price per methodology and vintage year.
    /// Stored in temporary storage with 24-hour TTL.
    ///
    /// # Errors
    /// - [`CarbonError::UnauthorizedOracle`] if caller is not the registered oracle.
    pub fn update_credit_price(
        env: Env,
        oracle_signer: Address,
        methodology: String,
        vintage_year: u32,
        price_usdc: i128,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        oracle_signer.require_auth();
        Self::require_oracle(&env, &oracle_signer)?;

        if price_usdc <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }

        // ── effects ───────────────────────────────────────────────────────────
        let key = DataKey::BenchmarkPrice(methodology.clone(), vintage_year);
        env.storage().temporary().set(&key, &price_usdc);
        env.storage().temporary().extend_ttl(&key, PRICE_CACHE_TTL_LEDGERS, PRICE_CACHE_TTL_LEDGERS);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("price_upd")),
            (methodology, vintage_year, price_usdc),
        );
        Ok(())
    }

    /// Returns monitoring data for a specific project and period.
    ///
    /// # Errors
    /// - [`CarbonError::ProjectNotFound`] if no data exists for the given period.
    pub fn get_monitoring_data(
        env: Env,
        project_id: String,
        period: String,
    ) -> Result<MonitoringData, CarbonError> {
        env.storage()
            .persistent()
            .get(&DataKey::MonitoringData(project_id, period))
            .ok_or(CarbonError::ProjectNotFound)
    }

    /// Returns the current benchmark price (in USDC stroops) for a methodology and vintage.
    ///
    /// # Errors
    /// - [`CarbonError::PriceNotSet`] if no price is cached or cache has expired.
    pub fn get_benchmark_price(
        env: Env,
        methodology: String,
        vintage_year: u32,
    ) -> Result<i128, CarbonError> {
        env.storage()
            .temporary()
            .get(&DataKey::BenchmarkPrice(methodology, vintage_year))
            .ok_or(CarbonError::PriceNotSet)
    }

    /// Flag a project for investigation. Emits an on-chain event that halts
    /// new credit issuance until the flag is resolved.
    ///
    /// # Errors
    /// - [`CarbonError::UnauthorizedOracle`] if caller is not the registered oracle.
    pub fn flag_project(
        env: Env,
        oracle_signer: Address,
        project_id: String,
        reason: String,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        oracle_signer.require_auth();
        Self::require_oracle(&env, &oracle_signer)?;

        // ── effects ───────────────────────────────────────────────────────────
        env.storage().persistent().set(&DataKey::FlaggedProject(project_id.clone()), &reason);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("flagged")),
            (project_id, oracle_signer, reason),
        );
        Ok(())
    }

    /// Returns `true` if monitoring data was submitted within the last 365 days.
    /// Returns `false` (stale) if no data exists or data is older than 365 days.
    pub fn is_monitoring_current(env: Env, project_id: String) -> bool {
        let latest: Option<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::LatestMonitoring(project_id));

        match latest {
            None => false,
            Some(ts) => {
                let now = env.ledger().timestamp();
                now.saturating_sub(ts) <= MONITORING_FRESHNESS_SECS
            }
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn require_oracle(env: &Env, caller: &Address) -> Result<(), CarbonError> {
        let oracle: Address = env
            .storage()
            .persistent()
            .get(&DataKey::OracleAddress)
            .ok_or(CarbonError::UnauthorizedOracle)?;
        if &oracle != caller {
            return Err(CarbonError::UnauthorizedOracle);
        }
        Ok(())
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger, LedgerInfo}, Env, String};

    fn s(env: &Env, v: &str) -> String { String::from_str(env, v) }

    fn setup(env: &Env) -> (CarbonOracleContractClient, Address, Address) {
        env.mock_all_auths();
        let admin  = Address::generate(env);
        let oracle = Address::generate(env);
        let id     = env.register_contract(None, CarbonOracleContract);
        let client = CarbonOracleContractClient::new(env, &id);
        client.initialize(&admin, &oracle);
        (client, admin, oracle)
    }

    #[test]
    fn test_authorized_oracle_submits_monitoring() {
        let env = Env::default();
        let (client, _, oracle) = setup(&env);

        client.submit_monitoring_data(
            &oracle,
            &s(&env, "proj-001"),
            &s(&env, "2023-Q1"),
            &5000_i128,
            &85_u32,
            &s(&env, "QmSatCID"),
        ).unwrap();

        let data = client.get_monitoring_data(&s(&env, "proj-001"), &s(&env, "2023-Q1")).unwrap();
        assert_eq!(data.tonnes_verified, 5000);
        assert_eq!(data.methodology_score, 85);
    }

    #[test]
    fn test_unauthorized_oracle_rejected() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        let rogue = Address::generate(&env);

        let result = client.try_submit_monitoring_data(
            &rogue,
            &s(&env, "proj-001"),
            &s(&env, "2023-Q1"),
            &5000_i128,
            &85_u32,
            &s(&env, "QmSatCID"),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_benchmark_price_update() {
        let env = Env::default();
        let (client, _, oracle) = setup(&env);

        client.update_credit_price(&oracle, &s(&env, "VCS"), &2023_u32, &15_0000000_i128).unwrap();
        let price = client.get_benchmark_price(&s(&env, "VCS"), &2023_u32).unwrap();
        assert_eq!(price, 15_0000000_i128);
    }

    #[test]
    fn test_price_not_set_returns_error() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        let result = client.try_get_benchmark_price(&s(&env, "VCS"), &2023_u32);
        assert!(result.is_err());
    }

    #[test]
    fn test_flag_project() {
        let env = Env::default();
        let (client, _, oracle) = setup(&env);

        client.flag_project(&oracle, &s(&env, "proj-001"), &s(&env, "satellite contradiction")).unwrap();
        // Verify event was emitted (no error = success)
    }

    #[test]
    fn test_stale_monitoring_returns_false() {
        let env = Env::default();
        let (client, _, oracle) = setup(&env);

        // Submit monitoring data at timestamp 0
        env.ledger().set(LedgerInfo {
            timestamp: 1_000_000,
            protocol_version: 20,
            sequence_number: 100,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 6_312_000,
        });

        client.submit_monitoring_data(
            &oracle,
            &s(&env, "proj-001"),
            &s(&env, "2022-Q1"),
            &1000_i128,
            &80_u32,
            &s(&env, "QmCID"),
        ).unwrap();

        // Advance time by 366 days
        env.ledger().set(LedgerInfo {
            timestamp: 1_000_000 + (366 * 24 * 60 * 60),
            protocol_version: 20,
            sequence_number: 200,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 6_312_000,
        });

        assert!(!client.is_monitoring_current(&s(&env, "proj-001")));
    }

    #[test]
    fn test_fresh_monitoring_returns_true() {
        let env = Env::default();
        let (client, _, oracle) = setup(&env);

        client.submit_monitoring_data(
            &oracle,
            &s(&env, "proj-001"),
            &s(&env, "2023-Q1"),
            &1000_i128,
            &80_u32,
            &s(&env, "QmCID"),
        ).unwrap();

        assert!(client.is_monitoring_current(&s(&env, "proj-001")));
    }
}
