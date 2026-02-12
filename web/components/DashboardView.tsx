
'use client';

import { useState, useEffect, useMemo } from 'react';
import MetricCard from './MetricCard';
import SyncControl from './SyncControl';
import ProjectSummaryTable from './ProjectSummaryTable';
import DetailedTable from './DetailedTable';
import WorkloadChart from './WorkloadChart';
import ProjectDemandChart from './ProjectDemandChart';
import { StatusPieChart, DefectsBarChart, DefectsStatusChart, VelocityAreaChart, AutomationDonutChart } from './Charts';
import UnlinkedDefectsTable from './UnlinkedDefectsTable';
import { LayoutGrid, Database, Calendar, Layers, ChevronDown, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

type DashboardType = 'mart' | 'pruebas';

export default function DashboardView() {
    const [activeTab, setActiveTab] = useState<DashboardType>('mart');
    const [mounted, setMounted] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any[]>([]); // New State for Project Summary
    const [jiraData, setJiraData] = useState<any[]>([]); // Jira defect issues
    const [insights, setInsights] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const [selectedMonth, setSelectedMonth] = useState<string>('All');
    const [selectedProject, setSelectedProject] = useState<string>('All');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dataRes, insightsRes, summaryRes, jiraRes] = await Promise.all([
                fetch(`/api/data?type=${activeTab}`),
                fetch('/api/insights'),
                fetch('/api/projects/summary'),
                fetch('/api/data?type=unlinked')
            ]);

            const json = await dataRes.json();
            const insightsJson = await insightsRes.json();
            const summaryJson = await summaryRes.json();
            const jiraJson = await jiraRes.json();

            if (json.data) setData(json.data);
            if (insightsJson) setInsights(insightsJson);
            if (summaryJson.data) setSummary(summaryJson.data);
            if (jiraJson.data) setJiraData(jiraJson.data);
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
            setLastUpdated(new Date());
        }
    };

    useEffect(() => {
        setMounted(true);
        fetchData();
    }, [activeTab]);

    const months = useMemo(() => Array.from(new Set(data.map(d => d.month_key))).filter(Boolean).sort(), [data]);
    const projects = useMemo(() => {
        const uniqueProjects = new Map();
        data.forEach(d => {
            if (d.project_id && d.project_name) {
                uniqueProjects.set(d.project_id, d.project_name);
            }
        });
        return Array.from(uniqueProjects.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => Number(a.id) - Number(b.id));
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(d => {
            if (selectedMonth !== 'All' && d.month_key !== selectedMonth) return false;
            if (selectedProject !== 'All' && String(d.project_id) !== selectedProject) return false;
            return true;
        });
    }, [data, selectedMonth, selectedProject]);

    const kpis = useMemo(() => {
        if (!filteredData.length) return null;
        const reduceSum = (key: string) => filteredData.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
        const countIf = (predicate: (row: any) => boolean) => filteredData.filter(predicate).length;

        const closedStatuses = ['Terminado', 'Cerrado', 'Cancelado', 'Mitigado'];
        const activeJira = jiraData.filter(d => !closedStatuses.includes(d.status)).length;
        const totalJira = jiraData.length;

        return {
            total_runs: reduceSum('total_runs'),
            total_passed: reduceSum('total_passed'),
            total_defects: totalJira,
            active_defects: activeJira,
            uat_certified: reduceSum('Soluciones_Certificadas_UAT'),
            uat_returned: reduceSum('Soluciones_Devueltas_UAT'),
            uat_in_process: reduceSum('Soluciones_En_Proceso_UAT'),
            certified_plans: countIf(d => d.is_certified === 1),
            process_plans: countIf(d => d.is_in_process === 1),
        };
    }, [filteredData, jiraData]);

    return (
        <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-6">

            {/* Top Navigation / Branding */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-gray-800 pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="bg-blue-600 w-1 h-4 rounded-sm"></div>
                        <h4 className="text-gray-400 text-xs font-mono uppercase tracking-[0.2em]">Aseguramiento de Calidad</h4>
                    </div>
                    <h1 className="text-3xl text-white font-medium tracking-tight">Tablero de Control, KPIS QA SURA</h1>
                </div>

                <div className="flex bg-[#111827] border border-gray-800 p-1 rounded-lg">
                    {(['mart', 'pruebas'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={clsx(
                                "px-4 py-1.5 text-xs font-mono uppercase transition-all rounded-md flex items-center gap-2",
                                activeTab === tab
                                    ? "bg-gray-800 text-white shadow-sm border border-gray-700"
                                    : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            {tab === 'mart' ? <LayoutGrid size={12} /> : <Database size={12} />}
                            Tablero {tab}
                        </button>
                    ))}
                </div>
            </header>

            {/* Control Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-8 flex flex-wrap gap-4">
                    <div className="bg-[#111827] border border-gray-800 rounded px-3 py-2 flex items-center gap-3 min-w-[200px]">
                        <Calendar size={14} className="text-gray-500" />
                        <select
                            className="bg-transparent text-sm text-gray-200 outline-none w-full appearance-none font-mono"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                        >
                            <option value="All">Todos los Meses</option>
                            {months.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <ChevronDown size={14} className="text-gray-600" />
                    </div>
                    <div className="bg-[#111827] border border-gray-800 rounded px-3 py-2 flex items-center gap-3 min-w-[300px]">
                        <Layers size={14} className="text-gray-500" />
                        <select
                            className="bg-transparent text-sm text-gray-200 outline-none w-full appearance-none font-mono"
                            value={selectedProject}
                            onChange={e => setSelectedProject(e.target.value)}
                        >
                            <option value="All">Todos los Proyectos</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.id} - {p.name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="text-gray-600" />
                    </div>
                </div>
                <div className="md:col-span-4 text-right">
                    <span className="text-xs text-gray-600 font-mono">
                        ULTIMA ACTUALIZACION: <span className="text-gray-400">{mounted ? lastUpdated.toLocaleTimeString() : '--:--:--'}</span>
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center text-gray-600 font-mono text-xs animate-pulse">CARGANDO DATOS...</div>
            ) : (
                <div className="grid grid-cols-12 gap-6">
                    {/* KPI ROW */}
                    <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
                        <MetricCard
                            label="Planes Completados"
                            value={kpis?.certified_plans || 0}
                            statusColor="green"
                            trend="up"
                        />
                        <MetricCard
                            label="Planes en Proceso"
                            value={kpis?.process_plans || 0}
                            statusColor="blue"
                            trend="neutral"
                        />
                        <MetricCard
                            label="Defectos Activos"
                            value={kpis?.active_defects || 0}
                            subValue={`Total: ${kpis?.total_defects}`}
                            statusColor={(kpis?.active_defects || 0) > 0 ? 'red' : 'gray'}
                            trend={(kpis?.active_defects || 0) > 0 ? 'down' : 'neutral'}
                        />
                        <MetricCard
                            label="Casos Ejecutados"
                            value={kpis?.total_runs || 0}
                            statusColor="gray"
                        />
                    </div>

                    {/* Main Chart Area */}
                    <div className="col-span-12 lg:col-span-8 bg-[#111827] border border-gray-800 rounded-lg p-6 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-medium text-white tracking-wide">DESGLOSE DE EJECUCION DE PRUEBAS</h3>
                            <span className="text-xs text-gray-500 font-mono text-right">EXITOSOS VS FALLIDOS</span>
                        </div>
                        <StatusPieChart data={filteredData} />

                        {/* Status Detail Breakdown */}
                        {(() => {
                            const reduceSum = (key: string) => filteredData.reduce((acc: number, row: Record<string, unknown>) => acc + (Number(row[key]) || 0), 0);
                            const totalTests = reduceSum('total_tests');
                            const passed = reduceSum('total_passed');
                            const returned = reduceSum('total_returned_cases');
                            const blocked = reduceSum('total_blocked');
                            const untested = reduceSum('total_untested');
                            const inProcess = reduceSum('total_in_process');
                            const failed = Math.max(0, totalTests - passed - returned - blocked - untested - inProcess);
                            const totalAll = totalTests;
                            const pct = (v: number) => totalAll > 0 ? ((v / totalAll) * 100).toFixed(1) : '0.0';

                            const items = [
                                { label: 'Exitosos', value: passed, color: '#10B981', icon: '✓' },
                                { label: 'Fallidos', value: failed, color: '#F43F5E', icon: '✗' },
                                { label: 'Devueltos', value: returned, color: '#8B5CF6', icon: '↻' },
                                { label: 'Bloqueados', value: blocked, color: '#F59E0B', icon: '⊘' },
                                { label: 'En Proceso', value: inProcess, color: '#3B82F6', icon: '◉' },
                                { label: 'Sin Probar', value: untested, color: '#374151', icon: '○' },
                            ];

                            return (
                                <div className="mt-6 border-t border-gray-800 pt-6">
                                    <h4 className="text-xs font-mono uppercase text-gray-500 mb-4">Detalle por Estado</h4>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                        {items.map(item => (
                                            <div key={item.label} className="group">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-gray-400 group-hover:text-white transition-colors flex items-center gap-2">
                                                        <span style={{ color: item.color }}>{item.icon}</span>
                                                        {item.label}
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-mono font-bold text-white">{item.value}</span>
                                                        <span className="text-[10px] font-mono text-gray-500 w-12 text-right">{pct(item.value)}%</span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-700"
                                                        style={{
                                                            width: `${totalAll > 0 ? (item.value / totalAll) * 100 : 0}%`,
                                                            backgroundColor: item.color
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-gray-800/50 flex justify-between">
                                        <span className="text-[10px] font-mono uppercase text-gray-600">Total Pruebas</span>
                                        <span className="text-sm font-mono font-bold text-gray-300">{totalAll}</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Side Panel: UAT Focus */}
                    <div className="col-span-12 lg:col-span-4 space-y-6">
                        <div className="bg-[#111827]/50 border border-gray-800 rounded-lg p-6">
                            <h3 className="text-xs font-mono uppercase text-gray-500 mb-4 border-b border-gray-800 pb-2">Criterios de Calidad (UAT)</h3>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-gray-400 group-hover:text-white transition-colors">Soluciones Certificadas</span>
                                    <span className="text-xl font-mono text-emerald-400 font-bold">{kpis?.uat_certified || 0}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-gray-400 group-hover:text-white transition-colors">Soluciones Devueltas</span>
                                    <span className="text-xl font-mono text-rose-400 font-bold">{kpis?.uat_returned || 0}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-gray-400 group-hover:text-white transition-colors">En Proceso</span>
                                    <span className="text-xl font-mono text-purple-400 font-bold">{kpis?.uat_in_process || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Defect Analysis: Severity & Status */}
                        <div className="bg-[#111827] border border-gray-800 rounded-lg p-6 flex flex-col gap-6">
                            <div>
                                <h3 className="text-xs font-mono uppercase text-gray-500 mb-4">Severidad de Defectos</h3>
                                <DefectsBarChart data={jiraData} />
                            </div>
                            <div className="border-t border-gray-800 pt-6">
                                <h3 className="text-xs font-mono uppercase text-gray-500 mb-4">Estado de Defectos</h3>
                                <DefectsStatusChart data={jiraData} />
                            </div>
                        </div>
                    </div>

                    {/* ANALISIS AVANZADO ROW */}
                    <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Velocity */}
                        <div className="bg-[#111827] border border-gray-800 rounded-lg p-6">
                            <h3 className="text-xs font-mono uppercase text-gray-500 mb-4">Velocidad de Ejecucion (30 Dias)</h3>
                            <VelocityAreaChart data={insights?.velocity || []} />
                        </div>

                        {/* Automation */}
                        <div className="bg-[#111827] border border-gray-800 rounded-lg p-6">
                            <h3 className="text-xs font-mono uppercase text-gray-500 mb-1">Cobertura de Automatizacion</h3>
                            <p className="text-[9px] font-mono text-gray-600 mb-3">Regresión Katalon vs Smoke Test Manual</p>
                            <AutomationDonutChart data={[
                                { type: 'Automatizado', count: 24 },
                                { type: 'Manual', count: 76 }
                            ]} />
                        </div>

                        {/* Aging Risks */}
                        <div className="bg-[#111827] border border-gray-800 rounded-lg p-6">
                            <h3 className="text-xs font-mono uppercase text-gray-500 mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Top Riesgos (Defectos Antiguos)
                            </h3>
                            <div className="space-y-3 overflow-y-auto max-h-[220px] scrollbar-thin scrollbar-thumb-gray-700">
                                {insights?.aging?.map((bug: any) => (
                                    <div key={bug.key} className="p-3 bg-gray-900/50 rounded border border-gray-800 hover:border-gray-700 transition-colors">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-bold text-blue-400 font-mono">{bug.key}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-mono border border-rose-500/20">
                                                {bug.days_open} Dias
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-300 line-clamp-2 mb-2">{bug.summary}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                            <span className="text-[10px] text-gray-500 uppercase">{bug.priority}</span>
                                            <span className="text-[10px] text-gray-600 font-mono ml-auto">{bug.created_date}</span>
                                        </div>
                                    </div>
                                ))}
                                {(!insights?.aging || insights.aging.length === 0) && (
                                    <div className="text-center py-10 text-gray-600 text-xs font-mono">NO HAY RIESGOS DETECTADOS</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Unlinked Defects Table */}
                    {activeTab === 'mart' && (
                        <div className="col-span-12">
                            <UnlinkedDefectsTable />
                        </div>
                    )}

                    {/* Project Summary Table (Moved Here - Below Charts) */}
                    {activeTab === 'mart' && (
                        <div className="col-span-12">
                            <ProjectSummaryTable data={summary} />
                        </div>
                    )}

                    {/* Workload Chart */}
                    {activeTab === 'mart' && (
                        <div className="col-span-12">
                            <WorkloadChart />
                        </div>
                    )}

                    {/* Project Demand Over Time */}
                    {activeTab === 'mart' && (
                        <div className="col-span-12">
                            <ProjectDemandChart />
                        </div>
                    )}

                    <div className="col-span-12">
                        <SyncControl />
                    </div>

                    {/* Detailed Data Table */}
                    <div className="col-span-12">
                        <DetailedTable data={filteredData} type={activeTab} />
                    </div>
                </div>
            )}
        </div>
    );
}
