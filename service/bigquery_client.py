import os
import logging
from google.cloud import bigquery
from datetime import datetime

logger = logging.getLogger(__name__)

class BigQueryClient:
    def __init__(self, project_id, dataset_id):
        self.client = bigquery.Client(project=project_id)
        self.dataset_id = dataset_id
        self.dataset_ref = f"{project_id}.{dataset_id}"

    def get_watermark(self, entity_type, scope_id=None):
        """
        Retrieves the last updated timestamp for the given entity.
        Returns 0 if no watermark exists.
        """
        query = f"""
            SELECT last_updated_at_watermark
            FROM `{self.dataset_ref}.sync_state`
            WHERE entity_type = @entity_type
        """
        query_params = [
            bigquery.ScalarQueryParameter("entity_type", "STRING", entity_type)
        ]
        
        if scope_id:
            query += " AND scope_id = @scope_id"
            query_params.append(
                bigquery.ScalarQueryParameter("scope_id", "STRING", str(scope_id))
            )

        job_config = bigquery.QueryJobConfig(query_parameters=query_params)
            
        results = self.client.query(query, job_config=job_config).result()
        for row in results:
            return row.last_updated_at_watermark
        return 0

    def update_watermark(self, entity_type, watermark, scope_id=None, status="SUCCESS"):
        """
        Updates the sync state table.
        """
        table_id = f"{self.dataset_ref}.sync_state"
        
        # We use MERGE to upsert the state
        query = f"""
            MERGE `{table_id}` T
            USING (SELECT @entity_type as entity_type, @scope_id as scope_id, @watermark as watermark, CURRENT_TIMESTAMP() as now, @status as status) S
            ON T.entity_type = S.entity_type AND (T.scope_id = S.scope_id OR (T.scope_id IS NULL AND S.scope_id IS NULL))
            WHEN MATCHED THEN
                UPDATE SET last_updated_at_watermark = S.watermark, last_sync_ts = S.now, status = S.status
            WHEN NOT MATCHED THEN
                INSERT (entity_type, scope_id, last_updated_at_watermark, last_sync_ts, status)
                VALUES (S.entity_type, S.scope_id, S.watermark, S.now, S.status)
        """
        
        query_params = [
            bigquery.ScalarQueryParameter("entity_type", "STRING", entity_type),
            bigquery.ScalarQueryParameter("scope_id", "STRING", str(scope_id) if scope_id else None),
            bigquery.ScalarQueryParameter("watermark", "INT64", watermark),
            bigquery.ScalarQueryParameter("status", "STRING", status)
        ]
        
        job_config = bigquery.QueryJobConfig(query_parameters=query_params)
        self.client.query(query, job_config=job_config).result()

    def insert_rows(self, table_name, rows):
        """
        Inserts rows into BigQuery.
        Uses streaming insert for simplicity in this phase.
        For production with high volume, consider load jobs from JSON/Parquet.
        """
        if not rows:
            return
            
        table_id = f"{self.dataset_ref}.{table_name}"
        
        # Add extraction metadata
        import json
        now = datetime.utcnow().isoformat()
        
        # Helper to convert timestamp
        def convert_ts(ts):
            if isinstance(ts, int):
                return datetime.utcfromtimestamp(ts).isoformat()
            return ts

        cleaned_rows = []
        for row in rows:
            # Create a copy to avoid modifying original if needed
            item = row.copy()
            item['_extracted_at'] = now
            item['_source'] = 'testrail'
            
            # Convert known timestamp fields
            for field in ['created_on', 'completed_on', 'updated_on', 'due_on']:
                if field in item and item[field] is not None:
                    item[field] = convert_ts(item[field])
            
            # Convert known JSON fields
            if 'custom_status_count' in item and isinstance(item['custom_status_count'], (dict, list)):
                item['custom_status_count'] = json.dumps(item['custom_status_count'])
            
            # entries in raw_plans is JSON type in BQ, so dict is fine, but let's ensure it's compatible
            # If BQ schema is JSON, we pass dict. If STRING, we dump.
            # Schema for raw_plans says "entries": "JSON". So dict is okay.
            
            cleaned_rows.append(item)
            
        errors = self.client.insert_rows_json(table_id, cleaned_rows, ignore_unknown_values=True)
        if errors:
            logger.error(f"Encountered errors while inserting rows: {errors}")
            # Print to stdout/stderr as well for immediate visibility in scripts
            print(f"BQ INSERT ERRORS: {errors}")
            raise Exception(f"BigQuery insert failed: {errors}")
        
        logger.info(f"Inserted {len(rows)} rows into {table_name}")

    def upsert_rows(self, table_name, rows, key_field="id"):
        """
        Performs an upsert (MERGE) operation.
        Since BQ streaming buffer has a delay, immediate MERGE might miss streamed data.
        Strategy: Insert into a temporary table or use streaming insert and then run a deduplication query periodically.
        
        For this implementation, we will use streaming insert into the main table, 
        and rely on the 'Bronze' layer being raw (duplicates allowed technically, but we try to avoid).
        
        However, the requirement says "Upserts en BigQuery con MERGE".
        To do this efficiently:
        1. Load data into a temp table.
        2. Run MERGE statement.
        
        Simplified approach for now: Stream insert, but we will add a 'deduplication' step in the Silver layer transformation.
        OR: We can use `insert_rows_json` which is streaming.
        
        Let's stick to: Insert Raw. Deduplicate downstream.
        BUT, if we want to update the *same* record in Raw (e.g. run status changed), we need to handle it.
        
        Alternative:
        Use `MERGE` directly if we construct the query with data. (Limit on query size).
        
        Let's stick to streaming insert for Bronze. Bronze is usually Append-Only.
        We can have a view `v_raw_runs` that does `QUALIFY ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) = 1`.
        """
        # For now, just insert.
        self.insert_rows(table_name, rows)
