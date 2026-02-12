
import os
import logging
from sync_engine import SyncEngine

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_all_syncs():
    # Set necessary environment variables if not present
    if not os.environ.get("GCP_PROJECT_ID"):
        os.environ["GCP_PROJECT_ID"] = "testrail-480214"
    
    if not os.environ.get("BQ_DATASET"):
        os.environ["BQ_DATASET"] = "testrail_kpis"
        
    logger.info(f"Using Project ID: {os.environ['GCP_PROJECT_ID']}")
    logger.info(f"Using BQ Dataset: {os.environ['BQ_DATASET']}")

    try:
        engine = SyncEngine()
    except Exception as e:
        logger.error(f"Failed to initialize SyncEngine: {e}")
        return

    entities = [
        "projects", "users", "statuses", "milestones", # Metadata
        "plans", "runs", "suites", "cases",   # Structure
        "tests", "results",                   # Data
        "jira_issues"                         # External
    ]

    for entity in entities:
        try:
            logger.info(f"----------------------------------------")
            logger.info(f"Starting sync for: {entity}")
            result = engine.run_sync(entity)
            logger.info(f"Sync result for {entity}: {result}")
        except Exception as e:
            logger.exception(f"Failed to sync {entity}")

    logger.info("All sync jobs completed.")

if __name__ == "__main__":
    run_all_syncs()
