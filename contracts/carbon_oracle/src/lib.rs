#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec,
    symbol_short, vec, BytesN,
};

// -- Error Enum ---------------------------------------------------------------

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
    Arithmetic             = 20,
    UnauthorizedUpgrade    = 21,
}

// -- Constants ----------------------------------------------------------------

const MONITORING_FRESHNESS_SECS: u64 = 365 * 24 * 60 * 60;
const PRICE_CACHE_TTL_LEDGERS: u32 = 17_280;
const CURRENT_VERSION: u32 = 1;

// -- Storage Keys -------------------------------------------------------------

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    MonitoringData(String, String),
    LatestMonitoring(String),
    BenchmarkPrice(String, u32),
    FlaggedProject(String),
    OracleAddress,
    Admin,
    ContractVersion,
    UpgradeHistory,
}

// -- Types --------------------------------------------------------------------

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

#[contracttype]
#[derive(Clone, Debug)]
pub struct UpgradeRecord {
    pub from_version: u32,
    pub to_version:   u32,
    pub timestamp:    u64,
    pub upgraded_by:  Address,
    pub wasm_hash:    BytesN<32>,
}

// -- Contract -----------------------------------------------------------------

#[contract]
pub struct CarbonOracleContract;

#[contractimpl]
impl CarbonOracleContract {

    pub fn initialize(env: Env, admin: Address, oracle_address: Address) -> Result<(), CarbonError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(CarbonError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::OracleAddress, &oracle_address);
        env.storage().persistent().set(&DataKey::ContractVersion, &CURRENT_VERSION);
        Ok(())
    }

    pub fn upgrade(
        env: Env,
        admin: Address,
        new_wasm_hash: BytesN<32>,
    ) -> Result<(), CarbonError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        let current_version: u32 = env.storage()
            .persistent()
            .get(&DataKey::ContractVersion)
            .unwrap_or(1);

        env.deployer().update_current_contract_wasm(new_wasm_hash.clone());

        let next_version = current_version + 1;
        env.storage().persistent().set(&DataKey::ContractVersion, &next_version);

        let record = UpgradeRecord {
            from_version: current_version,
            to_version:   next_version,
            timestamp:    env.ledger().timestamp(),
            upgraded_by:  admin.clone(),
            wasm_hash:    new_wasm_hash,
        };
        env.storage().persistent().set(&DataKey::UpgradeHistory, &record);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("upgraded")),
            (current_version, next_version, admin),
        );
        Ok(())
    }

    pub fn get_version(env: Env) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::ContractVersion)
            .unwrap_or(1)
    }

    pub fn get_upgrade_history(env: Env) -> Option<UpgradeRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::UpgradeHistory)
    }

    pub fn rotate_oracle(
        env: Env,
        admin: Address,
        new_oracle: Address,
    ) -> Result<(), CarbonError> {
        admin.require_auth();
        Self::require_admin(&env, &admin)?;

        env.storage().persistent().set(&DataKey::OracleAddress, &new_oracle);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("ora_rot")),
            (admin, new_oracle),
        );
        Ok(())
    }

    pub fn submit_monitoring_data(
        env: Env,
        oracle_signer: Address,
        project_id: String,
        period: String,
        tonnes_verified: i128,
        methodology_score: u32,
        satellite_cid: String,
    ) -> Result<(), CarbonError> {
        oracle_signer.require_auth();
        Self::require_oracle(&env, &oracle_signer)?;

        if tonnes_verified <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }

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

    pub fn update_credit_price(
        env: Env,
        oracle_signer: Address,
        methodology: String,
        vintage_year: u32,
        price_usdc: i128,
    ) -> Result<(), CarbonError> {
        oracle_signer.require_auth();
        Self::require_oracle(&env, &oracle_signer)?;

        if price_usdc <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }

        let current_year = Self::get_current_year(&env);
        if vintage_year < 1990 || vintage_year > current_year + 1 {
            return Err(CarbonError::InvalidVintageYear);
        }

        let key = DataKey::BenchmarkPrice(methodology.clone(), vintage_year);
        env.storage().temporary().set(&key, &price_usdc);
        env.storage().temporary().extend_ttl(&key, PRICE_CACHE_TTL_LEDGERS, PRICE_CACHE_TTL_LEDGERS);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("price_upd")),
            (methodology, vintage_year, price_usdc),
        );
        Ok(())
    }

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

    pub fn flag_project(
        env: Env,
        oracle_signer: Address,
        project_id: String,
        reason: String,
    ) -> Result<(), CarbonError> {
        oracle_signer.require_auth();
        Self::require_oracle(&env, &oracle_signer)?;

        env.storage().persistent().set(&DataKey::FlaggedProject(project_id.clone()), &reason);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("flagged")),
            (project_id, oracle_signer, reason),
        );
        Ok(())
    }

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
}

// -- Tests --------------------------------------------------------------------

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
        );

        let data = client.get_monitoring_data(&s(&env, "proj-001"), &s(&env, "2023-Q1"));
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
    fn test_unauthorized_price_update_rejected() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        let rogue = Address::generate(&env);

        let result = client.try_update_credit_price(&rogue, &s(&env, "VCS"), &2023_u32, &15_0000000_i128);
        assert!(result.is_err());
    }

    #[test]
    fn test_rotate_oracle_admin_only() {
        let env = Env::default();
        let (client, admin, old_oracle) = setup(&env);
        let new_oracle = Address::generate(&env);

        client.rotate_oracle(&admin, &new_oracle).unwrap();

        let result = client.try_submit_monitoring_data(
            &old_oracle,
            &s(&env, "proj-001"),
            &s(&env, "2023-Q1"),
            &1000_i128,
            &80_u32,
            &s(&env, "QmCID"),
        );
        assert!(result.is_err());

        client.submit_monitoring_data(
            &new_oracle,
            &s(&env, "proj-001"),
            &s(&env, "2023-Q1"),
            &1000_i128,
            &80_u32,
            &s(&env, "QmCID"),
        ).unwrap();
    }

    #[test]
    fn test_rotate_oracle_non_admin_rejected() {
        let env = Env::default();
        let (client, _, _) = setup(&env);
        let attacker   = Address::generate(&env);
        let new_oracle = Address::generate(&env);

        let result = client.try_rotate_oracle(&attacker, &new_oracle);
        assert!(result.is_err());
    }

    #[test]
    fn test_benchmark_price_update() {
        let env = Env::default();
        let (client, _, oracle) = setup(&env);

        client.update_credit_price(&oracle, &s(&env, "VCS"), &2023_u32, &15_0000000_i128);
        let price = client.get_benchmark_price(&s(&env, "VCS"), &2023_u32);
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
        client.flag_project(&oracle, &s(&env, "proj-001"), &s(&env, "satellite contradiction"));
    }

    #[test]
    fn test_stale_monitoring_returns_false() {
        let env = Env::default();
        let (client, _, oracle) = setup(&env);

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
        );

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
        );

        assert!(client.is_monitoring_current(&s(&env, "proj-001")));
    }

    #[test]
    fn test_initialize_twice_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let admin  = Address::generate(&env);
        let oracle = Address::generate(&env);
        let id     = env.register_contract(None, CarbonOracleContract);
        let client = CarbonOracleContractClient::new(&env, &id);
        client.initialize(&admin, &oracle);
        let result = client.try_initialize(&admin, &oracle);
        assert!(result.is_err());
    }

    #[test]
    fn test_upgrade_admin_only() {
        let env = Env::default();
        env.mock_all_auths();
        let admin  = Address::generate(&env);
        let oracle = Address::generate(&env);
        let id     = env.register_contract(None, CarbonOracleContract);
        let client = CarbonOracleContractClient::new(&env, &id);
        client.initialize(&admin, &oracle).unwrap();

        let attacker = Address::generate(&env);
        let fake_hash = BytesN::from_array(&env, &[0u8; 32]);
        let result = client.try_upgrade(&attacker, &fake_hash);
        assert!(result.is_err());
    }

    #[test]
    fn test_version_tracking() {
        let env = Env::default();
        env.mock_all_auths();
        let admin  = Address::generate(&env);
        let oracle = Address::generate(&env);
        let id     = env.register_contract(None, CarbonOracleContract);
        let client = CarbonOracleContractClient::new(&env, &id);
        client.initialize(&admin, &oracle).unwrap();

        assert_eq!(client.get_version(), 1);
    }
}

// ── Edge-case tests (issue #91) ───────────────────────────────────────────────

#[cfg(test)]
mod edge_case_tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, LedgerInfo}, Env, String};

    fn s(env: &Env, v: &str) -> String { String::from_str(env, v) }

    fn init(env: &Env) -> (CarbonOracleContractClient, Address, Address) {
        env.mock_all_auths();
        let admin  = Address::generate(env);
        let oracle = Address::generate(env);
        let id = env.register_contract(None, CarbonOracleContract);
        let client = CarbonOracleContractClient::new(env, &id);
        client.initialize(&admin, &oracle).unwrap();
        (client, admin, oracle)
    }

    // ── ZeroAmountNotAllowed ──────────────────────────────────────────────────

    #[test]
    fn test_submit_zero_tonnes_fails() {
        let env = Env::default();
        let (client, _, oracle) = init(&env);
        let result = client.try_submit_monitoring_data(
            &oracle, &s(&env, "p1"), &s(&env, "2023-Q1"),
            &0_i128, &80_u32, &s(&env, "QmCID"),
        );
        assert_eq!(result.unwrap_err(), Ok(CarbonError::ZeroAmountNotAllowed));
    }

    #[test]
    fn test_submit_negative_tonnes_fails() {
        let env = Env::default();
        let (client, _, oracle) = init(&env);
        let result = client.try_submit_monitoring_data(
            &oracle, &s(&env, "p1"), &s(&env, "2023-Q1"),
            &-500_i128, &80_u32, &s(&env, "QmCID"),
        );
        assert_eq!(result.unwrap_err(), Ok(CarbonError::ZeroAmountNotAllowed));
    }

    #[test]
    fn test_update_price_zero_fails() {
        let env = Env::default();
        let (client, _, oracle) = init(&env);
        let result = client.try_update_credit_price(&oracle, &s(&env, "VCS"), &2023_u32, &0_i128);
        assert_eq!(result.unwrap_err(), Ok(CarbonError::ZeroAmountNotAllowed));
    }

    #[test]
    fn test_update_price_negative_fails() {
        let env = Env::default();
        let (client, _, oracle) = init(&env);
        let result = client.try_update_credit_price(&oracle, &s(&env, "VCS"), &2023_u32, &-1_i128);
        assert_eq!(result.unwrap_err(), Ok(CarbonError::ZeroAmountNotAllowed));
    }

    // ── InvalidVintageYear (price update) ────────────────────────────────────

    #[test]
    fn test_price_vintage_1989_fails() {
        let env = Env::default();
        let (client, _, oracle) = init(&env);
        let result = client.try_update_credit_price(&oracle, &s(&env, "VCS"), &1989_u32, &10_0000000_i128);
        assert_eq!(result.unwrap_err(), Ok(CarbonError::InvalidVintageYear));
    }

    #[test]
    fn test_price_vintage_1990_succeeds() {
        let env = Env::default();
        let (client, _, oracle) = init(&env);
        // Set ledger to 2026 so 1990 is within range
        env.ledger().set(LedgerInfo {
            timestamp: 1767225600,
            protocol_version: 20,
            sequence_number: 1,
            network_id: [0; 32],
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 6_312_000,
        });
        client.update_credit_price(&oracle, &s(&env, "VCS"), &1990_u32, &10_0000000_i128).unwrap();
    }

    // ── PriceNotSet ───────────────────────────────────────────────────────────

    #[test]
    fn test_get_price_before_set_fails() {
        let env = Env::default();
        let (client, _, _) = init(&env);
        let result = client.try_get_benchmark_price(&s(&env, "VCS"), &2023_u32);
        assert_eq!(result.unwrap_err(), Ok(CarbonError::PriceNotSet));
    }

    // ── MonitoringDataStale ───────────────────────────────────────────────────

    #[test]
    fn test_monitoring_stale_after_365_days() {
        let env = Env::default();
        let (client, _, oracle) = init(&env);

        env.ledger().set(LedgerInfo {
            timestamp: 1_000_000,
            protocol_version: 20,
            sequence_number: 1,
            network_id: [0; 32],
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 6_312_000,
        });
        client.submit_monitoring_data(
            &oracle, &s(&env, "p1"), &s(&env, "2022-Q1"),
            &1000_i128, &80_u32, &s(&env, "QmCID"),
        ).unwrap();

        // Advance past 365 days
        env.ledger().set(LedgerInfo {
            timestamp: 1_000_000 + (366 * 24 * 60 * 60),
            protocol_version: 20,
            sequence_number: 2,
            network_id: [0; 32],
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 6_312_000,
        });
        assert!(!client.is_monitoring_current(&s(&env, "p1")));
    }

    #[test]
    fn test_monitoring_current_within_365_days() {
        let env = Env::default();
        let (client, _, oracle) = init(&env);
        client.submit_monitoring_data(
            &oracle, &s(&env, "p1"), &s(&env, "2023-Q1"),
            &1000_i128, &80_u32, &s(&env, "QmCID"),
        ).unwrap();
        assert!(client.is_monitoring_current(&s(&env, "p1")));
    }

    #[test]
    fn test_no_monitoring_data_returns_stale() {
        let env = Env::default();
        let (client, _, _) = init(&env);
        assert!(!client.is_monitoring_current(&s(&env, "never-submitted")));
    }

    // ── UnauthorizedOracle ────────────────────────────────────────────────────

    #[test]
    fn test_rogue_cannot_submit_monitoring() {
        let env = Env::default();
        let (client, _, _) = init(&env);
        let rogue = Address::generate(&env);
        let result = client.try_submit_monitoring_data(
            &rogue, &s(&env, "p1"), &s(&env, "2023-Q1"),
            &1000_i128, &80_u32, &s(&env, "QmCID"),
        );
        assert_eq!(result.unwrap_err(), Ok(CarbonError::UnauthorizedOracle));
    }

    #[test]
    fn test_rogue_cannot_update_price() {
        let env = Env::default();
        let (client, _, _) = init(&env);
        let rogue = Address::generate(&env);
        let result = client.try_update_credit_price(&rogue, &s(&env, "VCS"), &2023_u32, &10_0000000_i128);
        assert_eq!(result.unwrap_err(), Ok(CarbonError::UnauthorizedOracle));
    }

    #[test]
    fn test_rogue_cannot_flag_project() {
        let env = Env::default();
        let (client, _, _) = init(&env);
        let rogue = Address::generate(&env);
        let result = client.try_flag_project(&rogue, &s(&env, "p1"), &s(&env, "fraud"));
        assert_eq!(result.unwrap_err(), Ok(CarbonError::UnauthorizedOracle));
    }

    #[test]
    fn test_rogue_cannot_rotate_oracle() {
        let env = Env::default();
        let (client, _, _) = init(&env);
        let rogue      = Address::generate(&env);
        let new_oracle = Address::generate(&env);
        let result = client.try_rotate_oracle(&rogue, &new_oracle);
        assert_eq!(result.unwrap_err(), Ok(CarbonError::UnauthorizedVerifier));
    }

    // ── AlreadyInitialized ────────────────────────────────────────────────────

    #[test]
    fn test_double_initialize_fails() {
        let env = Env::default();
        let (client, admin, oracle) = init(&env);
        let result = client.try_initialize(&admin, &oracle);
        assert_eq!(result.unwrap_err(), Ok(CarbonError::AlreadyInitialized));
    }

    // ── ProjectNotFound (monitoring data) ─────────────────────────────────────

    #[test]
    fn test_get_monitoring_data_not_found() {
        let env = Env::default();
        let (client, _, _) = init(&env);
        let result = client.try_get_monitoring_data(&s(&env, "ghost"), &s(&env, "2023-Q1"));
        assert_eq!(result.unwrap_err(), Ok(CarbonError::ProjectNotFound));
    }
}
