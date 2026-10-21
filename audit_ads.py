#!/usr/bin/env python3
"""
Densmore Drone Services - Google Ads Automated Daily Audit & Pacing Tool
Runs during the daily 6:00 PM audit cycle between the 5:00 PM export and 7:00 PM applier.
"""

import sys
import io
import csv
import urllib.request
import urllib.parse
from datetime import datetime, date

SPREADSHEET_ID = "1OvSHBe9QoQ1BSwURiNNgbdwzQ6ATlvG8X3gHCZXBoMk"
PROMO_GOAL = 500.00
PROMO_EXPIRATION = date(2026, 11, 27)

def fetch_sheet_csv(sheet_name):
    url = f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(sheet_name)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=15).read().decode("utf-8")
        reader = csv.DictReader(io.StringIO(data))
        return list(reader)
    except Exception as e:
        print(f"[WARN] Failed to fetch sheet '{sheet_name}': {e}", file=sys.stderr)
        return []

def run_audit():
    print("=" * 65)
    print("  DENSMORE DRONE SERVICES - DAILY ADS PACING & PERFORMANCE AUDIT")
    print(f"  Execution Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    today = date.today()
    days_left = (PROMO_EXPIRATION - today).days

    daily_rows = fetch_sheet_csv("Daily_Performance")
    campaign_rows = fetch_sheet_csv("Campaign_Overview")
    search_terms = fetch_sheet_csv("Search_Terms_Report")
    active_kws = fetch_sheet_csv("Active_Keywords")

    # 1. Total Spend Calculation
    total_spend = 0.0
    for r in campaign_rows:
        try:
            total_spend += float(r.get("Total Cost ($)", 0) or 0)
        except ValueError:
            pass

    # Fallback to summing daily performance if campaign overview missing
    if total_spend == 0.0 and daily_rows:
        for r in daily_rows:
            try:
                total_spend += float(r.get("Cost ($)", 0) or 0)
            except ValueError:
                pass

    remaining_spend = max(0.0, PROMO_GOAL - total_spend)
    required_run_rate = (remaining_spend / max(1, days_left)) if days_left > 0 else 0.0

    print(f"\n[1] PROMO PACING STATUS (Deadline: {PROMO_EXPIRATION.strftime('%b %d, %Y')}):")
    print(f"    - Goal Spend:            ${PROMO_GOAL:.2f}")
    print(f"    - Total Spent to Date:   ${total_spend:.2f} ({(total_spend / PROMO_GOAL) * 100:.1f}%)")
    print(f"    - Remaining Spend:       ${remaining_spend:.2f}")
    print(f"    - Days Remaining:        {days_left} days")
    print(f"    - Required Daily Spend:  ${required_run_rate:.2f}/day")

    # 2. Recent Spend Velocity
    print("\n[2] RECENT DAILY SPEND (Last 5 Days):")
    for r in daily_rows[:5]:
        d = r.get("Date", "N/A")
        impr = r.get("Impressions", "0")
        clicks = r.get("Clicks", "0")
        cost = r.get("Cost ($)", "0.00")
        ctr = r.get("CTR (%)", "0.0%")
        print(f"    - {d}: {impr:>3} impr, {clicks:>2} clicks, ${float(cost or 0):>5.2f} spend (CTR: {ctr})")

    # Pacing verdict
    if total_spend >= PROMO_GOAL:
        print("\n>>> VERDICT: GOAL ACHIEVED! $500 Credit Threshold Reached.")
    elif days_left <= 0:
        print("\n>>> VERDICT: DEADLINE REACHED.")
    else:
        recent_3d_cost = sum([float(r.get("Cost ($)", 0) or 0) for r in daily_rows[:3]])
        recent_avg = recent_3d_cost / 3.0 if len(daily_rows) >= 3 else (float(daily_rows[0].get("Cost ($)", 0) or 0) if daily_rows else 0.0)
        print(f"\n    - Recent 3-Day Avg Spend: ${recent_avg:.2f}/day")
        if recent_avg < required_run_rate * 0.75:
            print(f">>> VERDICT: UNDERPACING (Needs +${required_run_rate - recent_avg:.2f}/day).")
            print("    ACTION: Raise bids by $0.25 - $0.50 or loosen keyword match types.")
        elif recent_avg > 25.00:
            print(">>> VERDICT: OVERPACING. Pacing ahead of target.")
        else:
            print(">>> VERDICT: ON TARGET. Current run-rate matches required pace.")

    # 3. Search Terms Leak Analysis
    print(f"\n[3] SEARCH TERMS AUDIT ({len(search_terms)} queries analyzed):")
    flagged_queries = []
    suspicious_patterns = ["diy", "free", "how to", "job", "salary", "toy", "drone for sale", "sonar", "underwater", "cheap"]
    for st in search_terms:
        query = st.get("Search Term", "").lower()
        impr = int(st.get("Impressions", 0) or 0)
        clicks = int(st.get("Clicks", 0) or 0)
        cost = float(st.get("Total Cost ($)", 0) or 0)

        for pat in suspicious_patterns:
            if pat in query:
                flagged_queries.append((query, pat, impr, clicks, cost))
                break

    if flagged_queries:
        print("    [!] Flagged queries found in search terms:")
        for q, pat, impr, clicks, cost in flagged_queries:
            print(f"        * '{q}' (Matched '{pat}') -> {impr} impr, {clicks} clicks, ${cost:.2f} cost")
    else:
        print("    [OK] No common negative query leaks detected in current search terms.")

    print("\n" + "=" * 65)

if __name__ == "__main__":
    run_audit()
