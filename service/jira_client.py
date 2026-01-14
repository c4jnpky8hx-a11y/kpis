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

    def get_issues(self, jql, start_at=0, max_results=50):
        """
        Fetch issues using JQL with pagination support.
        """
        url = f"{self.base_url}/rest/api/3/search"
        auth = HTTPBasicAuth(self.email, self.token)
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        params = {
            "jql": jql,
            "startAt": start_at,
            "maxResults": max_results,
            "fields": "id,key,summary,status,priority,created,updated,assignee"
        }

        try:
            response = requests.get(url, headers=headers, params=params, auth=auth)
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
        start_at = 0
        max_results = 50
        
        while True:
            self.logger.info(f"Fetching Jira issues starting at {start_at}...")
            data = self.get_issues(jql, start_at, max_results)
            issues = data.get('issues', [])
            
            if not issues:
                break
                
            for issue in issues:
                yield self._transform_issue(issue)
            
            start_at += len(issues)
            if start_at >= data.get('total', 0):
                break

    def _transform_issue(self, issue):
        """
        Flatten the nested Jira issue structure for BigQuery.
        """
        fields = issue.get('fields', {})
        return {
            "id": issue.get('id'),
            "key": issue.get('key'),
            "summary": fields.get('summary'),
            "status": fields.get('status', {}).get('name'),
            "priority": fields.get('priority', {}).get('name'),
            "created": fields.get('created'),
            "updated": fields.get('updated'),
            "assignee": fields.get('assignee', {}).get('displayName') if fields.get('assignee') else None,
            "url": f"{self.base_url}/browse/{issue.get('key')}"
        }
