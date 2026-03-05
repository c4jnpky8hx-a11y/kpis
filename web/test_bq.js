const { BigQuery } = require('@google-cloud/bigquery');
const bq = new BigQuery({ projectId: 'testrail-480214' });
async function run() {
    const [rows1] = await bq.query(`
        SELECT plan_id, Iniciativa, project_name, total_tests, total_passed, Estado_Iniciativa, is_certified, is_in_process
        FROM testrail_kpis.dashboard_mart
        WHERE project_id = 8
        ORDER BY plan_id DESC
    `);
    console.log("Sura Digital P8 plans:", JSON.stringify(rows1, null, 2));

    // Summary counts
    const [rows2] = await bq.query(`
        SELECT
          SUM(is_certified) as total_certified,
          SUM(is_in_process) as total_in_process
        FROM testrail_kpis.dashboard_mart
        WHERE project_id = 8
    `);
    console.log("Sura Digital counts:", JSON.stringify(rows2, null, 2));
}
run();
