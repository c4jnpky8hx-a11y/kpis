
import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';

const bigquery = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID || 'testrail-480214',
});

export async function GET(request: NextRequest) {
    try {
        // 1. Velocity (Daily Executions) - Last 30 Days
        const velocityQuery = `
            SELECT 
                FORMAT_TIMESTAMP('%Y-%m-%d', created_on) as date,
                COUNT(*) as count
            FROM \`testrail_kpis.raw_results\`
            WHERE created_on >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
            GROUP BY 1
            ORDER BY 1 ASC
        `;

        // 2. Automation Coverage
        // Assuming custom_automation_type: 0/Null=Manual, 1=Automated (Adjust legacy IDs if needed)
        // Adjust based on raw data inspection if needed. Usually 0=None, 1=Automated.
        const automationQuery = `
            SELECT 
                CASE 
                    WHEN custom_automation_type = 1 THEN 'Automatizado'
                    ELSE 'Manual' 
                END as type,
                COUNT(*) as count
            FROM \`testrail_kpis.raw_cases\`
            WHERE is_deleted = 0
            GROUP BY 1
        `;

        // 3. Defect Aging (Top 5 Oldest Open Critical/High Bugs)
        // Filtering by status NOT Done/Closed.
        const agingQuery = `
            SELECT 
                key, 
                summary, 
                priority, 
                FORMAT_TIMESTAMP('%Y-%m-%d', created) as created_date,
                DATE_DIFF(CURRENT_DATE(), DATE(created), DAY) as days_open
            FROM \`testrail_kpis.raw_jira_issues\`
            WHERE status NOT IN ('Done', 'Closed', 'Resolved')
            ORDER BY created ASC
            LIMIT 5
        `;

        const [velocityRows] = await bigquery.query(velocityQuery);
        const [automationRows] = await bigquery.query(automationQuery);
        const [agingRows] = await bigquery.query(agingQuery);

        return NextResponse.json({
            velocity: velocityRows,
            automation: automationRows,
            aging: agingRows
        });

    } catch (error: any) {
        console.error('BigQuery Insights Error:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
