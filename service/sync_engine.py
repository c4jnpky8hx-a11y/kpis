import os
import logging
from google.cloud import secretmanager
from testrail_client import TestRailClient
from bigquery_client import BigQueryClient
from jira_client import JiraClient

logger = logging.getLogger(__name__)

class SyncEngine:
    def __init__(self):
        self.project_id = os.environ.get("GCP_PROJECT_ID")
        self.bq_dataset = os.environ.get("BQ_DATASET")
        
        # Fetch secrets
        self.tr_base_url = self._get_secret("testrail_url")
        self.tr_user = self._get_secret("testrail_user")
        self.tr_api_key = self._get_secret("testrail_api_key")
        
        self.tr_client = TestRailClient(self.tr_base_url, self.tr_user, self.tr_api_key)
        self.bq_client = BigQueryClient(self.project_id, self.bq_dataset)
        self.jira_client = JiraClient()

    def _get_secret(self, secret_id):
        try:
            client = secretmanager.SecretManagerServiceClient()
            name = f"projects/{self.project_id}/secrets/{secret_id.upper()}/versions/latest"
            response = client.access_secret_version(request={"name": name})
            return response.payload.data.decode("UTF-8")
        except Exception:
            # Fallback to env vars (local dev or if auth fails)
            return os.environ.get(secret_id.upper())

    def run_sync(self, entity):
        logger.info(f"Starting sync for {entity}")
        
        if entity == "projects":
            return self._sync_projects()
        elif entity == "runs":
            return self._sync_runs()
        elif entity == "plans":
            return self._sync_plans()
        elif entity == "suites":
            return self._sync_suites()
        elif entity == "cases":
            return self._sync_cases()
        elif entity == "tests":
            return self._sync_tests()
        elif entity == "results":
            return self._sync_results()
        elif entity == "milestones":
            return self._sync_milestones()
        elif entity == "statuses":
            return self._sync_statuses()
        elif entity == "jira_issues":
            return self.sync_jira()
        elif entity == "users":
            return self._sync_users()
        elif entity == "all":
            results = {}
            # Metadata
            results['projects'] = self._sync_projects()
            results['users'] = self._sync_users()
            results['statuses'] = self._sync_statuses()
            results['milestones'] = self._sync_milestones()
            
            # Structure
            results['plans'] = self._sync_plans()
            results['runs'] = self._sync_runs()
            # specific order might matter if dependencies exist, but raw tables are independent mostly
            results['suites'] = self._sync_suites()
            results['cases'] = self._sync_cases()
            
            # Data
            results['tests'] = self._sync_tests()
            results['results'] = self._sync_results()
            
            # External
            results['jira_issues'] = self.sync_jira()
            
            return {"status": "success", "detailed_results": results}
        else:
            raise ValueError(f"Unknown entity: {entity}")

    def _sync_projects(self):
        projects = self.tr_client.get_projects()
        self.bq_client.insert_rows("raw_projects", projects)
        return {"status": "success", "count": len(projects)}

    def _sync_runs(self):
        projects = self.tr_client.get_projects()
        total_synced = 0
        
        for project in projects:
            project_id = project['id']
            watermark = self.bq_client.get_watermark("runs", scope_id=project_id)
            runs = self.tr_client.get_runs(project_id=project_id, updated_after=watermark)
            
            if runs:
                self.bq_client.insert_rows("raw_runs", runs)
                max_ts = watermark
                for run in runs:
                    ts = run.get('updated_on', run.get('created_on'))
                    if ts and ts > max_ts:
                        max_ts = ts
                
                self.bq_client.update_watermark("runs", max_ts, scope_id=project_id)
                total_synced += len(runs)
                
        return {"status": "success", "count": total_synced}

    def _sync_suites(self):
        projects = self.tr_client.get_projects()
        total = 0
        for project in projects:
            suites = self.tr_client.get_suites(project['id'])
            if suites:
                for s in suites:
                    s['project_id'] = project['id']
                self.bq_client.insert_rows("raw_suites", suites)
                total += len(suites)
        return {"status": "success", "count": total}

    def _sync_cases(self):
        projects = self.tr_client.get_projects()
        total = 0
        for project in projects:
            try:
                # Check suite mode
                # 1: Single Suite, 2: Single Suite + Baselines, 3: Multiple Suites
                suite_mode = project.get('suite_mode', 1)
                
                if suite_mode == 3:
                    suites = self.tr_client.get_suites(project['id'])
                    if suites:
                        for suite in suites:
                            cases = self.tr_client.get_cases(project['id'], suite_id=suite['id'])
                            if cases:
                                for c in cases:
                                    c['project_id'] = project['id']
                                    c['suite_id'] = suite['id']
                                self.bq_client.insert_rows("raw_cases", cases)
                                total += len(cases)
                else:
                    cases = self.tr_client.get_cases(project['id'])
                    if cases:
                        for c in cases:
                            c['project_id'] = project['id']
                        self.bq_client.insert_rows("raw_cases", cases)
                        total += len(cases)
            except Exception as e:
                logger.error(f"Failed to sync cases for project {project['id']}: {e}")
                continue
        return {"status": "success", "count": total}

    def _sync_plans(self):
        projects = self.tr_client.get_projects()
        total_plans = 0
        total_runs = 0
        
        for project in projects:
            project_id = project['id']
            plans = self.tr_client.get_plans(project_id)
            
            for plan in plans:
                detailed_plan = self.tr_client.get_plan(plan['id'])
                if detailed_plan:
                    detailed_plan['project_id'] = project_id
                    custom_fields = {k: v for k, v in detailed_plan.items() if k.startswith('custom_')}
                    import json
                    if custom_fields:
                        detailed_plan['custom_fields'] = json.dumps(custom_fields)
                    
                    if 'entries' in detailed_plan:
                        entries_data = detailed_plan['entries']
                        detailed_plan['entries'] = json.dumps(entries_data)
                    else:
                        entries_data = []

                    self.bq_client.insert_rows("raw_plans", [detailed_plan])
                    total_plans += 1
                    
                    if entries_data:
                        extracted_runs = []
                        for entry in entries_data:
                            if 'runs' in entry:
                                for run in entry['runs']:
                                    run['plan_id'] = detailed_plan['id']
                                    run['project_id'] = project_id
                                    extracted_runs.append(run)
                        
                        if extracted_runs:
                            self.bq_client.insert_rows("raw_runs", extracted_runs)
                            total_runs += len(extracted_runs)
                            
        return {"status": "success", "plans_count": total_plans, "runs_extracted": total_runs}

    def _sync_milestones(self):
        projects = self.tr_client.get_projects()
        total = 0
        for project in projects:
            milestones = self.tr_client.get_milestones(project['id'])
            detailed_milestones = []
            for m in milestones:
                detail = self.tr_client.get_milestone(m['id'])
                if detail:
                    detail['project_id'] = project['id']
                    custom_fields = {k: v for k, v in detail.items() if k.startswith('custom_')}
                    import json
                    if custom_fields:
                        detail['custom_fields'] = json.dumps(custom_fields)
                    detailed_milestones.append(detail)
            
            if detailed_milestones:
                self.bq_client.insert_rows("raw_milestones", detailed_milestones)
                total += len(detailed_milestones)
        return {"status": "success", "count": total}

    def _sync_statuses(self):
        statuses = self.tr_client.get_statuses()
        if statuses:
            self.bq_client.insert_rows("raw_statuses", statuses)
        return {"status": "success", "count": len(statuses)}

    def _sync_users(self):
        users = self.tr_client.get_users()
        if users:
            self.bq_client.insert_rows("raw_users", users)
        return {"status": "success", "count": len(users)}

    def _sync_tests(self):
        # Optimized to only sync tests for Project 23 to avoid timeouts
        projects = self.tr_client.get_projects()
        total = 0
        
        for project in projects:
            # Temporary Fix: Limit to Project 23 (Verification) and 12 (Production)
            if project['id'] not in [12, 23, 4, 8]:
                continue

            query = f"SELECT id FROM `{self.bq_dataset}.raw_runs` WHERE project_id = {project['id']}"
            query_job = self.bq_client.client.query(query)
            run_ids = [row.id for row in query_job]
            
            logger.info(f"Syncing tests for Project {project['id']} ({len(run_ids)} runs)")
            
            for run_id in run_ids:
                tests = self.tr_client.get_tests(run_id)
                if tests:
                    self.bq_client.insert_rows("raw_tests", tests)
                    total += len(tests)
        
        return {"status": "success", "count": total}

    def _sync_results(self):
        projects = self.tr_client.get_projects()
        total = 0
        
        for project in projects:
            # Temporary Fix: Limit to Project 23 (Verification) and 12 (Production)
            if project['id'] not in [12, 23, 4, 8]:
                continue

            query = f"SELECT id FROM `{self.bq_dataset}.raw_runs` WHERE project_id = {project['id']}"
            query_job = self.bq_client.client.query(query)
            run_ids = [row.id for row in query_job]
            
            for run_id in run_ids:
                results = self.tr_client.get_results(run_id)
                if results:
                    for result in results:
                        custom_fields = {}
                        for key, value in result.items():
                            if key.startswith('custom_'):
                                custom_fields[key] = value
                        
                        if custom_fields:
                            import json
                            result['custom_fields'] = json.dumps(custom_fields)
                    
                    self.bq_client.insert_rows("raw_results", results)
                    total += len(results)
                    
        return {"status": "success", "count": total}

    def sync_jira(self):
        """
        Sync Jira issues for Project CM.
        """
        jql = "project = CM ORDER BY updated DESC"
        batch_size = 100
        batch = []
        total_synced = 0
        
        logger.info("Starting Jira sync...")
        
        try:
            for issue in self.jira_client.get_all_issues(jql):
                batch.append(issue)
                
                if len(batch) >= batch_size:
                    self.bq_client.insert_rows('raw_jira_issues', batch)
                    total_synced += len(batch)
                    batch = []
                    logger.info(f"Synced {total_synced} Jira issues so far...")
            
            # Insert remaining
            if batch:
                self.bq_client.insert_rows('raw_jira_issues', batch)
                total_synced += len(batch)
                
            logger.info(f"Jira sync complete. Total issues: {total_synced}")
            return {"status": "success", "count": total_synced}
            
        except Exception as e:
            logger.error(f"Jira sync failed: {e}")
            return {"status": "error", "error": str(e)}
