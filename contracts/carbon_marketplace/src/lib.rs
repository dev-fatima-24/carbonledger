#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, Env, String, Vec,
    symbol_short, vec,
    token,
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
    Listing(String),
    AllListings,
    Admin,
    UsdcToken,
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

    /// Returns the current year based on the ledger timestamp.
    fn current_year(env: &Env) -> u32 {
        let seconds_per_year: u64 = 31557600; // Approximate seconds in a year
        let timestamp = env.ledger().timestamp();
        1970 + (timestamp / seconds_per_year) as u32
    }

    /// Initialise marketplace with admin and USDC token contract address.
    pub fn initialize(env: Env, admin: Address, usdc_token: Address) {
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::UsdcToken, &usdc_token);
        let listings: Vec<String> = vec![&env];
        env.storage().persistent().set(&DataKey::AllListings, &listings);
    }

    /// List carbon credits for sale at a fixed USDC price per credit (in stroops).
    ///
    /// # Errors
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `amount` or `price_per_credit_usdc` is zero.
    /// - [`CarbonError::InvalidVintageYear`] if `vintage_year` is before 1990 or after current year + 1.
    /// - [`CarbonError::InvalidSerialRange`] if `amount` is negative or zero.
    /// - [`CarbonError::ProjectNotFound`] if any string input is empty or too long.
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

        // Validate string inputs (non-empty and reasonable length)
        if listing_id.is_empty() || listing_id.chars().count() > 64 {
            return Err(CarbonError::ListingNotFound);
        }
        if batch_id.is_empty() || batch_id.chars().count() > 64 {
            return Err(CarbonError::ListingNotFound);
        }
        if project_id.is_empty() || project_id.chars().count() > 64 {
            return Err(CarbonError::ListingNotFound);
        }
        if methodology.is_empty() || methodology.chars().count() > 64 {
            return Err(CarbonError::ListingNotFound);
        }
        if country.is_empty() || country.chars().count() > 64 {
            return Err(CarbonError::ListingNotFound);
        }

        // Validate numeric inputs
        if amount <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }
        if price_per_credit_usdc <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
        }

        let current_year = Self::current_year(&env);
        if vintage_year < 1990 || vintage_year > current_year + 1 {
            return Err(CarbonError::InvalidVintageYear);
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
        if amount > listing.amount_available {
            return Err(CarbonError::InsufficientLiquidity);
        }

        // ── effects ───────────────────────────────────────────────────────────
        let total_cost = listing.price_per_credit * amount;
        let protocol_fee = total_cost / 100; // 1%
        let seller_proceeds = total_cost - protocol_fee;

        listing.amount_available -= amount;
        listing.status = if listing.amount_available == 0 {
            ListingStatus::Sold
        } else {
            ListingStatus::PartiallyFilled
        };
        env.storage().persistent().set(&DataKey::Listing(listing_id.clone()), &listing);

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
            if amount > listing.amount_available {
                return Err(CarbonError::InsufficientLiquidity);
            }

            let total_cost = listing.price_per_credit * amount;
            let protocol_fee = total_cost / 100;
            let seller_proceeds = total_cost - protocol_fee;

            listing.amount_available -= amount;
            listing.status = if listing.amount_available == 0 {
                ListingStatus::Sold
            } else {
                ListingStatus::PartiallyFilled
            };
            env.storage().persistent().set(&DataKey::Listing(listing_id.clone()), &listing);

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

    fn load_listing(env: &Env, listing_id: &String) -> Result<MarketListing, CarbonError> {
        env.storage()
            .persistent()
            .get(&DataKey::Listing(listing_id.clone()))
            .ok_or(CarbonError::ListingNotFound)
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
        ).unwrap();
    }

    #[test]
    fn test_list_credits_creates_active_listing() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);
        add_listing(&env, &client, &seller);
        let l = client.get_listing(&s(&env, "list-001")).unwrap();
        assert_eq!(l.status, ListingStatus::Active);
        assert_eq!(l.amount_available, 100);
    }

    #[test]
    fn test_delist_removes_listing() {
        let env = Env::default();
        let (client, _, seller, _) = setup(&env);
        add_listing(&env, &client, &seller);
        client.delist_credits(&seller, &s(&env, "list-001")).unwrap();
        let l = client.get_listing(&s(&env, "list-001")).unwrap();
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
}
