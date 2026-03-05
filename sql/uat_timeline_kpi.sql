CREATE OR REPLACE VIEW `testrail_kpis.uat_timeline_kpi` AS
WITH run_defects AS (
    -- Count historical failures and defects for each test across all its runs results
    SELECT 
        test_id,
        COUNTIF(status_id IN (4, 5)) as failed_results,
        SUM(IF(defects IS NOT NULL AND TRIM(defects) != '', 1, 0)) as results_with_defects
    FROM `testrail_kpis.raw_results`
    GROUP BY 1
),
uat_runs AS (
    -- Aggregate run-level data and identify if the UAT run is clean or had historical defects
    SELECT 
        r.run_id,
        r.run_name,
        r.month_key,
        COUNT(t.id) as total_tests,
        COUNTIF(t.status_id = 1) as passed_tests,
        SUM(COALESCE(rd.failed_results, 0)) as total_failed_history,
        SUM(COALESCE(rd.results_with_defects, 0)) as total_defects_history
    FROM `testrail_kpis.stg_Runs` r
    LEFT JOIN `testrail_kpis.dedup_tests` t ON r.run_id = t.run_id
    LEFT JOIN run_defects rd ON t.id = rd.test_id
    WHERE r.project_id = 12
    GROUP BY 1, 2, 3
)
SELECT 
    month_key,
    -- Certified Clean: 100% passed, 0 historical fails, 0 historical defects
    COUNTIF(passed_tests = total_tests AND total_tests > 0 AND total_failed_history = 0 AND total_defects_history = 0) as uat_cert_clean,
    -- Certified with Defects: 100% passed, but had historical fails or defects
    COUNTIF(passed_tests = total_tests AND total_tests > 0 AND (total_failed_history > 0 OR total_defects_history > 0)) as uat_cert_defects,
    -- In Process: not 100% passed
    COUNTIF(passed_tests < total_tests OR total_tests = 0) as uat_in_process 
FROM uat_runs
WHERE month_key IS NOT NULL
GROUP BY 1
ORDER BY 1;
