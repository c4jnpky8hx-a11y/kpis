#!/usr/bin/env python3
"""Check plans in TestRail project 8 directly from the API."""
import requests
import json
import base64

BASE_URL = "https://segurossurapa.testrail.io"
USER = "gestioncalidad01@sura.com.pa"
API_KEY = "Z3t4eAIotXwa/wwDUzQV-K5XVg5LenwmnveAYMNFy"

auth = base64.b64encode(f"{USER}:{API_KEY}".encode()).decode()
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Basic {auth}"
}

for plan_id in [299, 303, 53]:
    print(f"\n=== PLAN {plan_id} DETAILS ===")
    url = f"{BASE_URL}/index.php?/api/v2/get_plan/{plan_id}"
    resp = requests.get(url, headers=headers)
    data = resp.json()
    print(f"  name: {data.get('name')}")
    print(f"  is_completed: {data.get('is_completed')}")
    entries = data.get('entries', [])
    print(f"  entries count: {len(entries)}")
    for entry in entries:
        runs = entry.get('runs', [])
        for run in runs:
            passed = run.get('passed_count', 0)
            total = run.get('untested_count', 0) + run.get('passed_count', 0) + run.get('failed_count', 0) + run.get('blocked_count', 0) + run.get('retest_count', 0)
            print(f"    Run {run.get('id')}: {run.get('name')} | passed={passed}/{total} | is_completed: {run.get('is_completed')}")
    if not entries:
        print("  NO ENTRIES (no runs/cycles in this plan)")

