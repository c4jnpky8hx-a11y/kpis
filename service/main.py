import os
import logging
from flask import Flask, request, jsonify
from sync_engine import SyncEngine

app = Flask(__name__)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

@app.route('/jobs/sync', methods=['POST'])
def trigger_sync():
    entity = request.args.get('entity')
    token = request.args.get('token')
    
    expected_token = os.environ.get('SYNC_TOKEN')
    
    # Security Check
    if expected_token and token != expected_token:
        logger.warning(f"Unauthorized sync attempt with token: {token}")
        return jsonify({"error": "Unauthorized"}), 401

    if not entity:
        return jsonify({"error": "Missing 'entity' parameter"}), 400
    
    logger.info(f"Received sync request for entity: {entity}")
    
    try:
        engine = SyncEngine()
        result = engine.run_sync(entity)
        return jsonify(result), 200
    except Exception as e:
        logger.exception(f"Sync failed for {entity}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
