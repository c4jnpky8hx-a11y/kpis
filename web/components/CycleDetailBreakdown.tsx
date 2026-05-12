'use client';

import React, { useState, useMemo } from 'react';
import {
    Search, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon,
    PlayCircle, CheckCircle, AlertTriangle, XCircle, Clock, ExternalLink, Bug,
    ArrowUpDown, Layers, RefreshCw
} from 'lucide-react';
import CsvExportButton from './CsvExport';

const PAGE_SIZE = 20;

type SortField = 'project' | 'status' | 'total' | 'defects';
type SortDir = 'asc' | 'desc';

interface Props {
    data: any[];
    jiraData: any[];
    defectsByCycle?: any[];
}

const STATUS_ORDER: Record<string, number> = {
    'Bloqueado': 0, 'Fallado': 1, 'En Progreso': 2, 'Pendiente': 3, 'Backlog': 4, 'Certificado': 5,
};

function getStatusStyle(status: string): React.CSSProperties {
    switch (status) {
        case 'Certificado': return { background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' };
        case 'Fallado':     return { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' };
        case 'Bloqueado':   return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' };
        case 'Reprueba':    return { background: '#F3E8FF', color: '#6B21A8', border: '1px solid #D8B4FE' };
        case 'En Progreso': return { background: 'var(--bg-blue-tint)', color: 'var(--sura-blue)', border: '1px solid var(--border-blue)' };
        case 'Backlog':     return { background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' };
        case 'Pendiente':   return { background: '#FFF7ED', color: '#C2410C', border: '1px solid #FDBA74' };
        default:            return { background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' };
    }
}

function getStatusIcon(status: string) {
    switch (status) {
        case 'Certificado': return <CheckCircle className="w-3 h-3" style={{ color: '#059669' }} />;
        case 'Fallado':     return <XCircle className="w-3 h-3" style={{ color: '#DC2626' }} />;
        case 'Bloqueado':   return <AlertTriangle className="w-3 h-3" style={{ color: '#D97706' }} />;
        case 'Reprueba':    return <RefreshCw className="w-3 h-3" style={{ color: '#A855F7' }} />;
        case 'En Progreso': return <PlayCircle className="w-3 h-3" style={{ color: 'var(--sura-blue)' }} />;
        case 'Backlog':     return <Clock className="w-3 h-3" style={{ color: '#475569' }} />;
        case 'Pendiente':   return <AlertTriangle className="w-3 h-3" style={{ color: '#C2410C' }} />;
        default:            return <Clock className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />;
    }
}

function getPriorityStyle(priority: string): React.CSSProperties {
    if (priority === 'Crítica') return { background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' };
    if (priority === 'Alta') return { background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' };
    return { background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' };
}

export default function CycleDetailBreakdown({ data, jiraData, defectsByCycle }: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<SortField>('project');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [page, setPage] = useState(0);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

    // Build run_id -> defects map from per-cycle data (active_defects_by_cycle view).
    // Falls back to plan-level mapping only if defectsByCycle is unavailable.
    const runDefectsMap = useMemo(() => {
        const map: Record<string, any[]> = {};
        if (!defectsByCycle) return map;
        for (const d of defectsByCycle) {
            const key = String(d.run_id ?? '');
            if (!key) continue;
            if (!map[key]) map[key] = [];
            map[key].push(d);
        }
        return map;
    }, [defectsByCycle]);

    const planDefectsMap = useMemo(() => {
        const map: Record<string, any[]> = {};
        if (!jiraData) return map;
        for (const defect of jiraData) {
            if (!defect.linked_plans) continue;
            const plans = defect.linked_plans.split(',').map((s: string) => s.trim());
            for (const plan of plans) {
                if (!map[plan]) map[plan] = [];
                map[plan].push(defect);
            }
        }
        return map;
    }, [jiraData]);

    // Defects linked to the specific run (cycle), not the entire plan.
    const getDefectsForRun = (runId: string | number | undefined, planName?: string): any[] => {
        if (runId !== undefined && runId !== null) {
            const byRun = runDefectsMap[String(runId)];
            if (byRun) return byRun;
            // If per-cycle data has loaded but this run has none, return empty (no fallback).
            if (defectsByCycle && defectsByCycle.length > 0) return [];
        }
        // Fallback for the brief moment before defectsByCycle loads.
        return planName ? (planDefectsMap[planName] || []) : [];
    };

    // Filtered + sorted data
    const processedData = useMemo(() => {
        let filtered = (data || []).filter(run =>
            (run.run_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (run.plan_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (run.project_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
        );

        filtered = filtered.map(run => ({
            ...run,
            _defectCount: getDefectsForRun(run.run_id, run.plan_name).length,
        }));

        filtered.sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'project':
                    cmp = (a.project_name || '').localeCompare(b.project_name || '');
                    break;
                case 'status':
                    cmp = (STATUS_ORDER[a.run_status] ?? 99) - (STATUS_ORDER[b.run_status] ?? 99);
                    break;
                case 'total':
                    cmp = (Number(a.total_tests) || 0) - (Number(b.total_tests) || 0);
                    break;
                case 'defects':
                    cmp = (a._defectCount || 0) - (b._defectCount || 0);
                    break;
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });

        return filtered;
    }, [data, searchTerm, sortField, sortDir, planDefectsMap, runDefectsMap, defectsByCycle]);

    // Group by project
    const groupedByProject = useMemo(() => {
        const groups: Record<string, any[]> = {};
        for (const run of processedData) {
            const proj = run.project_name || 'Sin Proyecto';
            if (!groups[proj]) groups[proj] = [];
            groups[proj].push(run);
        }
        return groups;
    }, [processedData]);

    // Flatten for pagination (include group headers)
    const flatRows = useMemo(() => {
        const rows: { type: 'header' | 'run'; project?: string; count?: number; run?: any; idx?: number }[] = [];
        const projects = Object.keys(groupedByProject).sort();
        for (const proj of projects) {
            const runs = groupedByProject[proj];
            rows.push({ type: 'header', project: proj, count: runs.length });
            if (!collapsedProjects.has(proj)) {
                runs.forEach((run, i) => rows.push({ type: 'run', run, project: proj, idx: i }));
            }
        }
        return rows;
    }, [groupedByProject, collapsedProjects]);

    const totalPages = Math.ceil(flatRows.length / PAGE_SIZE);
    const pagedRows = flatRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    // Reset page when filters change
    useMemo(() => { setPage(0); }, [searchTerm, sortField, sortDir]);

    const toggleRow = (key: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleProject = (proj: string) => {
        setCollapsedProjects(prev => {
            const next = new Set(prev);
            if (next.has(proj)) next.delete(proj);
            else next.add(proj);
            return next;
        });
    };

    const toggleSort = (field: SortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    if (!data || data.length === 0) return null;

    const csvData = processedData.map(r => ({
        proyecto: r.project_name,
        ciclo: r.run_name,
        plan: r.plan_name,
        estado: r.run_status,
        total: r.total_tests,
        pasados: r.passed_count,
        fallados: r.failed_count,
        bloqueados: r.blocked_count,
        reprueba: r.retest_count,
        en_progreso: r.process_count,
        sin_probar: r.untested_count,
        defectos: r._defectCount,
    }));

    return (
        <div className="rounded-xl overflow-hidden mt-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>

            {/* Header */}
            <div className="px-6 py-4 flex justify-between items-center flex-wrap gap-3"
                style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--sura-blue-dark)' }}>
                    <Layers className="w-4 h-4" style={{ color: 'var(--sura-blue)' }} />
                    DESGLOSE INTEGRAL POR CICLO
                </h3>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                        <Search className="w-3 h-3 absolute left-2 top-2.5" style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Buscar ciclo, plan o proyecto..."
                            className="text-xs rounded pl-7 pr-3 py-2 w-56 outline-none transition-colors"
                            style={{
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-light)',
                                color: 'var(--text-body)',
                            }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        {processedData.length} CICLOS
                    </span>
                    <CsvExportButton
                        data={csvData}
                        filename="desglose_ciclos"
                        columns={[
                            { key: 'proyecto', label: 'Proyecto' },
                            { key: 'ciclo', label: 'Ciclo' },
                            { key: 'plan', label: 'Plan' },
                            { key: 'estado', label: 'Estado' },
                            { key: 'total', label: 'Total' },
                            { key: 'pasados', label: 'Pasados' },
                            { key: 'fallados', label: 'Fallados' },
                            { key: 'bloqueados', label: 'Bloqueados' },
                            { key: 'en_progreso', label: 'En Progreso' },
                            { key: 'sin_probar', label: 'Sin Probar' },
                            { key: 'defectos', label: 'Defectos' },
                        ]}
                    />
                </div>
            </div>

            {/* Sort controls */}
            <div className="px-6 py-2 flex items-center gap-4 text-[10px] font-mono uppercase"
                style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                <span>Ordenar:</span>
                {([
                    ['project', 'Proyecto'],
                    ['status', 'Estado'],
                    ['total', 'Total Casos'],
                    ['defects', 'Defectos'],
                ] as [SortField, string][]).map(([field, label]) => (
                    <button key={field}
                        onClick={() => toggleSort(field)}
                        className="flex items-center gap-1 px-2 py-1 rounded transition-colors"
                        style={{
                            background: sortField === field ? 'var(--bg-blue-tint)' : 'transparent',
                            color: sortField === field ? 'var(--sura-blue)' : 'var(--text-muted)',
                            border: sortField === field ? '1px solid var(--border-blue)' : '1px solid transparent',
                        }}>
                        {label}
                        <ArrowUpDown className="w-2.5 h-2.5" />
                        {sortField === field && <span>{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ minWidth: '900px' }}>
                    <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-page)', boxShadow: '0 1px 0 var(--border-light)' }}>
                        <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <th className="py-2.5 px-4 text-[10px] font-semibold uppercase w-6"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }} />
                            <th className="py-2.5 px-4 text-[10px] font-semibold uppercase"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>Ciclo</th>
                            <th className="py-2.5 px-4 text-[10px] font-semibold uppercase"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>Plan</th>
                            <th className="py-2.5 px-3 text-[10px] font-semibold uppercase text-center"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>Estado</th>
                            <th className="py-2.5 px-3 text-[10px] font-semibold uppercase text-center"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>Total</th>
                            <th className="py-2.5 px-3 text-[10px] font-semibold uppercase"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em', minWidth: '180px' }}>Distribucion</th>
                            <th className="py-2.5 px-3 text-[10px] font-semibold uppercase"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>Detalle Casos</th>
                            <th className="py-2.5 px-3 text-[10px] font-semibold uppercase text-center"
                                style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>Defectos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pagedRows.map((row, rowIdx) => {
                            if (row.type === 'header') {
                                const isCollapsed = collapsedProjects.has(row.project!);
                                return (
                                    <tr key={`header-${row.project}`}
                                        onClick={() => toggleProject(row.project!)}
                                        className="cursor-pointer"
                                        style={{
                                            background: 'var(--bg-blue-tint)',
                                            borderBottom: '1px solid var(--border-light)',
                                        }}>
                                        <td colSpan={8} className="py-2.5 px-4">
                                            <div className="flex items-center gap-2">
                                                {isCollapsed
                                                    ? <ChevronRightIcon className="w-3.5 h-3.5" style={{ color: 'var(--sura-blue)' }} />
                                                    : <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--sura-blue)' }} />
                                                }
                                                <span className="text-xs font-semibold" style={{ color: 'var(--sura-blue-dark)' }}>
                                                    {row.project}
                                                </span>
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                                                    style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }}>
                                                    {row.count} ciclos
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }

                            const run = row.run;
                            const runKey = `${run.run_id}-${row.idx}`;
                            const isExpanded = expandedRows.has(runKey);
                            const defects = getDefectsForRun(run.run_id, run.plan_name);
                            const defectCount = defects.length;

                            const passed = Number(run.passed_count) || 0;
                            const failed = Number(run.failed_count) || 0;
                            const blocked = Number(run.blocked_count) || 0;
                            const retest = Number(run.retest_count) || 0;
                            const inProgress = Number(run.process_count) || 0;
                            const untested = Number(run.untested_count) || 0;
                            const total = Number(run.total_tests) || 1;

                            const zebra = (row.idx ?? 0) % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)';

                            return (
                                <React.Fragment key={runKey}>
                                    {/* Main run row */}
                                    <tr
                                        className="cursor-pointer transition-colors"
                                        style={{ borderBottom: '1px solid var(--border-light)', background: zebra }}
                                        onClick={() => defectCount > 0 && toggleRow(runKey)}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-blue-tint)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = zebra)}>
                                        {/* Expand icon */}
                                        <td className="py-2 px-3 text-center">
                                            {defectCount > 0 && (
                                                isExpanded
                                                    ? <ChevronDown className="w-3.5 h-3.5 inline" style={{ color: 'var(--sura-blue)' }} />
                                                    : <ChevronRightIcon className="w-3.5 h-3.5 inline" style={{ color: 'var(--text-muted)' }} />
                                            )}
                                        </td>
                                        {/* Run name */}
                                        <td className="py-2 px-4 max-w-[200px]">
                                            <span className="text-xs truncate block" style={{ color: 'var(--text-body)' }} title={run.run_name}>
                                                {run.run_name}
                                            </span>
                                        </td>
                                        {/* Plan name */}
                                        <td className="py-2 px-4 max-w-[180px]">
                                            <span className="text-[10px] font-mono truncate block" style={{ color: 'var(--text-muted)' }} title={run.plan_name}>
                                                {run.plan_name}
                                            </span>
                                        </td>
                                        {/* Status badge */}
                                        <td className="py-2 px-3 text-center">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] whitespace-nowrap font-mono font-bold uppercase"
                                                style={getStatusStyle(run.run_status)}>
                                                {getStatusIcon(run.run_status)}
                                                {run.run_status}
                                            </span>
                                        </td>
                                        {/* Total */}
                                        <td className="py-2 px-3 text-center">
                                            <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-body)' }}>
                                                {run.total_tests}
                                            </span>
                                        </td>
                                        {/* Stacked bar */}
                                        <td className="py-2 px-3">
                                            <div className="flex rounded-full overflow-hidden h-2.5" style={{ background: 'var(--bg-gray-tint)', minWidth: '140px' }}>
                                                {passed > 0 && (
                                                    <div style={{ width: `${(passed / total) * 100}%`, background: '#10b981' }}
                                                        title={`Pasados: ${passed}`} />
                                                )}
                                                {failed > 0 && (
                                                    <div style={{ width: `${(failed / total) * 100}%`, background: '#f43f5e' }}
                                                        title={`Fallados: ${failed}`} />
                                                )}
                                                {blocked > 0 && (
                                                    <div style={{ width: `${(blocked / total) * 100}%`, background: '#f97316' }}
                                                        title={`Bloqueados: ${blocked}`} />
                                                )}
                                                {retest > 0 && (
                                                    <div style={{ width: `${(retest / total) * 100}%`, background: '#A855F7' }}
                                                        title={`Reprueba: ${retest}`} />
                                                )}
                                                {inProgress > 0 && (
                                                    <div style={{ width: `${(inProgress / total) * 100}%`, background: '#3b82f6' }}
                                                        title={`En Progreso: ${inProgress}`} />
                                                )}
                                                {untested > 0 && (
                                                    <div style={{ width: `${(untested / total) * 100}%`, background: '#CBD5E1' }}
                                                        title={`Sin Probar: ${untested}`} />
                                                )}
                                            </div>
                                        </td>
                                        {/* Case count chips */}
                                        <td className="py-2 px-3">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {passed > 0 && (
                                                    <span title="Pasados" className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                                                        style={{ background: '#D1FAE5', color: '#065F46' }}>{passed}</span>
                                                )}
                                                {failed > 0 && (
                                                    <span title="Fallados" className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                                                        style={{ background: '#FEE2E2', color: '#991B1B' }}>{failed}</span>
                                                )}
                                                {blocked > 0 && (
                                                    <span title="Bloqueados" className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                                                        style={{ background: '#FEF3C7', color: '#92400E' }}>{blocked}</span>
                                                )}
                                                {retest > 0 && (
                                                    <span title="Reprueba" className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                                                        style={{ background: '#F3E8FF', color: '#6B21A8' }}>{retest}</span>
                                                )}
                                                {inProgress > 0 && (
                                                    <span title="En Progreso" className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                                                        style={{ background: '#DBEAFE', color: '#1D4ED8' }}>{inProgress}</span>
                                                )}
                                                {untested > 0 && (
                                                    <span title="Sin Probar" className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
                                                        style={{ background: '#F1F5F9', color: '#64748B' }}>{untested}</span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Defect count */}
                                        <td className="py-2 px-3 text-center">
                                            {defectCount > 0 ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                                                    style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
                                                    <Bug className="w-3 h-3" />
                                                    {defectCount}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>-</span>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Expanded defect detail rows */}
                                    {isExpanded && defects.map((defect, dIdx) => (
                                        <tr key={`${runKey}-defect-${defect.key}-${dIdx}`}
                                            style={{
                                                background: dIdx % 2 === 0 ? '#FEFCE8' : '#FFFBEB',
                                                borderBottom: '1px solid var(--border-light)',
                                            }}>
                                            <td />
                                            <td colSpan={7} className="py-2 px-4">
                                                <div className="flex items-center gap-4 pl-4"
                                                    style={{ borderLeft: '3px solid #f97316' }}>
                                                    {/* Defect key */}
                                                    <a href={defect.url} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs font-mono hover:underline shrink-0"
                                                        style={{ color: 'var(--sura-blue)', minWidth: '100px' }}>
                                                        {defect.key}
                                                        <ExternalLink size={10} />
                                                    </a>
                                                    {/* Summary */}
                                                    <span className="text-xs truncate flex-1" style={{ color: 'var(--text-body)', maxWidth: '350px' }}
                                                        title={defect.summary}>
                                                        {defect.summary}
                                                    </span>
                                                    {/* Status */}
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase shrink-0"
                                                        style={{ background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
                                                        {defect.status}
                                                    </span>
                                                    {/* Priority */}
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase shrink-0"
                                                        style={getPriorityStyle(defect.priority)}>
                                                        {defect.priority}
                                                    </span>
                                                    {/* Assignee */}
                                                    {defect.assignee && (
                                                        <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--text-muted)' }}>
                                                            {defect.assignee}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3"
                style={{ borderTop: '1px solid var(--border-light)', background: 'var(--bg-page)' }}>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    Mostrando {flatRows.length > 0 ? page * PAGE_SIZE + 1 : 0}--{Math.min((page + 1) * PAGE_SIZE, flatRows.length)} de {flatRows.length} filas
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                        <ChevronLeft size={14} />
                    </button>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                        Pag {page + 1} / {totalPages || 1}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="p-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div className="px-6 py-2 flex items-center gap-4 flex-wrap"
                style={{ borderTop: '1px solid var(--border-light)', background: 'var(--bg-page)' }}>
                {[
                    { color: '#10b981', label: 'Pasados' },
                    { color: '#f43f5e', label: 'Fallados' },
                    { color: '#f97316', label: 'Bloqueados' },
                    { color: '#3b82f6', label: 'En Progreso' },
                    { color: '#CBD5E1', label: 'Sin Probar' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
