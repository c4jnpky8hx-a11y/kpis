import os
import json
import logging
import base64

os.environ['GCP_PROJECT_ID'] = 'testrail-480214'
os.environ['BQ_DATASET'] = 'testrail_kpis'
os.environ['TESTRAIL_URL'] = 'https://segurossurapa.testrail.io'
os.environ['TESTRAIL_USER'] = 'gestioncalidad01@sura.com.pa'
os.environ['TESTRAIL_API_KEY'] = 'Z3t4eAIotXwa/wwDUzQV-K5XVg5LenwmnveAYMNFy'

from testrail_client import TestRailClient
from bigquery_client import BigQueryClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

tr_client = TestRailClient(
    os.environ['TESTRAIL_URL'], 
    os.environ['TESTRAIL_USER'], 
    os.environ['TESTRAIL_API_KEY']
)
bq_client = BigQueryClient(os.environ['GCP_PROJECT_ID'], os.environ['BQ_DATASET'])

def sync_plan_103():
    logger.info("Fetching Plan 103 details...")
    plan = tr_client.get_plan(103)
    entries = plan.get('entries', [])
    
    run_ids = []
    for entry in entries:
        runs = entry.get('runs', [])
        for r in runs:
            run_ids.append(r['id'])
            
    logger.info(f"Found {len(run_ids)} runs in Plan 103: {run_ids}")
    
    total_tests = 0
    total_results = 0
    
    for run_id in run_ids:
        logger.info(f"Syncing tests for run {run_id}")
        try:
            tests = tr_client.get_tests(run_id)
            if tests:
                bq_client.insert_rows("raw_tests", tests)
                total_tests += len(tests)
        except Exception as e:
            logger.error(f"Failed to fetch tests for run {run_id}: {e}")
            
        logger.info(f"Syncing results for run {run_id}")
        try:
            results = tr_client.get_results(run_id)
            if results:
                for result in results:
                    custom_fields = {}
                    for key, value in result.items():
                        if key.startswith('custom_'):
                            custom_fields[key] = value
                    if custom_fields:
                        result['custom_fields'] = json.dumps(custom_fields)
                bq_client.insert_rows("raw_results", results)
                total_results += len(results)
        except Exception as e:
            logger.error(f"Failed to fetch results for run {run_id}: {e}")
            
    logger.info(f"Sync complete. Inserted {total_tests} tests and {total_results} results.")

if __name__ == "__main__":
    sync_plan_103()
