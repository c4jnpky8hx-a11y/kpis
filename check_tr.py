import requests
import json
import base64

url = "https://segurossurapa.testrail.io/index.php?/api/v2/get_runs/12"
user = "gestioncalidad01@sura.com.pa"
tkey = "Z3t4eAIotXwa/wwDUzQV-K5XVg5LenwmnveAYMNFy"

auth = base64.b64encode(f"{user}:{tkey}".encode()).decode()
headers = {
    "Content-Type": "application/json",
    "Authorization": f"Basic {auth}"
}

print(f"Fetching runs for Project 12 from {url}...")
try:
    # First page
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    data = response.json()
    
    runs = data.get('runs', [])
    print(f"Total runs found in first request: {len(runs)}")
    
    # Just list some details
    for r in runs:
        print(f"ID:{r.get('id')} | is_completed:{r.get('is_completed')} | name:{r.get('name')}")

    # Check for more pages
    _links = data.get('_links', {})
    if _links and _links.get('next'):
        print("There are more pages of runs... (not fetching just indicating)")

except Exception as e:
    print(f"Error fetching: {e}")
