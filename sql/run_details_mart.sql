CREATE OR REPLACE VIEW `testrail_kpis.run_details_mart` AS
WITH run_stats AS (
    SELECT
        r.run_id,
        r.run_name,
        r.plan_id,
        COALESCE(r.plan_name, r.run_name) as plan_name,
        r.project_id,
        proj.name as project_name,
        r.month_key,
        r.dias_retraso_desarrollo,
        r.entrega_desarrollo_tardia,
        r.eff_plan_start_on,
        -- Fecha explícita de inicio (sin fallback a created_on) para lógica Backlog
        COALESCE(
          SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fecha_de_inicio')),
          SAFE.PARSE_TIMESTAMP('%Y-%m-%d', JSON_VALUE(p.custom_fields, '$.custom_fechainicio'))
        ) as explicit_plan_start,
        COUNT(t.id) as total_tests,
        COUNTIF(t.status_id = 1) as passed_count,
        COUNTIF(t.status_id = 2) as blocked_count,
        COUNTIF(t.status_id = 4) as retest_count,
        COUNTIF(t.status_id = 5) as failed_count,
        COUNTIF(t.status_id = 6) as process_count,
        COUNTIF(t.status_id = 3) as untested_count
    FROM `testrail_kpis.stg_Runs` r
    LEFT JOIN `testrail_kpis.dedup_tests` t ON r.run_id = t.run_id
    LEFT JOIN `testrail_kpis.dedup_plans` p ON r.plan_id = p.id
    JOIN (
      SELECT * EXCEPT(rn) FROM (
        SELECT *, ROW_NUMBER() OVER(PARTITION BY id ORDER BY _extracted_at DESC) as rn FROM `testrail_kpis.raw_projects`
      ) WHERE rn = 1
    ) proj ON r.project_id = proj.id
    WHERE
        r.project_id = 12
        OR r.project_id = 8
        OR (
            r.project_id NOT IN (7, 8, 9, 12, 17, 18, 19, 21, 23)
            AND proj.is_completed = FALSE
        )
    GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11
)
SELECT
    rs.*,
    CASE
      -- Primero: si hay fallos o retest → Fallado
      WHEN rs.failed_count > 0 OR rs.retest_count > 0 THEN 'Fallado'
      -- Segundo: si hay bloqueados → Bloqueado
      WHEN rs.blocked_count > 0 THEN 'Bloqueado'
      -- Tercero: todos los casos pasados → Certificado
      WHEN rs.total_tests > 0 AND rs.passed_count = rs.total_tests THEN 'Certificado'
      -- Cuarto: 0% ejecución (solo untested, nada ejecutado) + fecha inicio futura → Backlog
      WHEN rs.total_tests > 0
        AND rs.passed_count = 0 AND rs.failed_count = 0 AND rs.blocked_count = 0
        AND rs.retest_count = 0 AND rs.process_count = 0
        AND rs.explicit_plan_start IS NOT NULL
        AND rs.explicit_plan_start > CURRENT_TIMESTAMP() THEN 'Backlog'
      -- Quinto: 0% ejecución + fecha inicio ya pasó (o sin fecha) → Pendiente
      WHEN rs.total_tests > 0
        AND rs.passed_count = 0 AND rs.failed_count = 0 AND rs.blocked_count = 0
        AND rs.retest_count = 0 AND rs.process_count = 0
        AND (rs.explicit_plan_start IS NULL OR rs.explicit_plan_start <= CURRENT_TIMESTAMP()) THEN 'Pendiente'
      -- Sexto: tiene tests con alguna ejecución parcial → En Progreso
      WHEN rs.total_tests > 0 THEN 'En Progreso'
      -- Último: sin tests
      ELSE 'Sin Probar'
    END as run_status
FROM run_stats rs;
