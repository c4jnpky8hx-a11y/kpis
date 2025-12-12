import os
import logging
from google.cloud import secretmanager
from testrail_client import TestRailClient
from bigquery_client import BigQueryClient

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

    def _get_secret(self, secret_id):
        client = secretmanager.SecretManagerServiceClient()
        name = f"projects/{self.project_id}/secrets/{secret_id}/versions/latest"
        response = client.access_secret_version(request={"name": name})
        return response.payload.data.decode("UTF-8")

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
        else:
            raise ValueError(f"Unknown entity: {entity}")

    def _sync_projects(self):
        projects = self.tr_client.get_projects()
        # Projects don't have a watermark usually, we just get all.
        self.bq_client.insert_rows("raw_projects", projects)
        return {"status": "success", "count": len(projects)}

    def _sync_runs(self):
        # We sync runs per project or globally? 
        # get_runs can be global if project_id is not specified (depending on TR version).
        # If TR requires project_id, we need to iterate projects.
        # Assuming we iterate projects.
        
        projects = self.tr_client.get_projects()
        total_synced = 0
        
        for project in projects:
            project_id = project['id']
            # Get watermark for this project's runs
            watermark = self.bq_client.get_watermark("runs", scope_id=project_id)
            
            # Fetch runs updated after watermark
            runs = self.tr_client.get_runs(project_id=project_id, updated_after=watermark)
            
            if runs:
                self.bq_client.insert_rows("raw_runs", runs)
                
                # Update watermark
                # Find max updated_on (or created_on)
                # TR timestamps are Unix timestamps usually.
                # We need to be careful with the field name.
                # Assuming 'updated_on' exists in run object, else 'created_on'.
                
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
                # Add project_id if missing
                for s in suites:
                    s['project_id'] = project['id']
                self.bq_client.insert_rows("raw_suites", suites)
                total += len(suites)
        return {"status": "success", "count": total}

    def _sync_cases(self):
        projects = self.tr_client.get_projects()
        total = 0
        for project in projects:
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
        return {"status": "success", "count": total}

    def _sync_plans(self):
        projects = self.tr_client.get_projects()
        total_plans = 0
        total_runs = 0
        
        for project in projects:
            project_id = project['id']
            # Fetch summary plans
            plans = self.tr_client.get_plans(project_id)
            
            for plan in plans:
                # Fetch detailed plan
                detailed_plan = self.tr_client.get_plan(plan['id'])
                if detailed_plan:
                    detailed_plan['project_id'] = project_id
                    
                    # Extract custom fields
                    custom_fields = {k: v for k, v in detailed_plan.items() if k.startswith('custom_')}
                    import json
                    if custom_fields:
                        detailed_plan['custom_fields'] = json.dumps(custom_fields)
                    
                    # Serialize entries for BQ JSON column
                    if 'entries' in detailed_plan:
                        # Keep a copy of entries for run extraction before serializing
                        entries_data = detailed_plan['entries']
                        detailed_plan['entries'] = json.dumps(entries_data)
                    else:
                        entries_data = []

                    self.bq_client.insert_rows("raw_plans", [detailed_plan])
                    total_plans += 1
                    
                    # Extract runs from entries
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
                # Fetch detail to get all fields
                detail = self.tr_client.get_milestone(m['id'])
                if detail:
                    detail['project_id'] = project['id']
                    
                    # Extract custom fields
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

    def _sync_tests(self):
        # Iterate projects -> Get Run IDs from BQ -> Fetch Tests
        # This is heavy. For now, let's try to fetch for all runs.
        # Optimization: In future, only fetch for open runs or recently updated runs.
        
        projects = self.tr_client.get_projects()
        total = 0
        
        for project in projects:
            # Get run IDs from BQ to ensure we have them
            # We use a query to get run IDs for this project
            query = f"SELECT id FROM `{self.bq_dataset}.raw_runs` WHERE project_id = {project['id']}"
            query_job = self.bq_client.client.query(query)
            run_ids = [row.id for row in query_job]
            
            for run_id in run_ids:
                tests = self.tr_client.get_tests(run_id)
                if tests:
                    self.bq_client.insert_rows("raw_tests", tests)
                    total += len(tests)
        
        return {"status": "success", "count": total}

    def _sync_results(self):
        # Similar to tests, iterate runs.
        projects = self.tr_client.get_projects()
        total = 0
        
        for project in projects:
            query = f"SELECT id FROM `{self.bq_dataset}.raw_runs` WHERE project_id = {project['id']}"
            query_job = self.bq_client.client.query(query)
            run_ids = [row.id for row in query_job]
            
            for run_id in run_ids:
                results = self.tr_client.get_results(run_id)
                if results:
                    # Extract custom fields
                    for result in results:
                        custom_fields = {}
                        keys_to_remove = []
                        for key, value in result.items():
                            if key.startswith('custom_'):
                                custom_fields[key] = value
                                keys_to_remove.append(key)
                        
                        if custom_fields:
                            import json
                            result['custom_fields'] = json.dumps(custom_fields)
                        
                        # Optional: Remove extracted keys if we want to keep raw clean, 
                        # but for now we just add the JSON column.
                    
                    self.bq_client.insert_rows("raw_results", results)
                    total += len(results)
                    
        return {"status": "success", "count": total}
