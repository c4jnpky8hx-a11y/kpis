import os
import requests
import logging
from requests.auth import HTTPBasicAuth

class JiraClient:
    def __init__(self):
        self.base_url = "https://surapanama.atlassian.net"
        self.email = os.getenv('JIRA_EMAIL')
        self.token = os.getenv('JIRA_TOKEN')
        self.logger = logging.getLogger(__name__)

        if not self.email or not self.token:
            self.logger.warning("JIRA_EMAIL or JIRA_TOKEN not set. Jira sync will fail.")

    def get_issues(self, jql, next_page_token=None, max_results=50):
        """
        Fetch issues using JQL with pagination support via POST /search/jql endpoint.
        Uses nextPageToken for pagination.
        """
        url = f"{self.base_url}/rest/api/3/search/jql"
        
        # Use Basic Auth with email and token
        auth = HTTPBasicAuth(self.email, self.token)
        
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        # POST body for search/jql
        # Note: This endpoint uses 'nextPageToken' for pagination, NOT 'startAt'
        payload = {
            "jql": jql,
            "maxResults": max_results,
            "fields": ["id", "key", "summary", "status", "priority", "created", "updated", "assignee", "reporter", "resolution"]
        }
        
        if next_page_token:
            payload["nextPageToken"] = next_page_token

        try:
            response = requests.post(url, headers=headers, json=payload, auth=auth)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            self.logger.error(f"Jira API Error: {e.response.text}")
            raise
        except Exception as e:
            self.logger.error(f"Jira Connection Error: {str(e)}")
            raise

    def get_all_issues(self, jql):
        """
        Generator to fetch all issues for a given JQL query.
        """
        next_token = None
        max_results = 100
        
        while True:
            self.logger.info(f"Fetching Jira issues (token={next_token or 'initial'})...")
            data = self.get_issues(jql, next_token, max_results)
            issues = data.get('issues', [])
            
            if not issues:
                break
                
            for issue in issues:
                yield self._transform_issue(issue)
            
            next_token = data.get('nextPageToken')
            if not next_token:
                break

    def _transform_issue(self, issue):
        """
        Flatten the nested Jira issue structure for BigQuery.
        """
        fields = issue.get('fields', {})
        
        # Helper to format timestamp for BigQuery
        def format_ts(ts_str):
            if not ts_str:
                return None
            try:
                # Jira format: 2023-01-16T10:39:19.462-0500
                from datetime import datetime
                # Handle %z in python 3.7+
                dt = datetime.strptime(ts_str, "%Y-%m-%dT%H:%M:%S.%f%z")
                # Convert to UTC and remove tzinfo for BQ strictness or keep it ISO
                # BQ recommends 'YYYY-MM-DD HH:MM:SS.SSSSSS' UTC
                return dt.astimezone(datetime.utcnow().astimezone().tzinfo).strftime("%Y-%m-%d %H:%M:%S.%f")
            except Exception:
                # Fallback or return original if parsing fails (might be different format)
                return ts_str

        return {
            "id": issue.get('id'),
            "key": issue.get('key'),
            "summary": fields.get('summary'),
            "status": (fields.get('status') or {}).get('name'),
            "priority": (fields.get('priority') or {}).get('name'),
            "created": format_ts(fields.get('created')),
            "updated": format_ts(fields.get('updated')),
            "assignee": (fields.get('assignee') or {}).get('displayName'),
            "reporter": (fields.get('reporter') or {}).get('displayName'),
            "resolution": (fields.get('resolution') or {}).get('name'),
            "url": f"{self.base_url}/browse/{issue.get('key')}"
        }
