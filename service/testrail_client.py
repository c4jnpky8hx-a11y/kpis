import os
import time
import requests
import logging
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = logging.getLogger(__name__)

class TestRailClient:
    def __init__(self, base_url, user, api_key):
        self.base_url = base_url.rstrip('/') + '/index.php?/api/v2'
        self.auth = (user, api_key)
        self.headers = {'Content-Type': 'application/json'}

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=4, max=60),
        retry=retry_if_exception_type(requests.exceptions.RequestException)
    )
    def _get(self, endpoint, params=None):
        url = f"{self.base_url}/{endpoint}"
        response = requests.get(url, auth=self.auth, headers=self.headers, params=params)
        
        if response.status_code == 429:
            logger.warning("Rate limit hit. Retrying...")
            # Tenacity will handle the retry, but we could add explicit sleep here if needed
            raise requests.exceptions.RequestException("Rate limit hit")
            
        response.raise_for_status()
        return response.json()

    def get_projects(self):
        data = self._get("get_projects")
        if isinstance(data, dict) and 'projects' in data:
            return data['projects']
        return data

    def get_runs(self, project_id=None, created_after=None, updated_after=None):
        """
        Fetches runs. TestRail API supports filtering.
        Note: 'updated_after' is a timestamp.
        """
        params = {}
        if project_id:
            params['project_id'] = project_id
        if created_after:
            params['created_after'] = created_after
        if updated_after:
            params['updated_after'] = updated_after
            
        # Pagination for get_runs (if applicable, check API docs. get_runs usually returns all or has offset)
        # TestRail API v2 get_runs usually returns a list. If large, it might be paginated in newer versions.
        # Assuming standard list for now, but adding offset logic if needed.
        # Checking docs: get_runs returns a list of runs.
        
        data = self._get(f"get_runs/{project_id}" if project_id else "get_runs", params=params)
        if isinstance(data, dict) and 'runs' in data:
            return data['runs']
        return data

    def get_plans(self, project_id, created_after=None, updated_after=None):
        params = {}
        if created_after:
            params['created_after'] = created_after
        if updated_after:
            params['updated_after'] = updated_after
    def get_plans(self, project_id, created_after=None, updated_after=None):
        params = {}
        if created_after:
            params['created_after'] = created_after
        if updated_after:
            params['updated_after'] = updated_after
        data = self._get(f"get_plans/{project_id}", params=params)
        logger.info(f"get_plans response type: {type(data)}")
        if isinstance(data, dict):
            logger.info(f"get_plans keys: {data.keys()}")
            if 'plans' in data:
                return data['plans']
        return data

    def get_results(self, run_id):
        # get_results_for_run/:run_id
        # This is often paginated.
        results = []
        offset = 0
        limit = 250
        while True:
            params = {'offset': offset, 'limit': limit}
            data = self._get(f"get_results_for_run/{run_id}", params=params)
            
            # Handle wrapped response
            if isinstance(data, dict) and 'results' in data:
                data = data['results']
                
            if not data:
                break
            results.extend(data)
            if len(data) < limit:
                break
            offset += limit
        return results

    def get_milestones(self, project_id):
        data = self._get(f"get_milestones/{project_id}")
        if isinstance(data, dict) and 'milestones' in data:
            return data['milestones']
        return data

    def get_suites(self, project_id):
        data = self._get(f"get_suites/{project_id}")
        logger.info(f"get_suites response type: {type(data)}")
        if isinstance(data, dict):
            logger.info(f"get_suites keys: {data.keys()}")
            if 'suites' in data:
                return data['suites']
        return data

    def get_cases(self, project_id, suite_id=None):
        cases = []
        offset = 0
        limit = 250
        while True:
            params = {'offset': offset, 'limit': limit}
            if suite_id:
                params['suite_id'] = suite_id
            
            data = self._get(f"get_cases/{project_id}", params=params)
            
            # Handle wrapped response if any (V2 usually returns object with 'cases', 'offset', 'size', '_links' etc. for large projects)
            # Or just list? 
            # API docs: "If the project is operating in strict mode (option 'suite_mode' = 3), ... returns cases for specific suite."
            # The response struct: { "offset": 0, "limit": 250, "size": 10, "_links": ..., "cases": [...] }
            
            batch = []
            if isinstance(data, dict):
                if 'cases' in data:
                    batch = data['cases']
            elif isinstance(data, list):
                # Older API or small count might return list directly?
                # Safer to handle both.
                batch = data
            
            if not batch:
                break
                
            cases.extend(batch)
            
            if len(batch) < limit:
                break
                
            offset += limit
            
        return cases

    def get_tests(self, run_id):
        data = self._get(f"get_tests/{run_id}")
        if isinstance(data, dict) and 'tests' in data:
            return data['tests']
        return data

    def get_statuses(self):
        return self._get("get_statuses")

    def get_plan(self, plan_id):
        return self._get(f"get_plan/{plan_id}")

    def get_milestone(self, milestone_id):
        return self._get(f"get_milestone/{milestone_id}")

    def get_users(self):
        """
        Fetches all users.
        """
        # get_users returns a list of users directly
        return self._get("get_users")
