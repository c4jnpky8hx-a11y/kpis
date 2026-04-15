
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
import InsuranceCoverageChart from './InsuranceCoverageChart';
import CycleDefectsChart from './CycleDefectsChart';
import DefectDetailTable from './DefectDetailTable';
import CycleDetailBreakdown from './CycleDetailBreakdown';
import { FullDashboardSkeleton } from './SkeletonLoaders';
import { useToast } from './Toast';
import { LayoutGrid, Database, Calendar, Layers, ChevronDown, AlertTriangle, Clock, EyeOff, Eye, BarChart3, Table2, Settings, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import HelpModal from './HelpModal';
import MaintenanceModal from './MaintenanceModal';

type DashboardType = 'mart' | 'pruebas';
type DrillDown = 'backlog' | 'completed' | 'process' | 'defects' | null;
type ChartTab = 'timeline' | 'desglose' | 'calidad' | 'retrasos' | 'defectos' | 'cobertura';
type TableTab = 'ciclos_detalle' | 'defectos_audit' | 'defectos_detalle' | 'resumen' | 'carga' | 'demanda';

export default function DashboardView() {
    const [activeTab, setActiveTab] = useState<DashboardType>('mart');
    const [mounted, setMounted] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any[]>([]);
    const [jiraData, setJiraData] = useState<any[]>([]);
    const [uatTimelineData, setUatTimelineData] = useState<any[]>([]);
    const [runsData, setRunsData] = useState<any[]>([]);
    const [insights, setInsights] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [dataHash, setDataHash] = useState<string>('');

    const [selectedYear, setSelectedYear] = useState<string>('All');
    const [selectedMonth, setSelectedMonth] = useState<string>('All');
    const [selectedProject, setSelectedProject] = useState<string>('All');
    const [excludedProjects, setExcludedProjects] = useState<Set<string>>(new Set());
    const [showExcludePanel, setShowExcludePanel] = useState(false);
    const [drillDown, setDrillDown] = useState<DrillDown>(null);
    const [chartTab, setChartTab] = useState<ChartTab>('desglose');
    const [tableTab, setTableTab] = useState<TableTab>('ciclos_detalle');

    const { addToast } = useToast();

    const toggleDrillDown = (key: DrillDown) => {
        setDrillDown(prev => prev === key ? null : key);
    };

    // Load excluded projects from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('excludedProjects');
            if (saved) setExcludedProjects(new Set(JSON.parse(saved)));
        } catch { /* ignore */ }
    }, []);

    const toggleExcludeProject = (projectId: string) => {
        setExcludedProjects(prev => {
            const next = new Set(prev);
            if (next.has(projectId)) next.delete(projectId);
            else next.add(projectId);
            localStorage.setItem('excludedProjects', JSON.stringify([...next]));
            return next;
        });
    };

    const fetchData = async (isManualRefresh = false) => {
        if (isManualRefresh) setRefreshing(true);
        else setLoading(true);
        const errors: string[] = [];

        const safeFetch = async (url: string, label: string) => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.json();
            } catch {
                errors.push(label);
                return null;
            }
        };

        const [json, insightsJson, summaryJson, jiraJson, uatJson, runsJson] = await Promise.all([
            safeFetch(`/api/data?type=${activeTab}`, 'Datos principales'),
            safeFetch('/api/insights', 'Insights'),
            safeFetch('/api/projects/summary', 'Resumen proyectos'),
            safeFetch('/api/data?type=unlinked', 'Defectos Jira'),
            safeFetch('/api/data?type=uat_timeline', 'Timeline UAT'),
            safeFetch(`/api/data?type=runs`, 'Runs'),
        ]);

        // Build a simple hash to detect changes
        const newHash = JSON.stringify({
            rows: json?.data?.length || 0,
            jira: jiraJson?.data?.length || 0,
            runs: runsJson?.data?.length || 0,
            uat: uatJson?.data?.length || 0,
        });

        if (json?.data) setData(json.data);
        if (insightsJson) setInsights(insightsJson);
        if (summaryJson?.data) setSummary(summaryJson.data);
        if (jiraJson?.data) setJiraData(jiraJson.data);
        if (uatJson?.data) setUatTimelineData(uatJson.data);
        if (runsJson?.data) setRunsData(runsJson.data);

        if (errors.length > 0) {
            addToast(`Error cargando: ${errors.join(', ')}`, 'error');
        } else if (isManualRefresh) {
            const hasChanges = dataHash !== '' && dataHash !== newHash;
            const planCount = json?.data?.length || 0;
            const defectCount = jiraJson?.data?.length || 0;
            if (hasChanges) {
                addToast(`Datos actualizados — ${planCount} planes, ${defectCount} defectos (cambios detectados)`, 'success');
            } else {
                addToast(`Datos recargados — ${planCount} planes, ${defectCount} defectos (sin cambios)`, 'info');
            }
        }

        setDataHash(newHash);
        setLoading(false);
        setRefreshing(false);
        setLastUpdated(new Date());
    };

    useEffect(() => {
        setMounted(true);
        fetchData();
    }, [activeTab]);

    const years = useMemo(() => {
        const uniqueYears = new Set<string>();
        data.forEach(d => { if (d.month_key) uniqueYears.add(d.month_key.split('-')[0]); });
        return Array.from(uniqueYears).sort().reverse();
    }, [data]);

    const months = useMemo(() => Array.from(new Set(data.map(d => d.month_key))).filter(Boolean).sort(), [data]);
    const projects = useMemo(() => {
        const uniqueProjects = new Map();
        data.forEach(d => { if (d.project_id && d.project_name) uniqueProjects.set(d.project_id, d.project_name); });
        return Array.from(uniqueProjects.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => Number(a.id) - Number(b.id));
    }, [data]);

    const filteredData = useMemo(() => {
        let result = data.filter(d => {
            if (excludedProjects.has(String(d.project_id))) return false;
            if (selectedYear !== 'All' && d.month_key && !d.month_key.startsWith(selectedYear)) return false;
            if (selectedMonth !== 'All' && d.month_key !== selectedMonth) return false;
            if (selectedProject !== 'All' && String(d.project_id) !== selectedProject) return false;
            return true;
        });
        if (drillDown === 'backlog') result = result.filter(d => d.is_backlog === 1);
        else if (drillDown === 'completed') result = result.filter(d => d.is_certified === 1);
        else if (drillDown === 'process') result = result.filter(d => d.is_in_process === 1);
        return result;
    }, [data, selectedYear, selectedMonth, selectedProject, excludedProjects, drillDown]);

    const filteredRuns = useMemo(() => {
        return runsData.filter(d => {
            if (excludedProjects.has(String(d.project_id))) return false;
            if (selectedYear !== 'All' && d.month_key && !d.month_key.startsWith(selectedYear)) return false;
            if (selectedMonth !== 'All' && d.month_key !== selectedMonth) return false;
            if (selectedProject !== 'All' && String(d.project_id) !== selectedProject) return false;
            return true;
        });
    }, [runsData, selectedYear, selectedMonth, selectedProject, excludedProjects]);

    const filteredJiraData = useMemo(() => {
        const CLOSED = ['Terminado', 'Cerrado', 'Cancelado', 'Mitigado', 'Done', 'Closed', 'Resolved'];
        const excludedNames = new Set(
            projects.filter(p => excludedProjects.has(String(p.id))).map(p => p.name)
        );
        return jiraData.filter(d => {
            if (d.issue_type && d.issue_type !== 'Defecto_TestRail') return false;
            if (CLOSED.includes(d.status)) return false;
            if (excludedNames.size > 0 && d.linked_projects) {
                const linkedList = d.linked_projects.split(',').map((s: string) => s.trim());
                if (linkedList.every((name: string) => excludedNames.has(name))) return false;
            }
            if (selectedProject !== 'All') {
                const projectEntry = projects.find(p => String(p.id) === selectedProject);
                if (projectEntry && d.linked_projects) {
                    if (!d.linked_projects.includes(projectEntry.name)) return false;
                } else if (projectEntry && !d.linked_projects) {
                    return true;
                }
            }
            return true;
        });
    }, [jiraData, selectedProject, projects, excludedProjects]);

    const kpis = useMemo(() => {
        if (!filteredData.length) return null;
        const reduceSum = (key: string) => filteredData.reduce((acc, row) => acc + (Number(row[key]) || 0), 0);
        const countIf = (predicate: (row: any) => boolean) => filteredData.filter(predicate).length;
        const allDefectoTR = jiraData.filter(d => !d.issue_type || d.issue_type === 'Defecto_TestRail');
        const activeDefects = filteredJiraData;
        const linkedActive = activeDefects.filter(d => d.is_linked).length;
        const unlinkedActive = activeDefects.filter(d => !d.is_linked).length;
        return {
            total_runs: reduceSum('total_runs'),
            total_passed: reduceSum('total_passed'),
            total_defects: allDefectoTR.length,
            active_defects: activeDefects.length,
            linked_defects: linkedActive,
            unlinked_defects: unlinkedActive,
            uat_certified: reduceSum('Soluciones_Certificadas_UAT'),
            uat_returned: reduceSum('Soluciones_Devueltas_UAT'),
            uat_in_process: reduceSum('Soluciones_En_Proceso_UAT'),
            certified_plans: countIf(d => d.is_certified === 1),
            process_plans: countIf(d => d.is_in_process === 1),
            backlog_plans: countIf(d => d.is_backlog === 1),
        };
    }, [filteredData, jiraData, filteredJiraData]);

    const filteredSummary = useMemo(() => {
        return summary.filter(d => !excludedProjects.has(String(d.project_id)));
    }, [summary, excludedProjects]);

    const filteredUatTimeline = useMemo(() => {
        return uatTimelineData.filter(d => {
            if (excludedProjects.has(String(d.project_id))) return false;
            if (selectedYear !== 'All' && d.month_key && !d.month_key.startsWith(selectedYear)) return false;
            if (selectedMonth !== 'All' && d.month_key !== selectedMonth) return false;
            return true;
        });
    }, [uatTimelineData, excludedProjects, selectedYear, selectedMonth]);

    // --- Sub-tab button helper ---
    const TabButton = ({ label, value, current, onClick }: { label: string; value: string; current: string; onClick: () => void }) => (
        <button onClick={onClick}
            className="px-3 py-1.5 text-[11px] font-medium uppercase rounded-md transition-all"
            style={current === value ? {
                background: 'var(--sura-blue)', color: '#ffffff', boxShadow: '0 1px 4px rgba(45,109,246,0.3)'
            } : { color: 'var(--text-secondary)' }}>
            {label}
        </button>
    );

    return (
        <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-6">

            {/* ═══ HEADER ═══ */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center pb-5"
                style={{ borderBottom: '2px solid var(--sura-blue)' }}>
                <div>
                    <div className="inline-flex items-center px-2.5 py-0.5 mb-2 rounded-sm text-[10px] font-bold uppercase tracking-widest border"
                        style={{ borderColor: 'var(--sura-blue)', color: 'var(--sura-blue)' }}>
                        Seguros · QA
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--sura-blue-dark)' }}>
                        Tablero de Control, KPIS QA SURA
                    </h1>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Aseguramiento de Calidad — Dashboard Operativo
                    </p>
                </div>
                <div className="flex items-center gap-3 mt-4 md:mt-0">
                    <div className="flex border rounded-lg p-1 gap-1"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                        {(['mart', 'pruebas'] as const).map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className="px-4 py-1.5 text-xs font-medium uppercase transition-all rounded-md flex items-center gap-2"
                                style={activeTab === tab ? { background: 'var(--sura-blue)', color: '#ffffff', boxShadow: '0 1px 4px rgba(45,109,246,0.3)' } : { color: 'var(--text-secondary)' }}>
                                {tab === 'mart' ? <LayoutGrid size={12} /> : <Database size={12} />}
                                Tablero {tab}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <MaintenanceModal />
                        <HelpModal />
                    </div>
                </div>
            </header>

            {/* ═══ CONTROL BAR ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-9 flex flex-wrap gap-3">
                    {[
                        { icon: <Calendar size={14} style={{ color: 'var(--sura-blue)' }} />, minW: 'min-w-[150px]', value: selectedYear,
                            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => { setSelectedYear(e.target.value); setSelectedMonth('All'); },
                            children: <><option value="All">Todos los Años</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</>
                        },
                        { icon: <Clock size={14} style={{ color: 'var(--sura-blue)' }} />, minW: 'min-w-[200px]', value: selectedMonth,
                            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedMonth(e.target.value),
                            children: <><option value="All">Todos los Meses</option>{months.filter(m => selectedYear === 'All' || m.startsWith(selectedYear)).map(m => <option key={m} value={m}>{m}</option>)}</>
                        },
                        { icon: <Layers size={14} style={{ color: 'var(--sura-blue)' }} />, minW: 'min-w-[300px]', value: selectedProject,
                            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedProject(e.target.value),
                            children: <><option value="All">Todos los Proyectos</option>{projects.filter(p => !excludedProjects.has(String(p.id))).map(p => <option key={p.id} value={p.id}>{p.id} - {p.name}</option>)}</>
                        }
                    ].map((filter, i) => (
                        <div key={i} className={`border rounded-lg px-3 py-2 flex items-center gap-3 ${filter.minW}`}
                            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                            {filter.icon}
                            <select className="bg-transparent text-sm outline-none w-full appearance-none" style={{ color: 'var(--text-body)' }}
                                value={filter.value} onChange={filter.onChange}>{filter.children}</select>
                            <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                        </div>
                    ))}
                    {/* Exclude projects button */}
                    <div className="relative">
                        <button onClick={() => setShowExcludePanel(!showExcludePanel)}
                            className="rounded-lg px-3 py-2 flex items-center gap-2 text-xs font-mono transition-colors"
                            style={excludedProjects.size > 0
                                ? { background: '#FEF3C7', border: '1px solid #FDE68A', color: '#D97706' }
                                : { background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }
                            } title="Excluir proyectos del tablero">
                            <EyeOff size={14} />
                            {excludedProjects.size > 0 && <span>{excludedProjects.size}</span>}
                        </button>
                        {showExcludePanel && (
                            <div className="absolute top-full mt-2 right-0 z-50 rounded-xl p-4 shadow-xl w-[320px] max-h-[400px] overflow-y-auto"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                                <div className="flex items-center justify-between mb-3 pb-2" style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <h4 className="text-xs font-mono uppercase" style={{ color: 'var(--text-secondary)' }}>Excluir Proyectos</h4>
                                    <button onClick={() => setShowExcludePanel(false)} className="text-xs" style={{ color: 'var(--text-muted)' }}>✕</button>
                                </div>
                                <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>Los proyectos excluidos no aparecerán en el tablero.</p>
                                <div className="space-y-1">
                                    {projects.map(p => {
                                        const isExcluded = excludedProjects.has(String(p.id));
                                        return (
                                            <button key={p.id} onClick={() => toggleExcludeProject(String(p.id))}
                                                className="w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono transition-all"
                                                style={isExcluded
                                                    ? { background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }
                                                    : { background: 'var(--bg-page)', color: 'var(--text-body)', border: '1px solid transparent' }
                                                }>
                                                <span className="flex items-center gap-2">
                                                    {isExcluded ? <EyeOff size={12} /> : <Eye size={12} />}
                                                    {p.id} - {p.name}
                                                </span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded"
                                                    style={isExcluded ? { background: '#FECACA', color: '#DC2626' } : { background: '#D1FAE5', color: '#059669' }}>
                                                    {isExcluded ? 'EXCLUIDO' : 'ACTIVO'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {excludedProjects.size > 0 && (
                                    <button onClick={() => { setExcludedProjects(new Set()); localStorage.removeItem('excludedProjects'); }}
                                        className="mt-3 w-full text-center text-[10px] font-mono py-1 rounded transition-colors"
                                        style={{ color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                                        RESTAURAR TODOS
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="md:col-span-3 flex items-center justify-end gap-3">
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        Actualizado: <span style={{ color: 'var(--text-secondary)' }}>{mounted ? lastUpdated.toLocaleTimeString() : '--:--:--'}</span>
                    </span>
                    <button
                        onClick={() => fetchData(true)}
                        disabled={refreshing || loading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono uppercase transition-all hover:opacity-80 disabled:opacity-50"
                        style={{ background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', color: 'var(--sura-blue)' }}
                        title="Refrescar datos del tablero"
                    >
                        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                        {refreshing ? 'Cargando...' : 'Refrescar'}
                    </button>
                </div>
            </div>

            {loading ? (
                <FullDashboardSkeleton />
            ) : (
                <div className="space-y-6">

                    {/* ═══ SECTION 1: KPIs ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <MetricCard label="Planes en Backlog" value={kpis?.backlog_plans || 0} statusColor="gray" trend="neutral"
                            active={drillDown === 'backlog'} onClick={() => toggleDrillDown('backlog')} />
                        <MetricCard label="Planes Completados" value={kpis?.certified_plans || 0} statusColor="green" trend="up"
                            active={drillDown === 'completed'} onClick={() => toggleDrillDown('completed')} />
                        <MetricCard label="Planes en Proceso" value={kpis?.process_plans || 0} statusColor="blue" trend="neutral"
                            active={drillDown === 'process'} onClick={() => toggleDrillDown('process')} />
                        <MetricCard label="Defectos Vinculados" value={kpis?.linked_defects || 0}
                            statusColor={(kpis?.linked_defects || 0) > 0 ? 'red' : 'gray'}
                            trend={(kpis?.linked_defects || 0) > 0 ? 'down' : 'neutral'}
                            subValue={`Activos: ${kpis?.active_defects ?? 0} · Sin vincular: ${kpis?.unlinked_defects ?? 0} · Total TR: ${kpis?.total_defects ?? 0}`}
                            active={drillDown === 'defects'} onClick={() => toggleDrillDown('defects')} />
                        <MetricCard label="Ciclos Ejecutados" value={kpis?.total_runs || 0} statusColor="gray" />
                    </div>

                    {/* Drill-down indicator */}
                    {drillDown && (
                        <div className="flex items-center gap-3 px-4 py-2 rounded-lg"
                            style={{ background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' }}>
                            <span className="text-xs font-mono" style={{ color: 'var(--sura-blue)' }}>
                                FILTRO ACTIVO: {drillDown === 'backlog' ? 'Planes en Backlog' : drillDown === 'completed' ? 'Planes Completados' : drillDown === 'process' ? 'Planes en Proceso' : 'Defectos Activos'}
                            </span>
                            <button onClick={() => setDrillDown(null)}
                                className="text-[10px] font-mono px-2 py-0.5 rounded transition-colors"
                                style={{ color: 'var(--sura-blue)', border: '1px solid var(--border-blue)' }}>
                                LIMPIAR
                            </button>
                        </div>
                    )}

                    {/* ═══ SECTION 2: SEGUIMIENTO (Charts with sub-tabs) ═══ */}
                    {activeTab === 'mart' && (
                        <section className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                            <div className="px-6 py-3 flex items-center justify-between" style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                                <div className="flex items-center gap-2">
                                    <BarChart3 size={16} style={{ color: 'var(--sura-blue)' }} />
                                    <h2 className="text-sm font-semibold uppercase" style={{ color: 'var(--sura-blue-dark)', letterSpacing: '0.05em' }}>Seguimiento</h2>
                                </div>
                                <div className="flex gap-1 border rounded-lg p-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                                    <TabButton label="Timeline" value="timeline" current={chartTab} onClick={() => setChartTab('timeline')} />
                                    <TabButton label="Desglose" value="desglose" current={chartTab} onClick={() => setChartTab('desglose')} />
                                    <TabButton label="Calidad" value="calidad" current={chartTab} onClick={() => setChartTab('calidad')} />
                                    <TabButton label="Retrasos" value="retrasos" current={chartTab} onClick={() => setChartTab('retrasos')} />
                                    <TabButton label="Defectos" value="defectos" current={chartTab} onClick={() => setChartTab('defectos')} />
                                    <TabButton label="Cobertura" value="cobertura" current={chartTab} onClick={() => setChartTab('cobertura')} />
                                </div>
                            </div>
                            <div className="p-6">
                                {chartTab === 'timeline' && <UatTimelineChart data={filteredUatTimeline} />}

                                {chartTab === 'desglose' && (
                                    <div className="grid grid-cols-12 gap-6">
                                        <div className="col-span-12 lg:col-span-8">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Desglose de Ejecución de Pruebas</h3>
                                                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: 'var(--sura-blue)', background: 'var(--bg-blue-tint)' }}>Por Ciclo</span>
                                            </div>
                                            <StatusPieChart data={filteredData} />
                                            {(() => {
                                                const reduceSum = (key: string) => filteredData.reduce((acc: number, row: Record<string, unknown>) => acc + (Number(row[key]) || 0), 0);
                                                const certified = reduceSum('runs_passed');
                                                const failed = reduceSum('runs_failed');
                                                const blocked = reduceSum('runs_blocked');
                                                const inProgress = reduceSum('runs_in_progress');
                                                const untested = reduceSum('runs_untested');
                                                const backlog = reduceSum('runs_backlog');
                                                const pending = reduceSum('runs_pending');
                                                const totalAll = certified + failed + blocked + inProgress + untested + backlog + pending;
                                                const pct = (v: number) => totalAll > 0 ? ((v / totalAll) * 100).toFixed(1) : '0.0';
                                                const items = [
                                                    { label: 'Certificados', value: certified, color: '#10B981', icon: '✓' },
                                                    { label: 'Fallados', value: failed, color: '#F43F5E', icon: '✗' },
                                                    { label: 'Bloqueados', value: blocked, color: '#F59E0B', icon: '⊘' },
                                                    { label: 'En Progreso', value: inProgress, color: '#8B5CF6', icon: '◉' },
                                                    { label: 'Pendientes', value: pending, color: '#FB923C', icon: '⚠' },
                                                    { label: 'Backlog', value: backlog, color: '#94A3B8', icon: '◻' },
                                                    { label: 'Sin Probar', value: untested, color: '#374151', icon: '○' },
                                                ];
                                                return (
                                                    <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-light)' }}>
                                                        <h4 className="text-xs font-medium uppercase mb-4" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Detalle por Ciclo</h4>
                                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                                            {items.map(item => (
                                                                <div key={item.label}>
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="text-xs flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                                                            <span style={{ color: item.color }}>{item.icon}</span>{item.label}
                                                                        </span>
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                                                                            <span className="text-[10px] font-mono w-12 text-right" style={{ color: 'var(--text-muted)' }}>{pct(item.value)}%</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-gray-tint)' }}>
                                                                        <div className="h-full rounded-full transition-all duration-700"
                                                                            style={{ width: `${totalAll > 0 ? (item.value / totalAll) * 100 : 0}%`, backgroundColor: item.color }} />
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
                                        <div className="col-span-12 lg:col-span-4 space-y-6">
                                            <div className="rounded-xl p-5" style={{ background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' }}>
                                                <h3 className="text-xs font-semibold uppercase mb-3 pb-2" style={{ color: 'var(--sura-blue)', borderBottom: '1px solid var(--border-blue)', letterSpacing: '0.08em' }}>Criterios UAT</h3>
                                                <div className="space-y-3">
                                                    {[{ l: 'Certificadas', v: kpis?.uat_certified, c: 'var(--status-green)' }, { l: 'Devueltas', v: kpis?.uat_returned, c: 'var(--status-red)' }, { l: 'En Proceso', v: kpis?.uat_in_process, c: 'var(--sura-blue)' }].map(u => (
                                                        <div key={u.l} className="flex justify-between items-center">
                                                            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{u.l}</span>
                                                            <span className="text-xl font-mono font-bold" style={{ color: u.c }}>{u.v || 0}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {chartTab === 'calidad' && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div><h3 className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Velocidad de Ejecución (30 Días)</h3><VelocityAreaChart data={insights?.velocity || []} /></div>
                                        <div><h3 className="text-xs font-semibold uppercase mb-1" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Cobertura de Automatización</h3><p className="text-[9px] font-mono mb-3" style={{ color: 'var(--text-muted)' }}>Regresión Katalon vs Smoke Test Manual</p><AutomationDonutChart data={[{ type: 'Automatizado', count: 24 }, { type: 'Manual', count: 76 }]} /></div>
                                        <div>
                                            <h3 className="text-xs font-semibold uppercase mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                                                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--status-amber)' }} /> Top Riesgos
                                            </h3>
                                            <div className="space-y-3 overflow-y-auto max-h-[260px]">
                                                {insights?.aging?.map((bug: any) => (
                                                    <div key={bug.key} className="p-3 rounded-lg" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)' }}>
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-xs font-bold font-mono" style={{ color: 'var(--sura-blue)' }}>{bug.key}</span>
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>{bug.days_open} días</span>
                                                        </div>
                                                        <p className="text-xs line-clamp-2 mb-1" style={{ color: 'var(--text-body)' }}>{bug.summary}</p>
                                                        <span className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{bug.priority}</span>
                                                    </div>
                                                ))}
                                                {(!insights?.aging || insights.aging.length === 0) && <div className="text-center py-10 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Sin riesgos detectados</div>}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {chartTab === 'retrasos' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h3 className="text-xs font-semibold uppercase mb-4 flex items-center gap-2" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                                                <Clock className="w-4 h-4" style={{ color: 'var(--sura-aqua)' }} /> Cumplimiento Entrega (Hito)
                                            </h3>
                                            <DelayBarChart data={filteredData} />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Severidad de Defectos</h3>
                                            <DefectsBarChart data={filteredJiraData} />
                                        </div>
                                    </div>
                                )}

                                {chartTab === 'defectos' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <h3 className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>Estado de Defectos</h3>
                                            <DefectsStatusChart data={filteredJiraData} />
                                        </div>
                                        <CycleDefectsChart data={filteredData} />
                                    </div>
                                )}

                                {chartTab === 'cobertura' && <InsuranceCoverageChart />}
                            </div>
                        </section>
                    )}

                    {/* Pruebas tab: show charts directly */}
                    {activeTab === 'pruebas' && (
                        <div className="grid grid-cols-12 gap-6">
                            <div className="col-span-12 lg:col-span-8 rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                                <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Desglose de Ejecución</h3>
                                <StatusPieChart data={filteredData} />
                            </div>
                            <div className="col-span-12 lg:col-span-4 space-y-6">
                                <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                                    <h3 className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--text-secondary)' }}>Severidad de Defectos</h3>
                                    <DefectsBarChart data={filteredJiraData} />
                                </div>
                                <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                                    <h3 className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--text-secondary)' }}>Estado de Defectos</h3>
                                    <DefectsStatusChart data={filteredJiraData} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ SECTION 3: TABLAS (with sub-tabs) ═══ */}
                    {activeTab === 'mart' && (
                        <section className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                            <div className="px-6 py-3 flex items-center justify-between" style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                                <div className="flex items-center gap-2">
                                    <Table2 size={16} style={{ color: 'var(--sura-blue)' }} />
                                    <h2 className="text-sm font-semibold uppercase" style={{ color: 'var(--sura-blue-dark)', letterSpacing: '0.05em' }}>Tablas</h2>
                                </div>
                                <div className="flex gap-1 border rounded-lg p-1" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-light)' }}>
                                    <TabButton label="Ciclos Detalle" value="ciclos_detalle" current={tableTab} onClick={() => setTableTab('ciclos_detalle')} />
                                    <TabButton label="Auditoría Defectos" value="defectos_audit" current={tableTab} onClick={() => setTableTab('defectos_audit')} />
                                    <TabButton label="Detalle Defectos" value="defectos_detalle" current={tableTab} onClick={() => setTableTab('defectos_detalle')} />
                                    <TabButton label="Resumen" value="resumen" current={tableTab} onClick={() => setTableTab('resumen')} />
                                    <TabButton label="Carga" value="carga" current={tableTab} onClick={() => setTableTab('carga')} />
                                    <TabButton label="Demanda" value="demanda" current={tableTab} onClick={() => setTableTab('demanda')} />
                                </div>
                            </div>
                            <div className="p-6">
                                {tableTab === 'ciclos_detalle' && <CycleDetailBreakdown data={filteredRuns} jiraData={jiraData} />}
                                {tableTab === 'defectos_audit' && <UnlinkedDefectsTable excludedProjects={excludedProjects} selectedProject={selectedProject} projects={projects} />}
                                {tableTab === 'defectos_detalle' && <DefectDetailTable />}
                                {tableTab === 'resumen' && <ProjectSummaryTable data={filteredSummary} />}
                                {tableTab === 'carga' && <WorkloadChart excludedProjects={excludedProjects} selectedProject={selectedProject} />}
                                {tableTab === 'demanda' && <ProjectDemandChart excludedProjects={excludedProjects} selectedProject={selectedProject} selectedYear={selectedYear} selectedMonth={selectedMonth} />}
                            </div>
                        </section>
                    )}

                    {/* ═══ SECTION 4: OPERATIVO ═══ */}
                    <div className="space-y-6">
                        <SyncControl />
                        {activeTab === 'mart' && <CycleDetailsCard data={filteredRuns} />}
                        <DetailedTable data={filteredData} type={activeTab} />
                    </div>
                </div>
            )}
        </div>
    );
}
