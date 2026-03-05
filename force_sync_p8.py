#!/usr/bin/env python3
"""Force sync specific plans R299 and R303 from TestRail to BigQuery.
Uses actual BQ schema from raw_plans, raw_runs, raw_tests tables.
"""
import requests
import json
import base64
import datetime
import warnings
warnings.filterwarnings('ignore')
from google.cloud import bigquery

BASE_URL = "https://segurossurapa.testrail.io"
USER = "gestioncalidad01@sura.com.pa"
API_KEY = "Z3t4eAIotXwa/wwDUzQV-K5XVg5LenwmnveAYMNFy"
GCP_PROJECT = "testrail-480214"
BQ_DATASET = "testrail_kpis"

auth = base64.b64encode(f"{USER}:{API_KEY}".encode()).decode()
headers_tr = {"Content-Type": "application/json", "Authorization": f"Basic {auth}"}
bq_client = bigquery.Client(project=GCP_PROJECT)

NOW = datetime.datetime.now(datetime.timezone.utc).isoformat()
SOURCE = "force_sync_p8"

def tr_get(endpoint):
    url = f"{BASE_URL}/index.php?/api/v2/{endpoint}"
    r = requests.get(url, headers=headers_tr)
    r.raise_for_status()
    return r.json()

def insert_rows(table_id, rows):
    table_ref = f"{GCP_PROJECT}.{BQ_DATASET}.{table_id}"
    errors = bq_client.insert_rows_json(table_ref, rows)
    if errors:
        print(f"  ❌ ERROR inserting to {table_id}: {errors}")
        return False
    else:
        print(f"  ✅ Inserted {len(rows)} rows into {table_id}")
        return True

plan_ids = [299, 303]

for plan_id in plan_ids:
    print(f"\n=== Syncing Plan {plan_id} ===")
    plan = tr_get(f"get_plan/{plan_id}")
    
    # raw_plans schema: id, project_id, milestone_id, name, description, is_completed,
    # completed_on, created_on, created_by, entries(JSON), url, _extracted_at, _source, custom_fields(JSON)
    custom_fields = {k: v for k, v in plan.items() if k.startswith("custom_")}
    plan_row = {
        "id": plan["id"],
        "name": plan.get("name"),
        "project_id": plan.get("project_id"),
        "description": plan.get("description"),
        "milestone_id": plan.get("milestone_id"),
        "is_completed": plan.get("is_completed", False),
        "completed_on": plan.get("completed_on"),
        "created_on": plan.get("created_on"),
        "created_by": plan.get("created_by"),
        "entries": json.dumps(plan.get("entries", [])),
        "url": plan.get("url"),
        "custom_fields": json.dumps(custom_fields) if custom_fields else None,
        "_extracted_at": NOW,
        "_source": SOURCE
    }
    insert_rows("raw_plans", [plan_row])
    
    # Insert runs from entries
    for entry in plan.get("entries", []):
        for run in entry.get("runs", []):
            run_id = run["id"]
            print(f"  Syncing run {run_id}: {run.get('name')} (passed: {run.get('passed_count')}/{run.get('passed_count',0)+run.get('failed_count',0)+run.get('untested_count',0)+run.get('blocked_count',0)+run.get('retest_count',0)})")
            
            # raw_runs schema: id, project_id, milestone_id, plan_id, suite_id, name, description,
            # config, is_completed, completed_on, passed_count, blocked_count, untested_count, retest_count,
            # failed_count, custom_status_count, created_on, created_by, url, updated_on, _extracted_at, _source, assignedto_id
            run_row = {
                "id": run["id"],
                "suite_id": run.get("suite_id"),
                "name": run.get("name"),
                "description": run.get("description"),
                "milestone_id": run.get("milestone_id"),
                "assignedto_id": run.get("assignedto_id"),
                "config": run.get("config"),
                "is_completed": run.get("is_completed", False),
                "completed_on": run.get("completed_on"),
                "created_on": run.get("created_on"),
                "created_by": run.get("created_by"),
                "plan_id": plan_id,
                "project_id": run.get("project_id"),
                "passed_count": run.get("passed_count", 0),
                "blocked_count": run.get("blocked_count", 0),
                "untested_count": run.get("untested_count", 0),
                "retest_count": run.get("retest_count", 0),
                "failed_count": run.get("failed_count", 0),
                "url": run.get("url"),
                "_extracted_at": NOW,
                "_source": SOURCE
            }
            insert_rows("raw_runs", [run_row])
            
            # Sync tests for the run
            print(f"    Fetching tests for run {run_id}...")
            tests_data = tr_get(f"get_tests/{run_id}")
            tests = tests_data.get("tests", tests_data if isinstance(tests_data, list) else [])
            print(f"    Found {len(tests)} tests")
            
            if tests:
                # raw_tests schema: id, case_id, run_id, status_id, assignedto_id, title,
                # template_id, type_id, priority_id, estimate, estimate_forecast, refs,
                # milestone_id, custom_status, custom_automation_type, _extracted_at, _source
                test_rows = []
                for t in tests:
                    test_rows.append({
                        "id": t["id"],
                        "case_id": t.get("case_id"),
                        "run_id": run_id,
                        "status_id": t.get("status_id"),
                        "assignedto_id": t.get("assignedto_id"),
                        "title": t.get("title"),
                        "template_id": t.get("template_id"),
                        "type_id": t.get("type_id"),
                        "priority_id": t.get("priority_id"),
                        "estimate": str(t.get("estimate")) if t.get("estimate") else None,
                        "estimate_forecast": str(t.get("estimate_forecast")) if t.get("estimate_forecast") else None,
                        "refs": t.get("refs"),
                        "milestone_id": t.get("milestone_id"),
                        "custom_status": t.get("custom_status"),
                        "custom_automation_type": t.get("custom_automation_type"),
                        "_extracted_at": NOW,
                        "_source": SOURCE
                    })
                insert_rows("raw_tests", test_rows)

print("\n✅ Force sync complete!")
print("Dashboard should now reflect the new plans after a page refresh.")
