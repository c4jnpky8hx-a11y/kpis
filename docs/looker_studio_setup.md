# Configuración de Informe en Looker Studio

Lamentablemente, Looker Studio no tiene una interfaz de línea de comandos (CLI) ni API para **crear** informes automáticamente desde la consola; es una herramienta diseñada para usarse visualmente en el navegador.

Sin embargo, ya hemos preparado la tabla de datos (`testrail_kpis.fact_cycle`) con toda la lógica necesaria. Sigue estos pasos para crear tu informe manual y rápidamente:

## 1. Conectar la Fuente de Datos

1. Ve a [Looker Studio](https://lookerstudio.google.com/) y haz clic en **"Crear"** > **"Informe"**.
2. Busca el conector de **BigQuery**.
3. Selecciona tu proyecto: `testrail-480214`.
4. Selecciona el conjunto de datos: `testrail_kpis`.
5. Selecciona la tabla: `fact_cycle`.
6. Haz clic en **"Añadir"**.

## 2. Configurar los Campos

Una vez conectado, asegúrate de que los tipos de datos sean correctos:
- **Fechas**: `eff_start_date`, `eff_due_date`, `created_on`, `completed_on` deben ser tipo `Fecha`.
- **Métricas**:
  - `passed_count`, `failed_count`, `blocked_count`, `total_tests` deben ser `Número` (Suma).
  - `uat_certified` debe ser `Booleano` o número (puedes contar los `TRUE`).

## 3. Crear Visualizaciones

### KPI: Estatus General (Proyecto 17 - QA)
Para ver métricas de QA, usa los campos que ya filtramos (solo tendrán datos para el proyecto 17).
- **Gráfico**: Tarjeta de Resultados o Tabla.
- **Métrica**: `passed_count`, `failed_count`, `total_tests`.
- **Filtro**: No es necesario un filtro adicional en el gráfico porque la columna ya tiene la lógica `CASE WHEN project_id = 17` aplicada en BigQuery.

### KPI: Certificación UAT (Proyecto 23 - UAT)
- **Gráfico**: Tarjeta de Resultados.
- **Métrica**: `uat_certified` (puedes usar un conteo o porcentaje).
- **Nota**: Este campo solo será `TRUE` para el proyecto 23.

## 4. Filtros Interactivos
Añade un control de filtro para `cycle_name` o `eff_start_date` para que puedas explorar diferentes ciclos de prueba.

---
**Nota Técnica**:
Toda la lógica de negocio (separación de Proyecto 17 vs 23) ya está aplicada en la tabla. Si arrastras `passed_count` a un gráfico, automáticamente solo sumará los casos del Proyecto 17, ignorando los del 23.
