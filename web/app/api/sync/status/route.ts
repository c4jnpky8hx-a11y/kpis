import { BigQuery } from '@google-cloud/bigquery';
import { NextResponse } from 'next/server';

const bigquery = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID || 'testrail-480214',
});

export async function GET() {
    try {
        const query = `
            SELECT entity_type, status, last_sync_ts 
            FROM \`testrail_kpis.sync_state\`
        `;
        const [rows] = await bigquery.query(query);
        return NextResponse.json({ data: rows });
    } catch (error: any) {
        console.error('Sync Status API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
