
'use client';

import { useState, useEffect, useMemo } from 'react';
import MetricCard from './MetricCard';
import SyncControl from './SyncControl';
import ProjectSummaryTable from './ProjectSummaryTable';
import DetailedTable from './DetailedTable';
import WorkloadChart from './WorkloadChart';
import ProjectDemandChart from './ProjectDemandChart';
import UatTimelineChart from './UatTimelineChart';
import CycleDetailsCard from './CycleDetailsCard';
import { StatusPieChart, DefectsBarChart, DefectsStatusChart, VelocityAreaChart, AutomationDonutChart, DelayBarChart } from './Charts';
import UnlinkedDefectsTable from './UnlinkedDefectsTable';
import { LayoutGrid, Database, Calendar, Layers, ChevronDown, AlertTriangle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import HelpModal from './HelpModal';

type DashboardType = 'mart' | 'pruebas';

export default function DashboardView() {
    const [activeTab, setActiveTab] = useState<DashboardType>('mart');
    const [mounted, setMounted] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any[]>([]); // New State for Project Summary
    const [jiraData, setJiraData] = useState<any[]>([]); // Jira defect issues
    const [uatTimelineData, setUatTimelineData] = useState<any[]>([]); // UAT Timeline
    const [runsData, setRunsData] = useState<any[]>([]); // Runs Execution Lifecycle
    const [insights, setInsights] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [selectedMonth, setSelectedMonth] = useState<string>('All');
    const [selectedProject, setSelectedProject] = useState<string>('All');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dataRes, insightsRes, summaryRes, jiraRes, uatRes, runsRes] = await Promise.all([
                fetch(`/api/data?type=${activeTab}`),
                fetch('/api/insights'),
                fetch('/api/projects/summary'),
                fetch('/api/data?type=unlinked'),
                fetch('/api/data?type=uat_timeline'),
                fetch(`/api/data?type=runs`)
            ]);

            const json = await dataRes.json();
            const insightsJson = await insightsRes.json();
            const summaryJson = await summaryRes.json();
            const jiraJson = await jiraRes.json();
            const uatJson = await uatRes.json();
            const runsJson = await runsRes.json();

            if (json.data) setData(json.data);
            if (insightsJson) setInsights(insightsJson);
            if (summaryJson.data) setSummary(summaryJson.data);
            if (jiraJson.data) setJiraData(jiraJson.data);
            if (uatJson.data) setUatTimelineData(uatJson.data);
            if (runsJson.data) setRunsData(runsJson.data);
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

    const years = useMemo(() => {
        const uniqueYears = new Set<string>();
        data.forEach(d => {
            if (d.month_key) uniqueYears.add(d.month_key.split('-')[0]);
        });
        return Array.from(uniqueYears).sort().reverse();
    }, [data]);

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
            if (selectedYear !== 'All' && d.month_key && !d.month_key.startsWith(selectedYear)) return false;
            if (selectedMonth !== 'All' && d.month_key !== selectedMonth) return false;
            if (selectedProject !== 'All' && String(d.project_id) !== selectedProject) return false;
            return true;
        });
    }, [data, selectedYear, selectedMonth, selectedProject]);

    const filteredRuns = useMemo(() => {
        return runsData.filter(d => {
            if (selectedYear !== 'All' && d.month_key && !d.month_key.startsWith(selectedYear)) return false;
            if (selectedMonth !== 'All' && d.month_key !== selectedMonth) return false;
            if (selectedProject !== 'All' && String(d.project_id) !== selectedProject) return false;
            return true;
        });
    }, [runsData, selectedYear, selectedMonth, selectedProject]);

    const filteredJiraData = useMemo(() => {
        const CLOSED = ['Terminado', 'Cerrado', 'Cancelado', 'Mitigado', 'Done', 'Closed', 'Resolved'];
        return jiraData.filter(d => {
            // Only Defecto_TestRail (or legacy rows without issue_type set)
            if (d.issue_type && d.issue_type !== 'Defecto_TestRail') return false;
            // Only active (non-closed)
            if (CLOSED.includes(d.status)) return false;
            // Project filter: use linked_projects field (comma-separated project names)
            if (selectedProject !== 'All') {
                const projectEntry = projects.find(p => String(p.id) === selectedProject);
                if (projectEntry && d.linked_projects) {
                    if (!d.linked_projects.includes(projectEntry.name)) return false;
                } else if (projectEntry && !d.linked_projects) {
                    // unlinked defects: still show when no project filter or show as unlinked
                    return true;
                }
            }
            return true;
        });
    }, [jiraData, selectedProject, projects]);

    const kpis = useMemo(() => {
        if (!filteredData.length) return null;
        const reduceSum = (key: string) => filteredData.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
        const countIf = (predicate: (row: any) => boolean) => filteredData.filter(predicate).length;

        // All Defecto_TestRail issues (active + closed) — for total count use raw jiraData
        const allDefectoTR = jiraData.filter(d => !d.issue_type || d.issue_type === 'Defecto_TestRail');
        const CLOSED = ['Terminado', 'Cerrado', 'Cancelado', 'Mitigado', 'Done', 'Closed', 'Resolved'];
        const activeDefects = filteredJiraData; // already filtered to active + Defecto_TestRail
        const linkedActive = activeDefects.filter(d => d.is_linked).length;
        const unlinkedActive = activeDefects.filter(d => !d.is_linked).length;
        const totalDefectos = allDefectoTR.length;

        return {
            total_runs: reduceSum('total_runs'),
            total_passed: reduceSum('total_passed'),
            total_defects: totalDefectos,
            active_defects: activeDefects.length,
            linked_defects: linkedActive,
            unlinked_defects: unlinkedActive,
            uat_certified: reduceSum('Soluciones_Certificadas_UAT'),
            uat_returned: reduceSum('Soluciones_Devueltas_UAT'),
            uat_in_process: reduceSum('Soluciones_En_Proceso_UAT'),
            certified_plans: countIf(d => d.is_certified === 1),
            process_plans: countIf(d => d.is_in_process === 1),
        };
    }, [filteredData, jiraData, filteredJiraData]);

    return (
        <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-6">

            {/* Top Navigation / Branding — Sura style */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-5"
                style={{ borderBottom: '2px solid var(--sura-blue)' }}>
                <div>
                    {/* SEGUROS badge — libro de marca Sura */}
                    <div className="inline-flex items-center px-2.5 py-0.5 mb-2 rounded-sm text-[10px] font-bold uppercase tracking-widest border"
                        style={{ borderColor: 'var(--sura-blue)', color: 'var(--sura-blue)' }}>
                        Seguros · QA
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight"
                        style={{ color: 'var(--sura-blue-dark)' }}>
                        Tablero de Control, KPIS QA SURA
                    </h1>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Aseguramiento de Calidad — Dashboard Operativo
                    </p>
                </div>

                {/* Tab Switcher + Help */}
                <div className="flex items-center gap-3 mt-4 md:mt-0">
                    <div className="flex border rounded-lg p-1 gap-1"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                        {(['mart', 'pruebas'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={clsx(
                                    "px-4 py-1.5 text-xs font-medium uppercase transition-all rounded-md flex items-center gap-2",
                                )}
                                style={activeTab === tab ? {
                                    background: 'var(--sura-blue)',
                                    color: '#ffffff',
                                    boxShadow: '0 1px 4px rgba(45,109,246,0.3)'
                                } : {
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                {tab === 'mart' ? <LayoutGrid size={12} /> : <Database size={12} />}
                                Tablero {tab}
                            </button>
                        ))}
                    </div>
                    <HelpModal />
                </div>
            </header>

            {/* Control Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-9 flex flex-wrap gap-3">
                    {/* Filter dropdowns — Sura light style */}
                    {[
                        {
                            icon: <Calendar size={14} style={{ color: 'var(--sura-blue)' }} />,
                            minW: 'min-w-[150px]',
                            value: selectedYear,
                            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
                                setSelectedYear(e.target.value);
                                setSelectedMonth('All');
                            },
                            children: (
                                <>
                                    <option value="All">Todos los Años</option>
                                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                                </>
                            )
                        },
                        {
                            icon: <Clock size={14} style={{ color: 'var(--sura-blue)' }} />,
                            minW: 'min-w-[200px]',
                            value: selectedMonth,
                            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(e.target.value),
                            children: (
                                <>
                                    <option value="All">Todos los Meses</option>
                                    {months.filter(m => selectedYear === 'All' || m.startsWith(selectedYear)).map(m => <option key={m} value={m}>{m}</option>)}
                                </>
                            )
                        },
                        {
                            icon: <Layers size={14} style={{ color: 'var(--sura-blue)' }} />,
                            minW: 'min-w-[300px]',
                            value: selectedProject,
                            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedProject(e.target.value),
                            children: (
                                <>
                                    <option value="All">Todos los Proyectos</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.id} - {p.name}</option>
                                    ))}
                                </>
                            )
                        }
                    ].map((filter, i) => (
                        <div key={i} className={`border rounded-lg px-3 py-2 flex items-center gap-3 ${filter.minW}`}
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                            {filter.icon}
                            <select
                                className="bg-transparent text-sm outline-none w-full appearance-none"
                                style={{ color: 'var(--text-body)' }}
                                value={filter.value}
                                onChange={filter.onChange}
                            >
                                {filter.children}
                            </select>
                            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                        </div>
                    ))}
                </div>
                <div className="md:col-span-3 text-right">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        Actualizado: <span style={{ color: 'var(--text-secondary)' }}>{mounted ? lastUpdated.toLocaleTimeString() : '--:--:--'}</span>
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center font-mono text-sm animate-pulse"
                    style={{ color: 'var(--sura-blue)' }}>
                    Cargando datos...
                </div>
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
                            statusColor={(kpis?.active_defects || 0) > 0 ? 'red' : 'gray'}
                            trend={(kpis?.active_defects || 0) > 0 ? 'down' : 'neutral'}
                            subValue={`Vinculados: ${kpis?.linked_defects ?? 0} · Sin vincular: ${kpis?.unlinked_defects ?? 0} · Total TR: ${kpis?.total_defects ?? 0}`}
                        />
                        <MetricCard
                            label="Casos Ejecutados"
                            value={kpis?.total_runs || 0}
                            statusColor="gray"
                        />
                    </div>

                    {/* UAT Verifications Timeline (Spans full width exactly below KPIs) */}
                    {activeTab === 'mart' && (
                        <div className="col-span-12">
                            <UatTimelineChart data={uatTimelineData.filter(d => {
                                if (selectedYear !== 'All' && d.month_key && !d.month_key.startsWith(selectedYear)) return false;
                                if (selectedMonth !== 'All' && d.month_key !== selectedMonth) return false;
                                return true;
                            })} />
                        </div>
                    )}


                    {/* Main Chart Area */}
                    <div className="col-span-12 lg:col-span-8 rounded-xl p-6 flex flex-col"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>Desglose de Ejecución de Pruebas</h3>
                            <span className="text-xs font-mono px-2 py-0.5 rounded"
                                style={{ color: 'var(--sura-blue)', background: 'var(--bg-blue-tint)' }}>Por Ciclo</span>
                        </div>
                        <StatusPieChart data={filteredData} />

                        {/* Cycle Status Detail Breakdown */}
                        {(() => {
                            const reduceSum = (key: string) => filteredData.reduce((acc: number, row: Record<string, unknown>) => acc + (Number(row[key]) || 0), 0);
                            // Cycle-level counts — each cycle classified by strict priority rule
                            const certified = reduceSum('runs_passed');       // all cases passed
                            const failed = reduceSum('runs_failed');       // any case failed/retest → whole cycle = Fallado
                            const blocked = reduceSum('runs_blocked');      // any blocked (no fail) → whole cycle = Bloqueado
                            const inProgress = reduceSum('runs_in_progress');  // partial pass, no fail/block
                            const untested = reduceSum('runs_untested');     // no cases run yet
                            const totalAll = certified + failed + blocked + inProgress + untested;
                            const pct = (v: number) => totalAll > 0 ? ((v / totalAll) * 100).toFixed(1) : '0.0';

                            const items = [
                                { label: 'Certificados', value: certified, color: '#10B981', icon: '✓' },
                                { label: 'Fallados', value: failed, color: '#F43F5E', icon: '✗' },
                                { label: 'Bloqueados', value: blocked, color: '#F59E0B', icon: '⊘' },
                                { label: 'En Progreso', value: inProgress, color: '#8B5CF6', icon: '◉' },
                                { label: 'Sin Probar', value: untested, color: '#374151', icon: '○' },
                            ];

                            return (
                                <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-light)' }}>
                                    <h4 className="text-xs font-medium uppercase mb-4" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Detalle por Ciclo</h4>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                        {items.map(item => (
                                            <div key={item.label} className="group">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                                        <span style={{ color: item.color }}>{item.icon}</span>
                                                        {item.label}
                                                    </span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                                                        <span className="text-[10px] font-mono w-12 text-right" style={{ color: 'var(--text-muted)' }}>{pct(item.value)}%</span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-gray-tint)' }}>
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
                                    <div className="mt-4 pt-3 flex justify-between" style={{ borderTop: '1px solid var(--border-light)' }}>
                                        <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>Total Ciclos</span>
                                        <span className="text-sm font-mono font-bold" style={{ color: 'var(--sura-blue-dark)' }}>{totalAll}</span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Side Panel: UAT Focus */}
                    <div className="col-span-12 lg:col-span-4 space-y-6">
                        <div className="rounded-xl p-6"
                            style={{ background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' }}>
                            <h3 className="text-xs font-semibold uppercase mb-4 pb-2"
                                style={{ color: 'var(--sura-blue)', borderBottom: '1px solid var(--border-blue)', letterSpacing: '0.08em' }}>
                                Criterios de Calidad (UAT)
                            </h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Soluciones Certificadas</span>
                                    <span className="text-xl font-mono font-bold" style={{ color: 'var(--status-green)' }}>{kpis?.uat_certified || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Soluciones Devueltas</span>
                                    <span className="text-xl font-mono font-bold" style={{ color: 'var(--status-red)' }}>{kpis?.uat_returned || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>En Proceso</span>
                                    <span className="text-xl font-mono font-bold" style={{ color: 'var(--sura-blue)' }}>{kpis?.uat_in_process || 0}</span>
                                </div>
                            </div>
                        </div>

                        {/* Delay Analysis */}
                        <div className="rounded-xl p-6"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                            <h3 className="text-xs font-semibold uppercase mb-4 pb-2 flex items-center gap-2"
                                style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)', letterSpacing: '0.08em' }}>
                                <Clock className="w-4 h-4" style={{ color: 'var(--sura-aqua)' }} />
                                Cumplimiento Entrega (Hito)
                            </h3>
                            <DelayBarChart data={filteredData} />
                        </div>

                        {/* Defect Analysis: Severity & Status */}
                        <div className="rounded-xl p-6 flex flex-col gap-6"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                            <div>
                                <h3 className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Severidad de Defectos</h3>
                                <DefectsBarChart data={filteredJiraData} />
                            </div>
                            <div className="pt-6" style={{ borderTop: '1px solid var(--border-light)' }}>
                                <h3 className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Estado de Defectos</h3>
                                <DefectsStatusChart data={filteredJiraData} />
                            </div>
                        </div>
                    </div>

                    {/* ANALISIS AVANZADO ROW */}
                    <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Velocity */}
                        <div className="rounded-xl p-6"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                            <h3 className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Velocidad de Ejecución (30 Días)</h3>
                            <VelocityAreaChart data={insights?.velocity || []} />
                        </div>

                        {/* Automation */}
                        <div className="rounded-xl p-6"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                            <h3 className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Cobertura de Automatización</h3>
                            <p className="text-[9px] font-mono mb-3" style={{ color: 'var(--text-muted)' }}>Regresión Katalon vs Smoke Test Manual</p>
                            <AutomationDonutChart data={[
                                { type: 'Automatizado', count: 24 },
                                { type: 'Manual', count: 76 }
                            ]} />
                        </div>

                        {/* Aging Risks */}
                        <div className="rounded-xl p-6"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                            <h3 className="text-xs font-semibold uppercase mb-4 flex items-center gap-2"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--status-amber)' }} />
                                Top Riesgos (Defectos Antiguos)
                            </h3>
                            <div className="space-y-3 overflow-y-auto max-h-[220px]">
                                {insights?.aging?.map((bug: any) => (
                                    <div key={bug.key} className="p-3 rounded-lg transition-colors"
                                        style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)' }}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-bold font-mono" style={{ color: 'var(--sura-blue)' }}>{bug.key}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                                                style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
                                                {bug.days_open} días
                                            </span>
                                        </div>
                                        <p className="text-xs line-clamp-2 mb-2" style={{ color: 'var(--text-body)' }}>{bug.summary}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--status-red)' }}></span>
                                            <span className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{bug.priority}</span>
                                            <span className="text-[10px] font-mono ml-auto" style={{ color: 'var(--text-muted)' }}>{bug.created_date}</span>
                                        </div>
                                    </div>
                                ))}
                                {(!insights?.aging || insights.aging.length === 0) && (
                                    <div className="text-center py-10 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Sin riesgos detectados</div>
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

                    {/* Cycle Details Card */}
                    {activeTab === 'mart' && (
                        <div className="col-span-12">
                            <CycleDetailsCard data={filteredRuns} />
                        </div>
                    )}

                    {/* Detailed Data Table */}
                    <div className="col-span-12">
                        <DetailedTable data={filteredData} type={activeTab} />
                    </div>
                </div>
            )}
        </div>
    );
}
