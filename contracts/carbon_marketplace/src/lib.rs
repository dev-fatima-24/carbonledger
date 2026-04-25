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

    /// Initialise marketplace with admin and USDC token contract address.
    ///
    /// # Parameters
    /// - `admin`: The address that will have administrative privileges
    /// - `usdc_token`: Address of the USDC token contract for payments
    pub fn initialize(env: Env, admin: Address, usdc_token: Address) {
        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage().persistent().set(&DataKey::UsdcToken, &usdc_token);
        let listings: Vec<String> = vec![&env];
        env.storage().persistent().set(&DataKey::AllListings, &listings);
    }

    /// List carbon credits for sale at a fixed USDC price per credit (in stroops).
    ///
    /// # Parameters
    /// - `seller`: The address listing the credits for sale
    /// - `listing_id`: Unique identifier for this listing
    /// - `batch_id`: The credit batch identifier
    /// - `project_id`: The project identifier
    /// - `amount`: Number of credits to list
    /// - `price_per_credit_usdc`: Price per credit in USDC stroops
    /// - `vintage_year`: Year the credits were generated
    /// - `methodology`: Carbon accounting methodology
    /// - `country`: Country where the project is located
    ///
    /// # Errors
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `amount` or `price_per_credit_usdc` is zero
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

        if amount <= 0 || price_per_credit_usdc <= 0 {
            return Err(CarbonError::ZeroAmountNotAllowed);
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
    /// # Parameters
    /// - `seller`: The seller's address
    /// - `listing_id`: The listing identifier to remove
    ///
    /// # Errors
    /// - [`CarbonError::ListingNotFound`] if listing does not exist
    /// - [`CarbonError::UnauthorizedVerifier`] if caller is not the seller
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
    /// # Parameters
    /// - `buyer`: The buyer's address
    /// - `listing_id`: The listing identifier to purchase from
    /// - `amount`: Number of credits to purchase
    ///
    /// # Errors
    /// - [`CarbonError::ListingNotFound`] if listing does not exist or is not active
    /// - [`CarbonError::InsufficientLiquidity`] if listing has fewer credits than requested
    /// - [`CarbonError::ZeroAmountNotAllowed`] if `amount` is zero
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
    /// # Parameters
    /// - `buyer`: The buyer's address
    /// - `listing_ids`: Vector of listing identifiers to purchase from
    /// - `amounts`: Vector of amounts to purchase from each listing
    ///
    /// # Errors
    /// - Any error from individual [`purchase_credits`] calls propagates immediately
    /// - [`CarbonError::InvalidSerialRange`] if listing_ids and amounts have different lengths
    /// - [`CarbonError::ZeroAmountNotAllowed`] if any amount is zero
    /// - [`CarbonError::ListingNotFound`] if any listing does not exist or is not active
    /// - [`CarbonError::InsufficientLiquidity`] if any listing has insufficient credits
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
    ///
    /// # Parameters
    /// - `listing_id`: The listing identifier
    ///
    /// # Returns
    /// The market listing record
    ///
    /// # Errors
    /// - [`CarbonError::ListingNotFound`] if listing does not exist
    pub fn get_listing(env: Env, listing_id: String) -> Result<MarketListing, CarbonError> {
        Self::load_listing(&env, &listing_id)
    }

    /// Returns all listings with `Active` or `PartiallyFilled` status.
    ///
    /// # Returns
    /// Vector of all active market listings
    pub fn get_active_listings(env: Env) -> Vec<MarketListing> {
        Self::filter_listings(&env, |l| {
            l.status == ListingStatus::Active || l.status == ListingStatus::PartiallyFilled
        })
    }

    /// Returns all listings for a given project ID.
    ///
    /// # Parameters
    /// - `project_id`: The project identifier
    ///
    /// # Returns
    /// Vector of all listings for the project
    pub fn get_listings_by_project(env: Env, project_id: String) -> Vec<MarketListing> {
        Self::filter_listings(&env, |l| l.project_id == project_id)
    }

    /// Returns all listings matching a given vintage year.
    ///
    /// # Parameters
    /// - `vintage_year`: The vintage year to filter by
    ///
    /// # Returns
    /// Vector of all listings for the vintage year
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
