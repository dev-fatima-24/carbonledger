#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec,
    symbol_short, vec,
    token,
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
    Arithmetic             = 20,
}

// ── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Listing(String),
    AllListings,
    Admin,
    UsdcToken,
    SuspendedProject(String),
}

// ── Types ─────────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ListingStatus {
    Active,
    Sold,
    PartiallyFilled,
    Delisted,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct MarketListing {
    pub listing_id:       String,
    pub seller:           Address,
    pub batch_id:         String,
    pub project_id:       String,
    pub amount_available: i128,
    pub price_per_credit: i128,
    pub vintage_year:     u32,
    pub methodology:      String,
    pub country:          String,
    pub created_at:       u64,
    pub status:           ListingStatus,
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct CarbonMarketplaceContract;

#[contractimpl]
impl CarbonMarketplaceContract {

    /// Initialise marketplace with admin and USDC token contract address.
    /// Can only be called once — subsequent calls return [`CarbonError::AlreadyInitialized`].
    pub fn initialize(env: Env, admin: Address, usdc_token: Address) -> Result<(), CarbonError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(CarbonError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::UsdcToken, &usdc_token);
        let listings: Vec<String> = vec![&env];
        env.storage().persistent().set(&DataKey::AllListings, &listings);
        Ok(())
    }

    /// Mark a project as suspended in the marketplace. Only admin may call this.
    /// Suspended projects cannot have new listings created or credits purchased.
    pub fn suspend_project(env: Env, admin: Address, project_id: String) -> Result<(), CarbonError> {
        admin.require_auth();
        let stored_admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
        if stored_admin != admin {
            return Err(CarbonError::UnauthorizedVerifier);
        }
        env.storage().persistent().set(&DataKey::SuspendedProject(project_id.clone()), &true);
        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("mkt_susp")),
            project_id,
        );
        Ok(())
    }

    /// List carbon credits for sale at a fixed USDC price per credit (in stroops).
    ///
    /// # Errors
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `amount` or `price_per_credit_usdc` is zero.
    /// - [`CarbonError::ProjectSuspended`] if the project is suspended.
    pub fn list_credits(
        env: Env,
        seller: Address,
        listing_id: String,
        batch_id: String,
        project_id: String,
        amount: i128,
        price_per_credit_usdc: i128,
        vintage_year: u32,
        methodology: String,
        country: String,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        seller.require_auth();

        // AUDIT-NOTE [MEDIUM]: No deduplication check on listing_id. A duplicate
        // listing_id silently overwrites the existing listing, allowing a seller to
        // zero out another listing's amount_available or change its price.
        // Fix: check `env.storage().persistent().has(&DataKey::Listing(listing_id.clone()))`.
        //
        // AUDIT-NOTE [MEDIUM]: No check that `seller` actually holds `batch_id` in
        // carbon_credit. Any authenticated address can list any batch. Fix: cross-contract
        // call to carbon_credit to verify ownership before creating the listing.

        if amount <= 0 || price_per_credit_usdc <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }

        if env.storage().persistent().get::<DataKey, bool>(&DataKey::SuspendedProject(project_id.clone())).unwrap_or(false) {
            return Err(CarbonError::ProjectSuspended);
        }

        // ── effects ───────────────────────────────────────────────────────────
        let listing = MarketListing {
            listing_id:       listing_id.clone(),
            seller:           seller.clone(),
            batch_id:         batch_id.clone(),
            project_id:       project_id.clone(),
            amount_available: amount,
            price_per_credit: price_per_credit_usdc,
            vintage_year,
            methodology:      methodology.clone(),
            country:          country.clone(),
            created_at:       env.ledger().timestamp(),
            status:           ListingStatus::Active,
        };
        env.storage().persistent().set(&DataKey::Listing(listing_id.clone()), &listing);
        Self::extend_listing_ttl(&env, &listing_id);

        let mut all: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::AllListings)
            .unwrap_or_else(|| vec![&env]);
        all.push_back(listing_id.clone());
        env.storage().persistent().set(&DataKey::AllListings, &all);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("listed")),
            (listing_id, seller, batch_id, amount, price_per_credit_usdc),
        );
        Ok(())
    }

    /// Remove an active listing. Only the original seller may delist.
    ///
    /// # Errors
    /// - [`CarbonError::ListingNotFound`] if listing does not exist.
    /// - [`CarbonError::UnauthorizedVerifier`] if caller is not the seller.
    pub fn delist_credits(
        env: Env,
        seller: Address,
        listing_id: String,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        seller.require_auth();

        let mut listing = Self::load_listing(&env, &listing_id)?;
        if listing.seller != seller {
            return Err(CarbonError::UnauthorizedVerifier);
        }

        // ── effects ───────────────────────────────────────────────────────────
        listing.status = ListingStatus::Delisted;
        env.storage().persistent().set(&DataKey::Listing(listing_id.clone()), &listing);
        Self::extend_listing_ttl(&env, &listing_id);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("delisted")),
            (listing_id, seller),
        );
        Ok(())
    }

    /// Purchase credits from a listing. Transfers USDC from buyer to seller.
    /// Protocol fee of 1% is retained by the admin.
    ///
    /// # Errors
    /// - [`CarbonError::ListingNotFound`] if listing does not exist.
    /// - [`CarbonError::InsufficientLiquidity`] if listing has fewer credits than requested.
    pub fn purchase_credits(
        env: Env,
        buyer: Address,
        listing_id: String,
        amount: i128,
    ) -> Result<(), CarbonError> {
        // ── checks ────────────────────────────────────────────────────────────
        buyer.require_auth();

        if amount <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }

        let mut listing = Self::load_listing(&env, &listing_id)?;

        if listing.status == ListingStatus::Delisted || listing.status == ListingStatus::Sold {
            return Err(CarbonError::ListingNotFound);
        }
        if env.storage().persistent().get::<DataKey, bool>(&DataKey::SuspendedProject(listing.project_id.clone())).unwrap_or(false) {
            return Err(CarbonError::ProjectSuspended);
        }
        if amount > listing.amount_available {
            return Err(CarbonError::InsufficientLiquidity);
        }

        // ── effects ───────────────────────────────────────────────────────────
        // AUDIT-NOTE [HIGH]: Unchecked i128 multiplication. If price_per_credit and
        // amount are both large (e.g., price = i128::MAX / 2, amount = 2), total_cost
        // overflows and wraps to a small or negative value, allowing a buyer to purchase
        // credits for near-zero USDC. Fix: use checked_mul and return an error on overflow.
        let total_cost = listing.price_per_credit.checked_mul(amount).ok_or(CarbonError::Arithmetic)?;
        let protocol_fee = total_cost.checked_div(100).ok_or(CarbonError::Arithmetic)?; // 1%
        let seller_proceeds = total_cost.checked_sub(protocol_fee).ok_or(CarbonError::Arithmetic)?;

        listing.amount_available = listing.amount_available.checked_sub(amount).ok_or(CarbonError::Arithmetic)?;
        listing.status = if listing.amount_available == 0 {
            ListingStatus::Sold
        } else {
            ListingStatus::PartiallyFilled
        };
        env.storage().persistent().set(&DataKey::Listing(listing_id.clone()), &listing);
        Self::extend_listing_ttl(&env, &listing_id);

        // ── interactions ──────────────────────────────────────────────────────
        let usdc: Address = env.storage().persistent().get(&DataKey::UsdcToken).unwrap();
        let usdc_client = token::Client::new(&env, &usdc);
        usdc_client.transfer(&buyer, &listing.seller, &seller_proceeds);

        let admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
        usdc_client.transfer(&buyer, &admin, &protocol_fee);

        env.events().publish(
            (symbol_short!("c_ledger"), symbol_short!("purchase")),
            (listing_id, buyer, listing.seller, amount, total_cost),
        );
        Ok(())
    }

    /// Bulk purchase from multiple listings in a single transaction.
    ///
    /// # Errors
    /// - Any error from individual [`purchase_credits`] calls propagates immediately.
    // AUDIT-NOTE [MEDIUM]: Atomicity depends entirely on Soroban transaction semantics.
    // If any iteration fails after earlier USDC transfers have been submitted, the
    // Soroban runtime must revert the entire transaction for this to be safe. Auditors
    // should verify that a mid-loop CarbonError return causes a full transaction revert
    // including all token::Client::transfer() calls made in prior iterations.
    pub fn bulk_purchase(
        env: Env,
        buyer: Address,
        listing_ids: Vec<String>,
        amounts: Vec<i128>,
    ) -> Result<(), CarbonError> {
        buyer.require_auth();

        let len = listing_ids.len();
        if len != amounts.len() {
            return Err(CarbonError::InvalidSerialRange);
        }

        for i in 0..len {
            let listing_id = listing_ids.get(i).unwrap();
            let amount = amounts.get(i).unwrap();

            if amount <= 0 {
                return Err(CarbonError::ZeroAmountNotAllowed);
            }

            let mut listing = Self::load_listing(&env, &listing_id)?;
            if listing.status == ListingStatus::Delisted || listing.status == ListingStatus::Sold {
                return Err(CarbonError::ListingNotFound);
            }
            if env.storage().persistent().get::<DataKey, bool>(&DataKey::SuspendedProject(listing.project_id.clone())).unwrap_or(false) {
                return Err(CarbonError::ProjectSuspended);
            }
            if amount > listing.amount_available {
                return Err(CarbonError::InsufficientLiquidity);
            }

            // AUDIT-NOTE [HIGH]: Same unchecked i128 multiplication as purchase_credits.
            // Fix: use checked_mul.
            let total_cost = listing.price_per_credit.checked_mul(amount).ok_or(CarbonError::Arithmetic)?;
            let protocol_fee = total_cost.checked_div(100).ok_or(CarbonError::Arithmetic)?;
            let seller_proceeds = total_cost.checked_sub(protocol_fee).ok_or(CarbonError::Arithmetic)?;

            listing.amount_available = listing.amount_available.checked_sub(amount).ok_or(CarbonError::Arithmetic)?;
            listing.status = if listing.amount_available == 0 {
                ListingStatus::Sold
            } else {
                ListingStatus::PartiallyFilled
            };
            env.storage().persistent().set(&DataKey::Listing(listing_id.clone()), &listing);
            Self::extend_listing_ttl(&env, &listing_id);

            let usdc: Address = env.storage().persistent().get(&DataKey::UsdcToken).unwrap();
            let usdc_client = token::Client::new(&env, &usdc);
            usdc_client.transfer(&buyer, &listing.seller, &seller_proceeds);

            let admin: Address = env.storage().persistent().get(&DataKey::Admin).unwrap();
            usdc_client.transfer(&buyer, &admin, &protocol_fee);

            env.events().publish(
                (symbol_short!("c_ledger"), symbol_short!("bulk_buy")),
                (listing_id, buyer.clone(), amount, total_cost),
            );
        }
        Ok(())
    }

    /// Returns a single [`MarketListing`] by ID.
    pub fn get_listing(env: Env, listing_id: String) -> Result<MarketListing, CarbonError> {
        Self::load_listing(&env, &listing_id)
    }

    /// Returns all listings with `Active` or `PartiallyFilled` status.
    pub fn get_active_listings(env: Env) -> Vec<MarketListing> {
        Self::filter_listings(&env, |l| {
            l.status == ListingStatus::Active || l.status == ListingStatus::PartiallyFilled
        })
    }

    /// Returns all listings for a given project ID.
    pub fn get_listings_by_project(env: Env, project_id: String) -> Vec<MarketListing> {
        Self::filter_listings(&env, |l| l.project_id == project_id)
    }

    /// Returns all listings matching a given vintage year.
    pub fn get_listings_by_vintage(env: Env, vintage_year: u32) -> Vec<MarketListing> {
        Self::filter_listings(&env, |l| l.vintage_year == vintage_year)
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /// Extend TTL on a listing entry so it is not evicted by Soroban rent.
    /// Called on every read/write to active listings.
    fn extend_listing_ttl(env: &Env, listing_id: &String) {
        let key = DataKey::Listing(listing_id.clone());
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(&key, TTL_LEDGERS, TTL_LEDGERS);
        }
    }

    fn load_listing(env: &Env, listing_id: &String) -> Result<MarketListing, CarbonError> {
        let key = DataKey::Listing(listing_id.clone());
        let listing = env.storage()
            .persistent()
            .get(&key)
            .ok_or(CarbonError::ListingNotFound)?;
        // Extend TTL on every read so active listings never expire
        env.storage().persistent().extend_ttl(&key, TTL_LEDGERS, TTL_LEDGERS);
        Ok(listing)
    }

    fn filter_listings<F: Fn(&MarketListing) -> bool>(env: &Env, predicate: F) -> Vec<MarketListing> {
        let all: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::AllListings)
            .unwrap_or_else(|| vec![env]);

        let mut result: Vec<MarketListing> = vec![env];
        for id in all.iter() {
            if let Some(l) = env.storage().persistent().get(&DataKey::Listing(id.clone())) {
                if predicate(&l) {
                    result.push_back(l);
                }
            }
        }
        result
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, MockAuth, MockAuthInvoke},
        vec, Env, IntoVal, String,
    };

    fn s(env: &Env, v: &str) -> String { String::from_str(env, v) }

    fn setup(env: &Env) -> (CarbonMarketplaceContractClient, Address, Address, Address) {
        env.mock_all_auths();
        let admin  = Address::generate(env);
        let seller = Address::generate(env);
        let usdc   = env.register_stellar_asset_contract(admin.clone());
        let id     = env.register_contract(None, CarbonMarketplaceContract);
        let client = CarbonMarketplaceContractClient::new(env, &id);
        client.initialize(&admin, &usdc);
        (client, admin, seller, usdc)
    }

    fn add_listing(env: &Env, client: &CarbonMarketplaceContractClient, seller: &Address) {
        client.list_credits(
            seller,
            &s(env, "list-001"),
            &s(env, "batch-001"),
            &s(env, "proj-001"),
            &100_i128,
            &10_0000000_i128, // 10 USDC in stroops
            &2023_u32,
            &s(env, "VCS"),
            &s(env, "Brazil"),
        );
    }

    #[test]
    fn test_list_credits_creates_active_listing() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);
        add_listing(&env, &client, &seller);
        let l = client.get_listing(&s(&env, "list-001"));
        assert_eq!(l.status, ListingStatus::Active);
        assert_eq!(l.amount_available, 100);
    }

    #[test]
    fn test_delist_removes_listing() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);
        add_listing(&env, &client, &seller);
        client.delist_credits(&seller, &s(&env, "list-001"));
        let l = client.get_listing(&s(&env, "list-001"));
        assert_eq!(l.status, ListingStatus::Delisted);
    }

    #[test]
    fn test_purchase_insufficient_credits_fails() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);
        add_listing(&env, &client, &seller);
        let buyer = Address::generate(&env);
        let result = client.try_purchase_credits(&buyer, &s(&env, "list-001"), &999_i128);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_listings_by_project() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);
        add_listing(&env, &client, &seller);
        let listings = client.get_listings_by_project(&s(&env, "proj-001"));
        assert_eq!(listings.len(), 1);
    }

    #[test]
    fn test_get_listings_by_vintage() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);
        add_listing(&env, &client, &seller);
        let listings = client.get_listings_by_vintage(&2023_u32);
        assert_eq!(listings.len(), 1);
        let empty = client.get_listings_by_vintage(&2020_u32);
        assert_eq!(empty.len(), 0);
    }

    #[test]
    fn test_get_active_listings() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);
        add_listing(&env, &client, &seller);
        let active = client.get_active_listings();
        assert_eq!(active.len(), 1);
    }

    #[test]
    fn test_zero_amount_listing_fails() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);
        let result = client.try_list_credits(
            &seller,
            &s(&env, "list-002"),
            &s(&env, "batch-002"),
            &s(&env, "proj-001"),
            &0_i128,
            &10_0000000_i128,
            &2023_u32,
            &s(&env, "VCS"),
            &s(&env, "Brazil"),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_suspended_project_listing_blocked() {
        let env = Env::default();
        let (client, admin, seller, _) = setup(&env);
        client.suspend_project(&admin, &s(&env, "proj-001"));
        let result = client.try_list_credits(
            &seller,
            &s(&env, "list-001"),
            &s(&env, "batch-001"),
            &s(&env, "proj-001"),
            &100_i128,
            &10_0000000_i128,
            &2023_u32,
            &s(&env, "VCS"),
            &s(&env, "Brazil"),
        );
        assert_eq!(result.unwrap_err().unwrap(), CarbonError::ProjectSuspended);
    }

    #[test]
    fn test_suspended_project_purchase_blocked() {
        let env = Env::default();
        let (client, admin, seller, _) = setup(&env);
        // List before suspending
        add_listing(&env, &client, &seller);
        // Suspend the project
        client.suspend_project(&admin, &s(&env, "proj-001"));
        let buyer = Address::generate(&env);
        let result = client.try_purchase_credits(&buyer, &s(&env, "list-001"), &10_i128);
        assert_eq!(result.unwrap_err().unwrap(), CarbonError::ProjectSuspended);
    }

    #[test]
    fn test_non_suspended_project_listing_succeeds() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);
        // No suspension — listing should succeed
        add_listing(&env, &client, &seller);
        let l = client.get_listing(&s(&env, "list-001"));
        assert_eq!(l.status, ListingStatus::Active);
    }

    #[test]
    fn test_overflow_purchase_graceful_error() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);

        client.list_credits(
            &seller,
            &s(&env, "list-001"),
            &s(&env, "batch-001"),
            &s(&env, "proj-001"),
            &10_i128,
            &(i128::MAX / 2),
            &2023_u32,
            &s(&env, "VCS"),
            &s(&env, "Brazil"),
        );

        let buyer = Address::generate(&env);
        let result = client.try_purchase_credits(&buyer, &s(&env, "list-001"), &3_i128);
        assert_eq!(result.unwrap_err().unwrap(), CarbonError::Arithmetic);
    }
}
