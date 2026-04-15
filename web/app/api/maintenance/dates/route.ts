
import { BigQuery } from '@google-cloud/bigquery';
import { NextRequest, NextResponse } from 'next/server';

const bigquery = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID || 'testrail-480214',
});

const AUTH_CODE = 'SuraPanama507';

export async function GET(request: NextRequest) {
    const auth = request.headers.get('x-auth-code');
    if (auth !== AUTH_CODE) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = `
        WITH active_plans AS (
            SELECT DISTINCT 
                CAST(plan_id AS STRING) as plan_id, 
                plan_name as name,
                CAST(DATE(eff_plan_start_on) AS STRING) as original_start_date
            FROM \`testrail_kpis.stg_Runs\`
            WHERE plan_id IS NOT NULL
        )
        SELECT 
            ap.plan_id, 
            ap.name,
            ap.original_start_date,
            CAST(epd.external_start_date AS STRING) as external_start_date, 
            epd.external_name 
        FROM active_plans ap
        LEFT JOIN \`testrail_kpis.external_plan_dates\` epd ON CAST(ap.plan_id AS INT64) = epd.plan_id
        ORDER BY ap.plan_id ASC
    `;

    try {
        const [rows] = await bigquery.query(query);
        return NextResponse.json({ data: rows });
    } catch (error: any) {
        console.error('BigQuery Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = request.headers.get('x-auth-code');
    if (auth !== AUTH_CODE) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { plan_id, external_start_date, external_name } = await request.json();

        if (!plan_id || !external_start_date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Use a MERGE statement to upsert
        const query = `
            MERGE \`testrail_kpis.external_plan_dates\` T
            USING (SELECT ${parseInt(plan_id)} as plan_id, DATE '${external_start_date}' as external_start_date, '${external_name || ''}' as external_name) S
            ON T.plan_id = S.plan_id
            WHEN MATCHED THEN
                UPDATE SET external_start_date = S.external_start_date, external_name = S.external_name
            WHEN NOT MATCHED THEN
                INSERT (plan_id, external_start_date, external_name) VALUES (S.plan_id, S.external_start_date, S.external_name)
        `;

        await bigquery.query(query);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('BigQuery Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const auth = request.headers.get('x-auth-code');
    if (auth !== AUTH_CODE) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const planId = searchParams.get('plan_id');

    if (!planId) {
        return NextResponse.json({ error: 'Missing plan_id' }, { status: 400 });
    }

    const query = `
        DELETE FROM \`testrail_kpis.external_plan_dates\`
        WHERE plan_id = ${parseInt(planId)}
    `;

    try {
        await bigquery.query(query);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('BigQuery Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
