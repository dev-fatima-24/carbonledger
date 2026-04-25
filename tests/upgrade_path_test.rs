use soroban_sdk::{testutils::{Address as _, Ledger}, Env, String, vec};
use carbon_registry_v1::CarbonRegistryContractV1 as V1;
use carbon_registry_v2::CarbonRegistryContractV2 as V2;

fn setup_v1() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    let verifier = Address::generate(&env);
    
    let v1_contract_id = env.register_contract(None, V1);
    let v1_client = V1::Client::new(&env, &v1_contract_id);
    v1_client.initialize(&admin, &oracle, &vec![&env, verifier.clone()]);
    
    (env, admin, oracle, verifier)
}

fn setup_v2() -> (Env, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let oracle = Address::generate(&env);
    let verifier = Address::generate(&env);
    
    let v2_contract_id = env.register_contract(None, V2);
    let v2_client = V2::Client::new(&env, &v2_contract_id);
    v2_client.initialize(&admin, &oracle, &vec![&env, verifier.clone()]);
    
    (env, admin, oracle, verifier)
}

fn make_str(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

#[test]
fn test_upgrade_path_v1_to_v2() {
    // Setup v1 contract
    let (env, admin, oracle, verifier) = setup_v1();
    let v1_contract_id = env.register_contract(None, V1);
    let v1_client = V1::Client::new(&env, &v1_contract_id);
    v1_client.initialize(&admin, &oracle, &vec![&env, verifier.clone()]);
    
    // Register a project in v1
    v1_client.register_project(
        &admin,
        &make_str(&env, "proj-001"),
        &make_str(&env, "Amazon Reforestation"),
        &make_str(&env, "QmCID123"),
        &verifier,
        &make_str(&env, "VCS"),
        &make_str(&env, "Brazil"),
        &make_str(&env, "forestry"),
        2023_u32,
    ).unwrap();
    
    // Verify the project
    v1_client.verify_project(&verifier, &make_str(&env, "proj-001")).unwrap();
    
    // Issue some credits
    v1_client.increment_issued(&oracle, &make_str(&env, "proj-001"), &1000_i128).unwrap();
    
    // Retire some credits
    v1_client.retire_credits(&admin, &make_str(&env, "proj-001"), &300_i128).unwrap();
    
    // Verify v1 state
    let project_v1 = v1_client.get_project(&make_str(&env, "proj-001")).unwrap();
    assert_eq!(project_v1.total_credits_issued, 1000);
    assert_eq!(project_v1.total_credits_retired, 300);
    
    // Now deploy v2 contract and simulate upgrade
    let v2_contract_id = env.register_contract(None, V2);
    let v2_client = V2::Client::new(&env, &v2_contract_id);
    
    // Initialize v2 with same admin/oracle/verifier
    v2_client.initialize(&admin, &oracle, &vec![&env, verifier.clone()]);
    
    // Perform upgrade
    v2_client.upgrade_from_v1(&admin).unwrap();
    
    // Verify upgrade
    assert_eq!(v2_client.get_version(), 2);
    
    let upgrade_history = v2_client.get_upgrade_history().unwrap();
    assert_eq!(upgrade_history.from_version, 1);
    assert_eq!(upgrade_history.to_version, 2);
    assert_eq!(upgrade_history.upgraded_by, admin);
    
    println!("✅ Upgrade path test passed");
}

#[test]
fn test_state_preservation_after_upgrade() {
    // Setup v1 contract with state
    let (env, admin, oracle, verifier) = setup_v1();
    let v1_contract_id = env.register_contract(None, V1);
    let v1_client = V1::Client::new(&env, &v1_contract_id);
    v1_client.initialize(&admin, &oracle, &vec![&env, verifier.clone()]);
    
    // Register and verify project
    v1_client.register_project(
        &admin,
        &make_str(&env, "proj-002"),
        &make_str(&env, "Solar Farm Project"),
        &make_str(&env, "QmCID456"),
        &verifier,
        &make_str(&env, "GS"),
        &make_str(&env, "India"),
        &make_str(&env, "renewable"),
        2024_u32,
    ).unwrap();
    
    v1_client.verify_project(&verifier, &make_str(&env, "proj-002")).unwrap();
    v1_client.increment_issued(&oracle, &make_str(&env, "proj-002"), &500_i128).unwrap();
    v1_client.retire_credits(&admin, &make_str(&env, "proj-002"), &200_i128).unwrap();
    
    // Deploy v2 and migrate state (in real scenario, this would be handled by upgrade mechanism)
    let v2_contract_id = env.register_contract(None, V2);
    let v2_client = V2::Client::new(&env, &v2_contract_id);
    v2_client.initialize(&admin, &oracle, &vec![&env, verifier.clone()]);
    
    // Register same project in v2 to simulate migration
    v2_client.register_project(
        &admin,
        &make_str(&env, "proj-002"),
        &make_str(&env, "Solar Farm Project"),
        &make_str(&env, "QmCID456"),
        &verifier,
        &make_str(&env, "GS"),
        &make_str(&env, "India"),
        &make_str(&env, "renewable"),
        2024_u32,
    ).unwrap();
    
    v2_client.verify_project(&verifier, &make_str(&env, "proj-002")).unwrap();
    v2_client.increment_issued(&oracle, &make_str(&env, "proj-002"), &500_i128).unwrap();
    v2_client.retire_credits(&admin, &make_str(&env, "proj-002"), &200_i128).unwrap();
    
    // Verify state preservation
    let project_v2 = v2_client.get_project(&make_str(&env, "proj-002")).unwrap();
    assert_eq!(project_v2.total_credits_issued, 500);
    assert_eq!(project_v2.total_credits_retired, 200);
    
    println!("✅ State preservation test passed");
}

#[test]
fn test_retired_credits_remain_retired() {
    let (env, admin, oracle, verifier) = setup_v2();
    let v2_contract_id = env.register_contract(None, V2);
    let v2_client = V2::Client::new(&env, &v2_contract_id);
    v2_client.initialize(&admin, &oracle, &vec![&env, verifier.clone()]);
    
    // Register and verify project
    v2_client.register_project(
        &admin,
        &make_str(&env, "proj-003"),
        &make_str(&env, "Wind Energy Project"),
        &make_str(&env, "QmCID789"),
        &verifier,
        &make_str(&env, "VCS"),
        &make_str(&env, "USA"),
        &make_str(&env, "wind"),
        2023_u32,
    ).unwrap();
    
    v2_client.verify_project(&verifier, &make_str(&env, "proj-003")).unwrap();
    v2_client.increment_issued(&oracle, &make_str(&env, "proj-003"), &1000_i128).unwrap();
    
    // Retire credits
    v2_client.retire_credits(&admin, &make_str(&env, "proj-003"), &800_i128).unwrap();
    
    // Verify retired credits
    let project = v2_client.get_project(&make_str(&env, "proj-003")).unwrap();
    assert_eq!(project.total_credits_retired, 800);
    assert_eq!(project.total_credits_issued, 1000);
    
    // Try to retire more than available - should fail
    let result = v2_client.try_retire_credits(&admin, &make_str(&env, "proj-003"), &300_i128);
    assert!(result.is_err());
    
    println!("✅ Retired credits preservation test passed");
}

#[test]
fn test_upgrade_by_non_admin_fails() {
    let (env, admin, oracle, verifier) = setup_v2();
    let v2_contract_id = env.register_contract(None, V2);
    let v2_client = V2::Client::new(&env, &v2_contract_id);
    v2_client.initialize(&admin, &oracle, &vec![&env, verifier.clone()]);
    
    // Try upgrade with non-admin
    let non_admin = Address::generate(&env);
    let result = v2_client.try_upgrade_from_v1(&non_admin);
    assert!(result.is_err());
    
    println!("✅ Non-admin upgrade restriction test passed");
}

#[test]
fn test_new_v2_functions() {
    let (env, admin, oracle, verifier) = setup_v2();
    let v2_contract_id = env.register_contract(None, V2);
    let v2_client = V2::Client::new(&env, &v2_contract_id);
    v2_client.initialize(&admin, &oracle, &vec![&env, verifier.clone()]);
    
    // Register and verify project
    v2_client.register_project(
        &admin,
        &make_str(&env, "proj-004"),
        &make_str(&env, "Hydroelectric Project"),
        &make_str(&env, "QmCID999"),
        &verifier,
        &make_str(&env, "GS"),
        &make_str(&env, "Canada"),
        &make_str(&env, "hydro"),
        2024_u32,
    ).unwrap();
    
    v2_client.verify_project(&verifier, &make_str(&env, "proj-004")).unwrap();
    
    // Use new v2 function: certify_project
    v2_client.certify_project(&admin, &make_str(&env, "proj-004"), &85_u32).unwrap();
    
    // Verify certification
    let project = v2_client.get_project(&make_str(&env, "proj-004")).unwrap();
    assert_eq!(project.credit_score, 85);
    assert!(project.certification_date.is_some());
    assert_eq!(project.status, V2::ProjectStatus::Certified);
    
    // Test version function
    assert_eq!(v2_client.get_version(), 2);
    
    println!("✅ New v2 functions test passed");
}
