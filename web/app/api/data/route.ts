
import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';

const bigquery = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID || 'testrail-480214',
});

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'mart';

    // Sanitize input to prevent SQL injection (though strict type usage helps)
    const validTypes = ['mart', 'pruebas', 'workload', 'demand', 'unlinked'];
    const tableMap: Record<string, string> = {
        mart: 'dashboard_mart',
        pruebas: 'dashboard_pruebas',
        workload: 'workload_by_analyst',
        demand: 'project_analyst_demand',
        unlinked: 'jira_defects_summary',
    };
    const table = validTypes.includes(type) ? tableMap[type] : 'dashboard_mart';

    const query = `
    SELECT * 
    FROM \`testrail_kpis.${table}\`
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
