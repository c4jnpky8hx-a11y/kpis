'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, AlertCircle, AlertOctagon, Clock, ExternalLink, Bug, Layers, ChevronLeft, ChevronRight } from 'lucide-react';

// One row per (cycle, defect) link from active_defects_by_cycle view
interface CycleDefectRow {
    run_id: number | string;
    run_name?: string;
    plan_id?: number | string;
    plan_name?: string;
    project_id?: number | string;
    project_name?: string;
    defect_key: string;
    summary?: string;
    status?: string;
    priority?: string;
    age_days?: number;
    url?: string;
}

interface Props {
    rows: CycleDefectRow[];
    selectedProject: string;
    excludedProjects: Set<string>;
}

const PRIORITY_ORDER: Record<string, number> = {
    'Crítica': 1, 'Critica': 1,
    'Alta': 2, 'High': 2,
    'Media': 3, 'Medium': 3,
    'Baja': 4, 'Low': 4,
};

function getPriorityStyle(priority?: string): React.CSSProperties {
    switch (priority) {
        case 'Crítica':
        case 'Critica':
            return { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' };
        case 'Alta':
        case 'High':
            return { background: '#FFEDD5', color: '#9A3412', border: '1px solid #FDBA74' };
        case 'Media':
        case 'Medium':
            return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' };
        case 'Baja':
        case 'Low':
            return { background: '#DBEAFE', color: '#1E3A8A', border: '1px solid #BFDBFE' };
        default:
            return { background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' };
    }
}

function getAgeColor(days?: number): string {
    if (!days) return 'var(--text-muted)';
    if (days >= 30) return '#DC2626';
    if (days >= 14) return '#EA580C';
    if (days >= 7) return '#D97706';
    return 'var(--text-secondary)';
}

const PAGE_SIZE = 10;

export default function ActiveDefectsTracking({ rows, selectedProject, excludedProjects }: Props) {
    const [page, setPage] = useState(0);

    // Filter by selected project & excluded projects
    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            const pid = String(r.project_id ?? '');
            if (excludedProjects.has(pid)) return false;
            if (selectedProject !== 'All' && selectedProject !== pid) return false;
            return true;
        });
    }, [rows, selectedProject, excludedProjects]);

    // Group rows by cycle (run_id)
    const cycles = useMemo(() => {
        const map = new Map<string, {
            run_id: string;
            run_name: string;
            plan_name: string;
            project_name: string;
            defects: CycleDefectRow[];
            critical: number;
            high: number;
            medium: number;
            low: number;
        }>();

        for (const r of filteredRows) {
            const id = String(r.run_id);
            if (!map.has(id)) {
                map.set(id, {
                    run_id: id,
                    run_name: r.run_name || `Run ${id}`,
                    plan_name: r.plan_name || '',
                    project_name: r.project_name || '',
                    defects: [],
                    critical: 0, high: 0, medium: 0, low: 0,
                });
            }
            const entry = map.get(id)!;
            // dedupe defects per cycle (a defect could be in multiple results of same run)
            if (!entry.defects.some(d => d.defect_key === r.defect_key)) {
                entry.defects.push(r);
                switch (r.priority) {
                    case 'Crítica': case 'Critica': entry.critical++; break;
                    case 'Alta': case 'High': entry.high++; break;
                    case 'Media': case 'Medium': entry.medium++; break;
                    case 'Baja': case 'Low': entry.low++; break;
                }
            }
        }

        // Sort: most critical impact first
        return Array.from(map.values()).sort((a, b) => {
            const score = (c: typeof a) => c.critical * 1000 + c.high * 100 + c.medium * 10 + c.low + c.defects.length * 0.01;
            return score(b) - score(a);
        });
    }, [filteredRows]);

    // Totals from filteredRows (deduped by defect_key)
    const totals = useMemo(() => {
        const seen = new Set<string>();
        let critical = 0, high = 0, medium = 0, low = 0, other = 0;
        for (const r of filteredRows) {
            if (seen.has(r.defect_key)) continue;
            seen.add(r.defect_key);
            switch (r.priority) {
                case 'Crítica': case 'Critica': critical++; break;
                case 'Alta': case 'High': high++; break;
                case 'Media': case 'Medium': medium++; break;
                case 'Baja': case 'Low': low++; break;
                default: other++;
            }
        }
        return { total: seen.size, critical, high, medium, low, other };
    }, [filteredRows]);

    const totalPages = Math.max(1, Math.ceil(cycles.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages - 1);
    const pageStart = safePage * PAGE_SIZE;
    const pageCycles = cycles.slice(pageStart, pageStart + PAGE_SIZE);

    return (
        <div className="space-y-6">
            {/* ─── Totales por criticidad ─── */}
            <div>
                <h3 className="text-xs font-semibold uppercase mb-3" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                    Defectos Activos {selectedProject !== 'All' && `(proyecto filtrado)`}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <SummaryCard label="Total Activos" value={totals.total} color="var(--sura-blue)" icon={<Bug className="w-4 h-4" />} />
                    <SummaryCard label="Crítica" value={totals.critical} color="#DC2626" icon={<AlertOctagon className="w-4 h-4" />} />
                    <SummaryCard label="Alta" value={totals.high} color="#EA580C" icon={<AlertTriangle className="w-4 h-4" />} />
                    <SummaryCard label="Media" value={totals.medium} color="#D97706" icon={<AlertCircle className="w-4 h-4" />} />
                    <SummaryCard label="Baja" value={totals.low} color="#1D4ED8" icon={<Bug className="w-4 h-4" />} />
                </div>
            </div>

            {/* ─── Detalle por ciclo ─── */}
            <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                    <h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                        Ciclos con Defectos Activos ({cycles.length})
                    </h3>
                    {cycles.length > PAGE_SIZE && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={safePage === 0}
                                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
                            ><ChevronLeft className="w-3 h-3" /></button>
                            <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                {safePage + 1} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={safePage >= totalPages - 1}
                                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
                            ><ChevronRight className="w-3 h-3" /></button>
                        </div>
                    )}
                </div>

                {cycles.length === 0 ? (
                    <div className="rounded-xl py-12 text-center text-sm flex flex-col items-center gap-3"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                        <Layers className="w-8 h-8 opacity-40" />
                        <span>No se encontraron ciclos con defectos activos relacionados</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pageCycles.map(cycle => (
                            <div key={cycle.run_id}
                                className="rounded-xl overflow-hidden"
                                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                                {/* Cycle header */}
                                <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-3"
                                    style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-3.5 h-3.5" style={{ color: 'var(--sura-blue)' }} />
                                            <span className="text-sm font-semibold truncate" style={{ color: 'var(--sura-blue-dark)' }} title={cycle.run_name}>
                                                {cycle.run_name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 ml-5">
                                            <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>
                                                {cycle.project_name}
                                            </span>
                                            {cycle.plan_name && cycle.plan_name !== cycle.run_name && (
                                                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                                    · Plan: {cycle.plan_name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {cycle.critical > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                                                style={getPriorityStyle('Crítica')}>
                                                <AlertOctagon className="w-3 h-3" /> {cycle.critical} Crítica{cycle.critical !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {cycle.high > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                                                style={getPriorityStyle('Alta')}>
                                                <AlertTriangle className="w-3 h-3" /> {cycle.high} Alta{cycle.high !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {cycle.medium > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                                                style={getPriorityStyle('Media')}>
                                                <AlertCircle className="w-3 h-3" /> {cycle.medium} Media{cycle.medium !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                        {cycle.low > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                                                style={getPriorityStyle('Baja')}>
                                                <Bug className="w-3 h-3" /> {cycle.low} Baja{cycle.low !== 1 ? 's' : ''}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                                            style={{ background: 'var(--sura-blue)', color: '#fff' }}>
                                            Total {cycle.defects.length}
                                        </span>
                                    </div>
                                </div>
                                {/* Defects table */}
                                <table className="w-full text-left">
                                    <thead style={{ background: 'var(--bg-page)' }}>
                                        <tr>
                                            <th className="py-2 px-3 text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Key</th>
                                            <th className="py-2 px-3 text-[9px] font-semibold uppercase text-center" style={{ color: 'var(--text-muted)' }}>Criticidad</th>
                                            <th className="py-2 px-3 text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Estado</th>
                                            <th className="py-2 px-4 text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Resumen</th>
                                            <th className="py-2 px-3 text-[9px] font-semibold uppercase text-center" style={{ color: 'var(--text-muted)' }}>Días</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cycle.defects
                                            .sort((a, b) => (PRIORITY_ORDER[a.priority || ''] ?? 99) - (PRIORITY_ORDER[b.priority || ''] ?? 99))
                                            .map((d, idx) => (
                                            <tr key={d.defect_key}
                                                style={{ borderTop: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)' }}>
                                                <td className="py-2 px-3">
                                                    <a href={d.url} target="_blank" rel="noreferrer"
                                                        className="text-xs font-mono font-semibold inline-flex items-center gap-1 hover:underline"
                                                        style={{ color: 'var(--sura-blue)' }}>
                                                        {d.defect_key}
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase"
                                                        style={getPriorityStyle(d.priority)}>
                                                        {d.priority || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3">
                                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                                                        style={{ background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
                                                        {d.status || '—'}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-4 text-xs max-w-[400px]" style={{ color: 'var(--text-body)' }}>
                                                    <div className="truncate" title={d.summary}>{d.summary || '—'}</div>
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    <span className="text-xs font-mono font-semibold inline-flex items-center gap-1" style={{ color: getAgeColor(d.age_days) }}>
                                                        <Clock className="w-3 h-3" />
                                                        {d.age_days ?? '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
    return (
        <div className="rounded-lg p-3 flex items-center gap-3"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="rounded-lg p-2" style={{ background: 'var(--bg-blue-tint)', color }}>
                {icon}
            </div>
            <div>
                <div className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{label}</div>
                <div className="text-xl font-mono font-bold" style={{ color }}>{value}</div>
            </div>
        </div>
    );
}
