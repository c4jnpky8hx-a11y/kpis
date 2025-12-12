-- Data Quality Checks

-- 1. Check for Duplicates in Raw Runs
SELECT 'Duplicate Runs' as check_name, COUNT(*) as failures
FROM (
  SELECT id, COUNT(*) 
  FROM `testrail_kpis.raw_runs` 
  GROUP BY id 
  HAVING COUNT(*) > 1
);

-- 2. Check for Future Dates (Sanity)
SELECT 'Future Creation Dates' as check_name, COUNT(*) as failures
FROM `testrail_kpis.raw_runs`
WHERE created_on > CURRENT_TIMESTAMP();

-- 3. Check for Negative Counts
SELECT 'Negative Counts' as check_name, COUNT(*) as failures
FROM `testrail_kpis.raw_runs`
WHERE passed_count < 0 OR failed_count < 0;

-- 4. Check Fact Cycle Consistency
SELECT 'Start > End' as check_name, COUNT(*) as failures
FROM `testrail_kpis.fact_cycle`
WHERE eff_start_date > DATE(completed_on) AND is_closed = TRUE;
