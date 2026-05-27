"""
Congressional stock trade scraper.

Sources:
  - House: disclosures-clerk.house.gov PTR (Periodic Transaction Report) PDFs
  - Senate: efts.senate.gov STFA search API (electronic filings)

Output: data/all_trades.json — fetched daily by the Vercel politician cron.
"""

import io
import json
import os
import re
import time
from datetime import date, datetime, timedelta

import pdfplumber
import requests
from bs4 import BeautifulSoup

UA = "Mozilla/5.0 (compatible; HolotureBot/1.0; +https://holoture.com)"
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA})

# ---------------------------------------------------------------------------
# Ticker lookup — covers the most-traded names found in congressional filings
# ---------------------------------------------------------------------------

COMPANY_TO_TICKER: dict[str, str] = {
    "apple": "AAPL", "microsoft": "MSFT", "nvidia": "NVDA",
    "alphabet": "GOOGL", "google": "GOOGL", "amazon": "AMZN",
    "meta platforms": "META", "meta ": "META", "facebook": "META",
    "tesla": "TSLA", "berkshire": "BRK.B", "visa": "V",
    "mastercard": "MA", "jpmorgan": "JPM", "j.p. morgan": "JPM",
    "johnson & johnson": "JNJ", "j&j": "JNJ",
    "unitedhealth": "UNH", "exxon": "XOM", "chevron": "CVX",
    "pfizer": "PFE", "abbott": "ABT", "walmart": "WMT",
    "costco": "COST", "netflix": "NFLX", "disney": "DIS",
    "boeing": "BA", "caterpillar": "CAT", "intel": "INTC",
    "advanced micro": "AMD", "qualcomm": "QCOM", "broadcom": "AVGO",
    "bank of america": "BAC", "wells fargo": "WFC",
    "goldman sachs": "GS", "morgan stanley": "MS",
    "citigroup": "C", "citi ": "C",
    "palantir": "PLTR", "lockheed": "LMT", "raytheon": "RTX",
    "general dynamics": "GD", "northrop": "NOC", "l3harris": "LHX",
    "crowdstrike": "CRWD", "palo alto": "PANW", "cloudflare": "NET",
    "datadog": "DDOG", "servicenow": "NOW", "salesforce": "CRM",
    "oracle": "ORCL", "adobe": "ADBE", "intuit": "INTU",
    "paypal": "PYPL", "block ": "SQ", "square": "SQ",
    "shopify": "SHOP", "uber": "UBER", "lyft": "LYFT",
    "airbnb": "ABNB", "coinbase": "COIN", "robinhood": "HOOD",
    "sofi": "SOFI", "eli lilly": "LLY", "merck": "MRK",
    "moderna": "MRNA", "biogen": "BIIB", "amgen": "AMGN",
    "gilead": "GILD", "novo nordisk": "NVO", "abbvie": "ABBV",
    "deere": "DE", "honeywell": "HON", "general electric": "GE",
    "3m": "MMM", "union pacific": "UNP", "norfolk southern": "NSC",
    "home depot": "HD", "lowe": "LOW", "target": "TGT",
    "mcdonald": "MCD", "starbucks": "SBUX", "nike": "NKE",
    "pepsico": "PEP", "coca-cola": "KO", "procter & gamble": "PG",
    "procter": "PG", "at&t": "T", "verizon": "VZ",
    "comcast": "CMCSA", "energy transfer": "ET",
    "kinder morgan": "KMI", "nextera": "NEE",
    "american express": "AXP", "charles schwab": "SCHW",
    "blackrock": "BLK", "s&p 500": "SPY", "nasdaq": "QQQ",
    "taiwan semiconductor": "TSM", "tsmc": "TSM",
    "arm holdings": "ARM", "arm ": "ARM",
    "super micro": "SMCI", "applied materials": "AMAT",
    "lam research": "LRCX", "kla": "KLAC",
    "micron": "MU", "western digital": "WDC",
    "seagate": "STX", "on semiconductor": "ON",
    "marvell": "MRVL", "skyworks": "SWKS",
    "monolithic power": "MPWR", "lattice semiconductor": "LSCC",
    "axcelis": "ACLS", "asml": "ASML",
    "pepsico": "PEP", "abbott laboratories": "ABT",
    "regeneron": "REGN", "vertex pharmaceuticals": "VRTX",
    "illumina": "ILMN", "intuitive surgical": "ISRG",
    "medtronic": "MDT", "stryker": "SYK", "zimmer biomet": "ZBH",
    "danaher": "DHR", "thermo fisher": "TMO",
    "waste management": "WM", "republic services": "RSG",
    "american tower": "AMT", "crown castle": "CCI",
    "prologis": "PLD", "equinix": "EQIX",
    "simon property": "SPG", "realty income": "O",
    "digital realty": "DLR",
}


def guess_ticker(text: str) -> str:
    """Extract or guess a stock ticker from an asset description."""
    if not text:
        return ""

    # Explicit patterns: (AAPL), [AAPL], 'AAPL', AAPL:, Stock: AAPL
    explicit = re.search(
        r"[\(\[\s']([A-Z]{1,5})[\)\]\s']|"
        r"\b([A-Z]{2,5}):\s|"
        r"(?:ticker|symbol|nasdaq|nyse)[:\s]+([A-Z]{1,5})",
        text,
        re.IGNORECASE,
    )
    if explicit:
        for g in explicit.groups():
            if g and g not in {
                "THE", "INC", "LLC", "LTD", "ETF", "AND", "FOR", "NOT",
                "ORD", "PLC", "ADR", "COM", "PAR", "CLA", "CLB",
                "SP", "DC", "JT",  # ownership codes on PTR forms
            }:
                return g.upper()

    # Company name fragment match (longest match wins)
    lower = text.lower()
    best = ("", "")
    for frag, ticker in COMPANY_TO_TICKER.items():
        if frag in lower and len(frag) > len(best[0]):
            best = (frag, ticker)
    if best[1]:
        return best[1]

    return ""


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------

def norm_trade_type(raw: str) -> str:
    raw = (raw or "").lower().strip()
    if "purchase" in raw or raw == "p":
        return "BUY"
    if "sale" in raw or raw in ("s", "sell"):
        return "SELL"
    return raw.upper() or "UNKNOWN"


def norm_party(raw: str) -> str:
    lower = (raw or "").lower()
    if "democrat" in lower or lower == "d":
        return "Democrat"
    if "republican" in lower or lower == "r":
        return "Republican"
    if "independent" in lower or lower == "i":
        return "Independent"
    return "Unknown"


def safe_iso(raw: str) -> str:
    """Convert various date formats to YYYY-MM-DD."""
    if not raw:
        return date.today().isoformat()
    raw = raw.strip()
    # MM/DD/YYYY
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    if m:
        return f"{m.group(3)}-{m.group(1).zfill(2)}-{m.group(2).zfill(2)}"
    # YYYY-MM-DD already
    if re.match(r"^\d{4}-\d{2}-\d{2}", raw):
        return raw[:10]
    return date.today().isoformat()


# ---------------------------------------------------------------------------
# House PTR PDF parsing
# ---------------------------------------------------------------------------

_AMOUNT_RE = re.compile(r"\$[\d,]+\s*[-–]\s*\$[\d,]+|\$[\d,]+")
_DATE_RE = re.compile(r"\d{1,2}/\d{1,2}/\d{4}")
_TYPE_TOKENS = {"p", "s", "purchase", "sale", "sale_full", "sale_partial", "sell"}


def parse_ptr_pdf(pdf_bytes: bytes, member_name: str) -> list[dict]:
    """Extract transactions from a single House PTR PDF using pdfplumber."""
    trades = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables(
                    table_settings={
                        "vertical_strategy": "lines",
                        "horizontal_strategy": "lines",
                    }
                )
                for table in (tables or []):
                    for row in (table or []):
                        row = [str(c or "").strip() for c in row]
                        if len(row) < 3:
                            continue

                        # Identify cell roles by content pattern
                        asset_name = ""
                        tx_type = ""
                        tx_date = ""
                        amount = ""

                        for cell in row:
                            cl = cell.lower()
                            if not tx_type and cl in _TYPE_TOKENS:
                                tx_type = cell
                            elif not tx_type and any(
                                w in cl for w in ("purchase", "sale", "sell")
                            ):
                                tx_type = cell
                            elif not tx_date and _DATE_RE.match(cell):
                                tx_date = cell
                            elif not amount and _AMOUNT_RE.search(cell):
                                amount = cell
                            elif (
                                not asset_name
                                and len(cell) > 3
                                and not _DATE_RE.match(cell)
                                and not _AMOUNT_RE.search(cell)
                                and cl not in _TYPE_TOKENS
                                # skip ownership codes
                                and cl not in {"sp", "dc", "jt", "self", "child", "spouse"}
                            ):
                                asset_name = cell

                        if not tx_type:
                            continue

                        # Use full row text as fallback asset name
                        if not asset_name:
                            for cell in row:
                                if len(cell) > 5 and cell != tx_type and cell != tx_date:
                                    asset_name = cell
                                    break

                        ticker = guess_ticker(asset_name) if asset_name else ""
                        if not ticker:
                            # Try full row text
                            ticker = guess_ticker(" ".join(row))
                        if not ticker:
                            continue  # skip non-identifiable assets

                        trades.append(
                            {
                                "politician_name": member_name,
                                "party": "Unknown",
                                "chamber": "House",
                                "ticker": ticker,
                                "company_name": asset_name,
                                "trade_type": norm_trade_type(tx_type),
                                "amount_range": amount or "Unknown",
                                "traded_at": safe_iso(tx_date),
                                "filed_at": date.today().isoformat(),
                            }
                        )
    except Exception as exc:
        print(f"  PDF parse error ({member_name}): {exc}")
    return trades


# ---------------------------------------------------------------------------
# House scraper
# ---------------------------------------------------------------------------

def scrape_house(max_filings: int = 80) -> list[dict]:
    print("=== House PTR filings ===")
    trades: list[dict] = []

    try:
        resp = SESSION.post(
            "https://disclosures-clerk.house.gov/FinancialDisclosure/ViewMemberSearchResult",
            data={
                "LastName": "",
                "State": "",
                "FilingYear": datetime.now().year,
                "filingType": "P",
                "action": "Filter",
            },
            timeout=30,
        )
        resp.raise_for_status()
    except Exception as exc:
        print(f"House Clerk search failed: {exc}")
        return []

    soup = BeautifulSoup(resp.text, "lxml")
    filing_rows = []
    for row in soup.find_all("tr", role="row"):
        link = row.find("a", href=re.compile(r"ptr-pdfs/\d{4}/(\d+)\.pdf"))
        if not link:
            continue
        href = link["href"]
        m = re.search(r"ptr-pdfs/(\d{4})/(\d+)\.pdf", href)
        if not m:
            continue
        year, fid = m.group(1), m.group(2)
        name = re.sub(r"\bHon\.?\b\.?\s*", "", link.text).strip()
        filing_rows.append(
            {
                "name": name,
                "url": f"https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{fid}.pdf",
                "id": fid,
            }
        )

    print(f"Found {len(filing_rows)} PTR filings; processing up to {max_filings}")

    for i, entry in enumerate(filing_rows[:max_filings]):
        print(f"  [{i+1}/{min(len(filing_rows), max_filings)}] {entry['name']} ({entry['id']})")
        try:
            r = SESSION.get(entry["url"], timeout=30)
            r.raise_for_status()
            found = parse_ptr_pdf(r.content, entry["name"])
            trades.extend(found)
            if found:
                print(f"    → {len(found)} trades")
        except Exception as exc:
            print(f"    → error: {exc}")
        time.sleep(0.4)  # be polite to the server

    print(f"House total: {len(trades)} trades with identified tickers")
    return trades


# ---------------------------------------------------------------------------
# Senate scraper — tries the eFD full-text search API
# ---------------------------------------------------------------------------

def scrape_senate() -> list[dict]:
    print("=== Senate eFD search ===")
    trades: list[dict] = []

    from_date = (date.today() - timedelta(days=90)).isoformat()
    to_date = date.today().isoformat()
    url = (
        f"https://efts.senate.gov/LATEST/search-index"
        f"?q=&type=STFA&dateRange=custom&fromDate={from_date}&toDate={to_date}"
    )

    try:
        resp = SESSION.get(url, headers={"Accept": "application/json"}, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        print(f"Senate eFD unavailable: {exc}")
        return []

    hits = data.get("hits", {}).get("hits", [])
    print(f"Senate eFD returned {len(hits)} filing records")

    for hit in hits:
        src = hit.get("_source", {})
        senator = (
            f"{src.get('first_name', '')} {src.get('last_name', '')}".strip()
            or src.get("name", "")
        )
        if not senator:
            continue

        filed = safe_iso(str(src.get("date_filed", "")))
        party = norm_party(str(src.get("party", "")))

        # Electronic STFA filings may embed transactions directly
        for tx in src.get("transactions", []) or src.get("trade_data", []) or []:
            if not isinstance(tx, dict):
                continue
            raw_ticker = str(tx.get("ticker", tx.get("asset_ticker", ""))).upper().strip()
            ticker = raw_ticker if raw_ticker and raw_ticker != "--" else guess_ticker(
                str(tx.get("asset_name", tx.get("asset_description", "")))
            )
            if not ticker:
                continue

            trades.append(
                {
                    "politician_name": senator,
                    "party": party,
                    "chamber": "Senate",
                    "ticker": ticker,
                    "company_name": str(
                        tx.get("asset_name", tx.get("asset_description", ""))
                    ),
                    "trade_type": norm_trade_type(
                        str(tx.get("type", tx.get("transaction_type", "")))
                    ),
                    "amount_range": str(tx.get("amount", "Unknown")),
                    "traded_at": safe_iso(
                        str(tx.get("transaction_date", tx.get("date", filed)))
                    ),
                    "filed_at": filed,
                }
            )

    print(f"Senate total: {len(trades)} trades with identified tickers")
    return trades


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    os.makedirs("data", exist_ok=True)

    all_trades = scrape_house() + scrape_senate()

    # Deduplicate by (politician, ticker, traded_at, trade_type)
    seen: set[tuple] = set()
    unique: list[dict] = []
    for t in all_trades:
        key = (t["politician_name"], t["ticker"], t["traded_at"], t["trade_type"])
        if key not in seen:
            seen.add(key)
            unique.append(t)

    # Sort newest-first
    unique.sort(key=lambda t: t["traded_at"], reverse=True)

    print(f"\nTotal unique trades: {len(unique)}")

    with open("data/all_trades.json", "w", encoding="utf-8") as fh:
        json.dump(unique, fh, indent=2)

    print("Saved → data/all_trades.json")


if __name__ == "__main__":
    main()
