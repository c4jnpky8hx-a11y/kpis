
import { BigQuery } from '@google-cloud/bigquery';
import { NextResponse } from 'next/server';

const bigquery = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID || 'testrail-480214',
});

export async function GET() {
    const query = `
    SELECT * 
    FROM \`testrail_kpis.dashboard_mart_projects\`
    ORDER BY total_cases_repo DESC
    LIMIT 1000
  `;

    try {
        const [rows] = await bigquery.query(query);
        return NextResponse.json({ data: rows });
    } catch (error: any) {
        console.error('BigQuery Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
