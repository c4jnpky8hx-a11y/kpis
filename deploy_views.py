#!/usr/bin/env python3
"""Deploy SQL views to BigQuery."""
import os
import glob
from google.cloud import bigquery

PROJECT_ID = "testrail-480214"
client = bigquery.Client(project=PROJECT_ID)

# SQL files to deploy (in order due to dependencies)
sql_files = [
    "sql/kpi_replication.sql",       # dedup views + stg_Runs
    "sql/uat_timeline_kpi.sql",      # UAT timeline
    "sql/dashboard_mart.sql",        # main dashboard
    "sql/dashboard_pruebas.sql",     # testing dashboard
    "sql/run_details_mart.sql",      # cycle details
    "sql/dashboard_mart_projects.sql",  # project summary
    "sql/jira_defects_summary.sql",    # jira defects view
    "sql/workload_by_analyst.sql",     # workload chart
    "sql/project_analyst_demand.sql",  # demand chart
    "sql/insurance_process_coverage.sql",  # insurance coverage
]

root = os.path.dirname(os.path.abspath(__file__))

for sql_file in sql_files:
    filepath = os.path.join(root, sql_file)
    if not os.path.exists(filepath):
        print(f"SKIP (not found): {sql_file}")
        continue
    
    with open(filepath, "r") as f:
        content = f.read()
    
    # Split by semicolons at top level (CREATE OR REPLACE VIEW statements)
    # Each statement ends with a semicolon
    statements = [s.strip() for s in content.split(";") if s.strip()]
    
    print(f"\n--- Deploying {sql_file} ({len(statements)} statements) ---")
    for i, stmt in enumerate(statements):
        if not stmt or "--" == stmt:
            continue
        try:
            job = client.query(stmt)
            job.result()
            # Get the view name from the statement
            lines = stmt.splitlines()
            first_line = next((l for l in lines if l.strip() and not l.strip().startswith("--")), "")
            print(f"  [{i+1}/{len(statements)}] OK: {first_line[:80]}")
        except Exception as e:
            print(f"  [{i+1}/{len(statements)}] ERROR: {e}")

print("\n✅ Deployment complete!")
