"""
price_oracle.py
Fetches carbon credit benchmark prices from Xpansiv CBL and Toucan Protocol,
calculates weighted average per methodology/vintage, and pushes to carbon_oracle
every 12 hours. Alerts admin if price deviation exceeds 15%.
"""

import os
import time
import logging
import schedule
import requests
from dotenv import load_dotenv
from stellar_sdk import Keypair, Network, SorobanServer, TransactionBuilder, scval
from stellar_sdk.soroban_rpc import SendTransactionStatus

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

ORACLE_SECRET_KEY    = os.environ["ORACLE_SECRET_KEY"]
ORACLE_CONTRACT_ID   = os.environ["CARBON_ORACLE_CONTRACT_ID"]
STELLAR_RPC_URL      = os.environ.get("STELLAR_RPC_URL", "https://soroban-testnet.stellar.org")
NETWORK_PASSPHRASE   = os.environ.get("NETWORK_PASSPHRASE", Network.TESTNET_NETWORK_PASSPHRASE)
XPANSIV_API_KEY      = os.environ.get("XPANSIV_API_KEY", "")
TOUCAN_API_KEY       = os.environ.get("TOUCAN_API_KEY", "")
ADMIN_ALERT_WEBHOOK  = os.environ.get("ADMIN_ALERT_WEBHOOK", "")
PRICE_DEVIATION_ALERT = 0.15  # 15%
USDC_STROOPS         = 10_000_000  # 1 USDC = 10^7 stroops

# In-memory cache of last pushed prices for deviation detection
_last_prices: dict[tuple[str, int], int] = {}

# ── Price feed fetchers ───────────────────────────────────────────────────────

def fetch_xpansiv_prices() -> list[dict]:
    """Fetch benchmark prices from Xpansiv CBL API."""
    if not XPANSIV_API_KEY:
        log.warning("XPANSIV_API_KEY not set — skipping Xpansiv feed")
        return []
    try:
        resp = requests.get(
            "https://api.xpansiv.com/v1/carbon/benchmarks",
            headers={"X-API-Key": XPANSIV_API_KEY},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("benchmarks", [])
    except Exception as e:
        log.error("Xpansiv fetch failed: %s", e)
        return []

def fetch_toucan_prices() -> list[dict]:
    """Fetch benchmark prices from Toucan Protocol price feed."""
    if not TOUCAN_API_KEY:
        log.warning("TOUCAN_API_KEY not set — skipping Toucan feed")
        return []
    try:
        resp = requests.get(
            "https://api.toucan.earth/v1/prices",
            headers={"Authorization": f"Bearer {TOUCAN_API_KEY}"},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("prices", [])
    except Exception as e:
        log.error("Toucan fetch failed: %s", e)
        return []

# ── Price aggregation ─────────────────────────────────────────────────────────

def aggregate_prices(xpansiv: list[dict], toucan: list[dict]) -> dict[tuple[str, int], float]:
    """
    Calculate volume-weighted average price per (methodology, vintage_year).
    Returns prices in USD (float).
    """
    buckets: dict[tuple[str, int], list[tuple[float, float]]] = {}

    for item in xpansiv:
        key = (item.get("methodology", "VCS"), int(item.get("vintage_year", 2023)))
        price  = float(item.get("price_usd", 0))
        volume = float(item.get("volume", 1))
        if price > 0:
            buckets.setdefault(key, []).append((price, volume))

    for item in toucan:
        key = (item.get("methodology", "VCS"), int(item.get("vintage_year", 2023)))
        price  = float(item.get("price_usd", 0))
        volume = float(item.get("volume", 1))
        if price > 0:
            buckets.setdefault(key, []).append((price, volume))

    result = {}
    for key, entries in buckets.items():
        total_volume = sum(v for _, v in entries)
        if total_volume == 0:
            continue
        wavg = sum(p * v for p, v in entries) / total_volume
        result[key] = wavg

    return result

def to_stroops(usd: float) -> int:
    return int(usd * USDC_STROOPS)

# ── Stellar submission ────────────────────────────────────────────────────────

def build_and_submit(server: SorobanServer, keypair: Keypair, function_name: str, args: list) -> str:
    account = server.load_account(keypair.public_key)
    tx = (
        TransactionBuilder(
            source_account=account,
            network_passphrase=NETWORK_PASSPHRASE,
            base_fee=300,
        )
        .append_invoke_contract_function_op(
            contract_id=ORACLE_CONTRACT_ID,
            function_name=function_name,
            parameters=args,
        )
        .set_timeout(30)
        .build()
    )
    tx = server.prepare_transaction(tx)
    tx.sign(keypair)
    response = server.send_transaction(tx)

    if response.status == SendTransactionStatus.ERROR:
        raise RuntimeError(f"Transaction failed: {response.error_result_xdr}")

    for _ in range(20):
        time.sleep(3)
        result = server.get_transaction(response.hash)
        if result.status == "SUCCESS":
            return response.hash
        if result.status == "FAILED":
            raise RuntimeError(f"Transaction FAILED: {result}")

    raise TimeoutError(f"Transaction {response.hash} not confirmed")

def alert_admin(message: str):
    if not ADMIN_ALERT_WEBHOOK:
        log.warning("ADMIN ALERT: %s", message)
        return
    try:
        requests.post(ADMIN_ALERT_WEBHOOK, json={"text": message}, timeout=10)
    except Exception as e:
        log.error("Alert webhook failed: %s", e)

# ── Core update logic ─────────────────────────────────────────────────────────

def update_prices():
    log.info("Starting price oracle update cycle")
    server  = SorobanServer(STELLAR_RPC_URL)
    keypair = Keypair.from_secret(ORACLE_SECRET_KEY)

    xpansiv_data = fetch_xpansiv_prices()
    toucan_data  = fetch_toucan_prices()
    prices       = aggregate_prices(xpansiv_data, toucan_data)

    if not prices:
        log.warning("No price data available from any feed")
        return

    for (methodology, vintage_year), price_usd in prices.items():
        stroops = to_stroops(price_usd)
        key     = (methodology, vintage_year)

        # Deviation check
        if key in _last_prices:
            last = _last_prices[key]
            deviation = abs(stroops - last) / last if last > 0 else 0
            if deviation > PRICE_DEVIATION_ALERT:
                msg = (
                    f"⚠️ Price deviation alert: {methodology} {vintage_year} "
                    f"moved {deviation:.1%} (${price_usd:.2f} USD)"
                )
                log.warning(msg)
                alert_admin(msg)

        try:
            tx_hash = build_and_submit(
                server, keypair,
                "update_credit_price",
                [
                    scval.to_address(keypair.public_key),
                    scval.to_string(methodology),
                    scval.to_uint32(vintage_year),
                    scval.to_int128(stroops),
                ],
            )
            _last_prices[key] = stroops
            log.info("Updated price %s/%d → $%.2f USD (tx %s)", methodology, vintage_year, price_usd, tx_hash)

        except Exception as e:
            log.error("Failed to push price for %s/%d: %s", methodology, vintage_year, e)

    log.info("Price oracle update cycle complete — %d prices pushed", len(prices))

# ── Scheduler ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("Price oracle starting — updating every 12 hours")
    update_prices()
    schedule.every(12).hours.do(update_prices)
    while True:
        schedule.run_pending()
        time.sleep(60)
