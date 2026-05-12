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

        self.bq_client = BigQueryClient(self.project_id, self.bq_dataset)

        # Ensure Jira env vars are set from Secret Manager if not already
        for secret_key in ['JIRA_EMAIL', 'JIRA_TOKEN']:
            if not os.environ.get(secret_key):
                val = self._get_secret(secret_key)
                if val:
                    os.environ[secret_key] = val

        self.jira_client = JiraClient()

        # Lazy init TestRail client (may not have secrets in all environments)
        self._tr_client = None

    @property
    def tr_client(self):
        if self._tr_client is None:
            tr_base_url = self._get_secret("testrail_url")
            tr_user = self._get_secret("testrail_user")
            tr_api_key = self._get_secret("testrail_api_key")
            if not tr_base_url:
                raise ValueError("TestRail URL not configured (secret TESTRAIL_URL not found)")
            self._tr_client = TestRailClient(tr_base_url, tr_user, tr_api_key)
        return self._tr_client

    def _get_secret(self, secret_id):
        # Try Secret Manager with both original case and uppercase
        for name_variant in [secret_id, secret_id.upper(), secret_id.lower()]:
            try:
                client = secretmanager.SecretManagerServiceClient()
                name = f"projects/{self.project_id}/secrets/{name_variant}/versions/latest"
                response = client.access_secret_version(request={"name": name})
                return response.payload.data.decode("UTF-8")
            except Exception:
                continue
        # Fallback to env vars
        return os.environ.get(secret_id.upper()) or os.environ.get(secret_id)

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
            results['suites'] = self._sync_suites()
            results['cases'] = self._sync_cases()

            # Data
            results['tests'] = self._sync_tests()
            results['results'] = self._sync_results()

            # External
            results['jira_issues'] = self.sync_jira()

            # Post-sync deduplication to keep raw tables lean
            results['dedup'] = self._dedup_raw_tables()

            return {"status": "success", "detailed_results": results}
        elif entity == "dedup":
            return self._dedup_raw_tables()
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
        """
        Sync plans for all active projects.
        Fetches BOTH active and completed plans (TestRail's get_plans defaults to active only).
        For each plan, fetches detailed view to get nested runs (entries).
        """
        projects = self.tr_client.get_projects()
        total_plans = 0
        total_runs = 0
        skipped_plans = []

        for project in projects:
            if project.get('is_completed'):
                continue
            project_id = project['id']

            # Fetch both active and completed plans
            active_plans = self.tr_client.get_plans(project_id, is_completed=0)
            completed_plans = self.tr_client.get_plans(project_id, is_completed=1)
            plans = active_plans + completed_plans

            logger.info(f"Project {project_id}: {len(active_plans)} active + {len(completed_plans)} completed plans")

            for plan in plans:
                try:
                    detailed_plan = self.tr_client.get_plan(plan['id'])
                except Exception as e:
                    logger.warning(f"Skipping plan {plan['id']}: {e}")
                    skipped_plans.append(plan['id'])
                    continue

                if not detailed_plan:
                    continue

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

        return {
            "status": "success",
            "plans_count": total_plans,
            "runs_extracted": total_runs,
            "skipped_plans": len(skipped_plans),
        }

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

    def _get_active_project_ids(self):
        """
        Returns list of active (non-completed) project IDs from raw_projects.
        Uses the most recent extraction per project.
        """
        query = f"""
            SELECT id FROM (
                SELECT id, is_completed,
                       ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) as rn
                FROM `{self.bq_dataset}.raw_projects`
            )
            WHERE rn = 1 AND is_completed = false
            ORDER BY id
        """
        return [row.id for row in self.bq_client.client.query(query)]

    def _get_runs_to_sync(self, project_id, only_active=True):
        """
        Returns run IDs to sync for a project. If only_active=True,
        skips runs marked as completed in our latest snapshot (they don't change).
        """
        completed_filter = "AND is_completed = false" if only_active else ""
        query = f"""
            SELECT id FROM (
                SELECT id, is_completed,
                       ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) as rn
                FROM `{self.bq_dataset}.raw_runs`
                WHERE project_id = {project_id}
            )
            WHERE rn = 1 {completed_filter}
        """
        return [row.id for row in self.bq_client.client.query(query)]

    def _sync_tests(self):
        active_project_ids = self._get_active_project_ids()
        total = 0
        skipped = []

        logger.info(f"Tests sync target projects: {active_project_ids}")

        for project_id in active_project_ids:
            run_ids = self._get_runs_to_sync(project_id, only_active=True)
            logger.info(f"Syncing tests for Project {project_id} ({len(run_ids)} active runs)")

            for run_id in run_ids:
                try:
                    tests = self.tr_client.get_tests(run_id)
                    if tests:
                        self.bq_client.insert_rows("raw_tests", tests)
                        total += len(tests)
                except Exception as e:
                    logger.warning(f"Skipping tests for run {run_id}: {e}")
                    skipped.append(run_id)
                    continue

        if skipped:
            logger.info(f"Skipped {len(skipped)} runs due to errors: {skipped[:10]}")
        return {"status": "success", "count": total, "skipped_runs": len(skipped), "projects_synced": len(active_project_ids)}

    def _sync_results(self):
        active_project_ids = self._get_active_project_ids()
        total = 0
        skipped = []

        logger.info(f"Results sync target projects: {active_project_ids}")

        for project_id in active_project_ids:
            run_ids = self._get_runs_to_sync(project_id, only_active=True)
            logger.info(f"Syncing results for Project {project_id} ({len(run_ids)} active runs)")

            for run_id in run_ids:
                try:
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
                except Exception as e:
                    logger.warning(f"Skipping results for run {run_id}: {e}")
                    skipped.append(run_id)
                    continue

        if skipped:
            logger.info(f"Skipped {len(skipped)} runs due to errors: {skipped[:10]}")
        return {"status": "success", "count": total, "skipped_runs": len(skipped), "projects_synced": len(active_project_ids)}

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

    def _dedup_raw_tables(self):
        """
        Post-sync deduplication: keeps only the latest snapshot per ID
        for each raw_* table. Prevents unbounded growth from streaming inserts.

        For raw_results we dedupe by (test_id, id) since multiple results per test exist.
        For raw_jira_issues we dedupe by 'key'.
        """
        dedup_specs = [
            ("raw_projects", "id"),
            ("raw_plans", "id"),
            ("raw_runs", "id"),
            ("raw_suites", "id"),
            ("raw_cases", "id"),
            ("raw_tests", "id"),
            ("raw_results", "id"),
            ("raw_milestones", "id"),
            ("raw_users", "id"),
            ("raw_jira_issues", "key"),
        ]

        results = {}
        for table, key in dedup_specs:
            try:
                query = f"""
                CREATE OR REPLACE TABLE `{self.bq_dataset}.{table}` AS
                SELECT * EXCEPT(_rn) FROM (
                    SELECT *, ROW_NUMBER() OVER(
                        PARTITION BY {key}
                        ORDER BY _extracted_at DESC
                    ) as _rn
                    FROM `{self.bq_dataset}.{table}`
                )
                WHERE _rn = 1
                """
                job = self.bq_client.client.query(query)
                job.result()
                count_q = f"SELECT COUNT(*) as cnt FROM `{self.bq_dataset}.{table}`"
                cnt = list(self.bq_client.client.query(count_q).result())[0].cnt
                results[table] = cnt
                logger.info(f"Deduped {table}: {cnt} rows remain")
            except Exception as e:
                logger.warning(f"Dedup failed for {table}: {e}")
                results[table] = f"error: {e}"

        return {"status": "success", "row_counts": results}
