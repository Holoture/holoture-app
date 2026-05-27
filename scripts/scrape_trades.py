"""
Congressional stock trade scraper.

Sources:
  - House: disclosures-clerk.house.gov PTR PDFs (text extraction + regex)
  - Senate: efts.senate.gov STFA search API (electronic filings)

Tickers are ONLY extracted from the "(TICKER) [ST]" pattern in asset
descriptions — the format required by the House eFD system. Any trade
without a parenthesized ticker is discarded.

Output: data/all_trades.json — committed to master, fetched by Vercel cron.
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
# Static blocklist — words that appear inside parentheses but are not tickers
# ---------------------------------------------------------------------------

BAD_TICKERS = {
    "STOCK", "NEW", "GROUP", "CLASS", "LILLY", "TERM", "DEBT",
    "FUND", "REAL", "TRADE", "CORP", "PAPER", "HENRY", "INTL",
    "PLC", "INC", "OF", "FSV", "THE", "AND", "FOR", "NOT", "ORD",
    "ADR", "COM", "PAR", "CLA", "CLB", "SP", "DC", "JT",
    "SELF", "REV", "NOTE", "TOOL", "ONE", "TSY", "TSM",
    "ISAAC", "STATE", "NV",
}

# ---------------------------------------------------------------------------
# Party lookup — 119th Congress (2025-2027)
# Keys are cleaned "First Last" names after name normalization.
# ---------------------------------------------------------------------------

PARTY_LOOKUP: dict[str, str] = {
    # User-specified
    "Mark Alford": "Republican",
    "Gilbert Cisneros": "Democrat",
    "April McClain Delaney": "Democrat",
    "Brian Babin": "Republican",
    "Debbie Dingell": "Democrat",
    "Sheri Biggs": "Republican",
    "Byron Donalds": "Republican",
    "Suzan DelBene": "Democrat",
    # House Republicans
    "Andy Barr": "Republican",
    "Austin Scott": "Republican",
    "Barry Loudermilk": "Republican",
    "Bill Huizenga": "Republican",
    "Blaine Luetkemeyer": "Republican",
    "Brad Wenstrup": "Republican",
    "Brian Mast": "Republican",
    "Carlos Gimenez": "Republican",
    "Chuck Fleischmann": "Republican",
    "Claudia Tenney": "Republican",
    "Dan Crenshaw": "Republican",
    "David Kustoff": "Republican",
    "David Rouzer": "Republican",
    "Doug Collins": "Republican",
    "Drew Ferguson": "Republican",
    "Dusty Johnson": "Republican",
    "Earl Carter": "Republican",
    "Eric Burlison": "Republican",
    "French Hill": "Republican",
    "Garret Graves": "Republican",
    "Glenn Thompson": "Republican",
    "Greg Steube": "Republican",
    "Greg Murphy": "Republican",
    "Guy Reschenthaler": "Republican",
    "Jake Ellzey": "Republican",
    "Jason Smith": "Republican",
    "Jeff Duncan": "Republican",
    "Jeff Van Drew": "Republican",
    "John Curtis": "Republican",
    "John Joyce": "Republican",
    "John Moolenaar": "Republican",
    "Kevin Cramer": "Republican",
    "Kevin Hern": "Republican",
    "Lance Gooden": "Republican",
    "Lloyd Smucker": "Republican",
    "Marjorie Taylor Greene": "Republican",
    "Michael Cloud": "Republican",
    "Michael McCaul": "Republican",
    "Mike Collins": "Republican",
    "Mike Garcia": "Republican",
    "Mike Kelly": "Republican",
    "Mike Waltz": "Republican",
    "Morgan Griffith": "Republican",
    "Pat Fallon": "Republican",
    "Patrick McHenry": "Republican",
    "Pete Sessions": "Republican",
    "Ralph Norman": "Republican",
    "Randy Weber": "Republican",
    "Rich McCormick": "Republican",
    "Rob Wittman": "Republican",
    "Roger Williams": "Republican",
    "Ron Estes": "Republican",
    "Scott Perry": "Republican",
    "Tom Cole": "Republican",
    "Tom Emmer": "Republican",
    "Troy Nehls": "Republican",
    "Virginia Foxx": "Republican",
    "Warren Davidson": "Republican",
    "Wesley Hunt": "Republican",
    "Zach Nunn": "Republican",
    # House Democrats
    "Adam Schiff": "Democrat",
    "Bill Foster": "Democrat",
    "Brad Sherman": "Democrat",
    "Dan Goldman": "Democrat",
    "Daniel Kildee": "Democrat",
    "David Trone": "Democrat",
    "Dean Phillips": "Democrat",
    "Gerry Connolly": "Democrat",
    "Greg Stanton": "Democrat",
    "Jake Auchincloss": "Democrat",
    "Jim Himes": "Democrat",
    "Josh Gottheimer": "Democrat",
    "Kathy Manning": "Democrat",
    "Lois Frankel": "Democrat",
    "Mike Quigley": "Democrat",
    "Mikie Sherrill": "Democrat",
    "Nancy Pelosi": "Democrat",
    "Ro Khanna": "Democrat",
    "Scott Peters": "Democrat",
    "Seth Moulton": "Democrat",
    "Tom Suozzi": "Democrat",
    # Senate Republicans
    "Dan Sullivan": "Republican",
    "John Hoeven": "Republican",
    "Rand Paul": "Republican",
    "Rick Scott": "Republican",
    "Roger Marshall": "Republican",
    "Shelley Moore Capito": "Republican",
    "Thom Tillis": "Republican",
    "Tim Scott": "Republican",
    "Tommy Tuberville": "Republican",
    # Senate Democrats
    "Gary Peters": "Democrat",
    "Jack Reed": "Democrat",
    "Jacky Rosen": "Democrat",
    "John Hickenlooper": "Democrat",
    "Mark Warner": "Democrat",
    "Ron Wyden": "Democrat",
    "Sheldon Whitehouse": "Democrat",
}

# ---------------------------------------------------------------------------
# Name normalization: "Alford, . Mark" -> "Mark Alford"
# ---------------------------------------------------------------------------

def clean_name(raw: str) -> str:
    raw = raw.strip()
    if "," not in raw:
        return raw
    last, _, rest = raw.partition(",")
    last = last.strip()
    # Strip leading periods, spaces, "Hon.", etc.
    first = re.sub(r"^[\s\.\-]+", "", rest).strip()
    first = re.sub(r"^Hon\.?\s*", "", first, flags=re.IGNORECASE).strip()
    return f"{first} {last}".strip()


def lookup_party(name: str) -> str:
    return PARTY_LOOKUP.get(name, "Unknown")


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def safe_iso(raw: str) -> str:
    raw = (raw or "").strip()
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", raw)
    if m:
        return f"{m.group(3)}-{m.group(1).zfill(2)}-{m.group(2).zfill(2)}"
    if re.match(r"^\d{4}-\d{2}-\d{2}", raw):
        return raw[:10]
    return date.today().isoformat()


# ---------------------------------------------------------------------------
# Trade-type normalization
# ---------------------------------------------------------------------------

def norm_trade_type(raw: str) -> str:
    raw = (raw or "").strip().upper()
    if raw in ("P", "PURCHASE"):
        return "BUY"
    if raw in ("S", "SALE", "SELL", "SALE_FULL", "SALE_PARTIAL"):
        return "SELL"
    return "SELL"  # default to SELL if ambiguous (common for PTR filings)


# ---------------------------------------------------------------------------
# House PTR PDF -> trades
# The real data format (confirmed from live PDFs):
#
#   COMPANY NAME   [P|S]   MM/DD/YYYY   MM/DD/YYYY   $X - $Y
#   ASSET DESCRIPTION (TICKER) [ST]
#
# or on one line:
#   COMPANY NAME - COMMON STOCK (TICKER) [ST]   [P|S]   MM/DD/YYYY ...
# ---------------------------------------------------------------------------

_TICKER_RE = re.compile(r"\(([A-Z]{1,5})\)\s*\[ST\]", re.IGNORECASE)
_DATE_RE   = re.compile(r"\b(\d{2}/\d{2}/\d{4})\b")
_AMOUNT_RE = re.compile(r"\$[\d,]+\s*[-–]\s*\$[\d,]+")
_TYPE_RE   = re.compile(r"\b([PS])\s+\d{2}/\d{2}/\d{4}")  # P or S before a date

# Matches strings that are stock-type descriptors, not real company names
_GENERIC_DESC_RE = re.compile(
    r"^(?:common\s+stock|ordinary\s+shares?|class\s+[a-z]|depositary\s+shares?|"
    r"representing\s+|shares?\s+of\b|common\s+shares?|^shares?$|^stock$|"
    r"beneficial\s+interest|series\s+[a-z]\b|[a-z]\s+common|"
    r"\$[\d,]+|\?\s*$)",
    re.IGNORECASE,
)


def _is_generic(text: str) -> bool:
    """Return True if text is a stock type descriptor rather than a real company name."""
    text = text.strip()
    return not text or bool(_GENERIC_DESC_RE.match(text))


def extract_company_from_line(line: str, ticker_start: int) -> str:
    """Get the company name from a line ending with (TICKER) [ST]."""
    raw = line[:ticker_start].strip()
    # Strip asset-type suffixes: "- Common Stock", "- Ordinary Shares Class A", etc.
    raw = re.sub(
        r"\s*[-–]\s*(common\s+stock|ordinary\s+shares.*|class\s+[a-z]\s+(?:shares?|ordinary)?)\s*$",
        "",
        raw,
        flags=re.IGNORECASE,
    ).strip()
    return "" if _is_generic(raw) else raw


def parse_ptr_pdf(pdf_bytes: bytes, member_name: str) -> list[dict]:
    trades: list[dict] = []
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text(x_tolerance=3, y_tolerance=3) or ""
                # Null bytes appear from some font encodings -- strip them
                text = text.replace("\x00", "")
                lines = text.splitlines()

                for i, line in enumerate(lines):
                    m = _TICKER_RE.search(line)
                    if not m:
                        continue

                    ticker = m.group(1).upper()
                    if ticker in BAD_TICKERS or len(ticker) < 1 or len(ticker) > 5:
                        continue

                    # -- Company name -----------------------------------------
                    company = extract_company_from_line(line, m.start())
                    if not company and i > 0:
                        # Ticker is on a continuation line; company is on the previous line
                        prev = lines[i - 1].strip()
                        # Remove "P DATE DATE $AMOUNT" suffix to get bare company name
                        comp_m = re.match(
                            r"^([A-Z][A-Z0-9\s,\.&\-\'/]+?)\s+[PS]\s+\d{2}/\d{2}/\d{4}",
                            prev,
                            re.IGNORECASE,
                        )
                        if comp_m:
                            candidate = comp_m.group(1).strip()
                            if not _is_generic(candidate):
                                company = candidate
                        elif not _DATE_RE.search(prev) and not _is_generic(prev):
                            # Whole line is company name
                            company = prev

                    if not company:
                        company = ticker  # last resort

                    # -- Context window for amount / dates / type -------------
                    context = "\n".join(lines[max(0, i - 2) : i + 3])

                    # Amount
                    amt_m = _AMOUNT_RE.search(context)
                    amount = amt_m.group(0) if amt_m else "Unknown"

                    # Trade type: look for P or S immediately before a date
                    type_m = _TYPE_RE.search(context)
                    if type_m:
                        trade_type = norm_trade_type(type_m.group(1))
                    else:
                        # Fallback: look for P/S after the [ST] tag on the same line
                        post = line[m.end():]
                        post_m = re.search(r"\b([PS])\b", post, re.IGNORECASE)
                        trade_type = norm_trade_type(post_m.group(1)) if post_m else "SELL"

                    # Dates: first = transaction date, second = filing/notification date
                    dates = _DATE_RE.findall(context)
                    traded_at = safe_iso(dates[0]) if dates else date.today().isoformat()
                    filed_at  = safe_iso(dates[1]) if len(dates) > 1 else traded_at

                    trades.append(
                        {
                            "politician_name": member_name,
                            "party": lookup_party(member_name),
                            "chamber": "House",
                            "ticker": ticker,
                            "company_name": company,
                            "trade_type": trade_type,
                            "amount_range": amount,
                            "traded_at": traded_at,
                            "filed_at": filed_at,
                        }
                    )
    except Exception as exc:
        print(f"  PDF error ({member_name}): {exc}")
    return trades


# ---------------------------------------------------------------------------
# House scraper
# ---------------------------------------------------------------------------

def scrape_house(max_filings: int = 100) -> list[dict]:
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
    filings: list[dict] = []
    for row in soup.find_all("tr", role="row"):
        link = row.find("a", href=re.compile(r"ptr-pdfs/\d{4}/\d+\.pdf"))
        if not link:
            continue
        href = link["href"]
        mm = re.search(r"ptr-pdfs/(\d{4})/(\d+)\.pdf", href)
        if not mm:
            continue
        year, fid = mm.group(1), mm.group(2)
        # Clean name: "Alford, . Mark" -> "Mark Alford"
        raw_name = re.sub(r"\bHon\.?\b\.?\s*", "", link.text).strip()
        cleaned = clean_name(raw_name)
        filings.append(
            {
                "name": cleaned,
                "url": f"https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{fid}.pdf",
                "id": fid,
            }
        )

    print(f"Found {len(filings)} PTR filings; processing up to {max_filings}")

    for idx, entry in enumerate(filings[:max_filings]):
        print(f"  [{idx+1}/{min(len(filings), max_filings)}] {entry['name']} ({entry['id']})")
        try:
            r = SESSION.get(entry["url"], timeout=30)
            r.raise_for_status()
            found = parse_ptr_pdf(r.content, entry["name"])
            trades.extend(found)
            if found:
                print(f"    -> {len(found)} trade(s): {[t['ticker'] for t in found]}")
        except Exception as exc:
            print(f"    -> error: {exc}")
        time.sleep(0.4)

    print(f"House total: {len(trades)} trades\n")
    return trades


# ---------------------------------------------------------------------------
# Senate scraper -- tries efts.senate.gov STFA search (accessible from Linux)
# ---------------------------------------------------------------------------

def scrape_senate() -> list[dict]:
    print("=== Senate eFD search ===")
    trades: list[dict] = []

    from_date = (date.today() - timedelta(days=90)).isoformat()
    to_date   = date.today().isoformat()
    url = (
        "https://efts.senate.gov/LATEST/search-index"
        f"?q=&type=STFA&dateRange=custom&fromDate={from_date}&toDate={to_date}"
    )

    try:
        resp = SESSION.get(url, headers={"Accept": "application/json"}, timeout=20)
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        print(f"Senate eFD unavailable: {exc}\n")
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
        party = PARTY_LOOKUP.get(senator, "Unknown")

        for tx in src.get("transactions", []) or src.get("trade_data", []) or []:
            if not isinstance(tx, dict):
                continue
            # Prefer explicit ticker; then try parenthesized extraction
            raw_ticker = str(tx.get("ticker", tx.get("asset_ticker", ""))).upper().strip()
            if not raw_ticker or raw_ticker == "--":
                asset_text = str(tx.get("asset_name", tx.get("asset_description", "")))
                tm = _TICKER_RE.search(asset_text)
                raw_ticker = tm.group(1).upper() if tm else ""
            if not raw_ticker or raw_ticker in BAD_TICKERS:
                continue

            tx_type = norm_trade_type(str(tx.get("type", tx.get("transaction_type", "S"))))
            tx_date = safe_iso(str(tx.get("transaction_date", tx.get("date", filed))))
            asset_name = str(tx.get("asset_name", tx.get("asset_description", "")))
            # Strip ticker suffix from company name display
            clean_asset = _TICKER_RE.sub("", asset_name).strip().rstrip(" -–")

            trades.append(
                {
                    "politician_name": senator,
                    "party": party,
                    "chamber": "Senate",
                    "ticker": raw_ticker,
                    "company_name": clean_asset,
                    "trade_type": tx_type,
                    "amount_range": str(tx.get("amount", "Unknown")),
                    "traded_at": tx_date,
                    "filed_at": filed,
                }
            )

    print(f"Senate total: {len(trades)} trades\n")
    return trades


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    os.makedirs("data", exist_ok=True)

    all_trades = scrape_house() + scrape_senate()

    # Deduplicate by (name, ticker, traded_at, trade_type)
    seen: set[tuple] = set()
    unique: list[dict] = []
    for t in all_trades:
        key = (t["politician_name"], t["ticker"], t["traded_at"], t["trade_type"])
        if key not in seen:
            seen.add(key)
            unique.append(t)

    unique.sort(key=lambda t: t["traded_at"], reverse=True)
    print(f"Total unique trades: {len(unique)}")

    with open("data/all_trades.json", "w", encoding="utf-8") as fh:
        json.dump(unique, fh, indent=2)

    print("Saved -> data/all_trades.json")


if __name__ == "__main__":
    main()
