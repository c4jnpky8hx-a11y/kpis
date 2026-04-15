'use client';

import { useState, useEffect, useMemo } from 'react';
import { ExternalLink, ChevronLeft, ChevronRight, Clock, User, AlertTriangle } from 'lucide-react';
import CsvExportButton from './CsvExport';

const CLOSED_STATUSES = ['Terminado', 'Cerrado', 'Cancelado', 'Mitigado', 'Done', 'Closed', 'Resolved'];
const PAGE_SIZE = 15;

export default function DefectDetailTable() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [sortBy, setSortBy] = useState<'age' | 'updated'>('age');

    useEffect(() => {
        fetch('/api/data?type=unlinked')
            .then(r => r.json())
            .then(json => { if (json.data) setData(json.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const processedData = useMemo(() => {
        const now = Date.now();
        return data
            .filter(d => d.issue_type === 'Defecto_TestRail' || !d.issue_type)
            .map(d => {
                const created = d.created ? new Date(d.created.value || d.created).getTime() : now;
                const updated = d.updated ? new Date(d.updated.value || d.updated).getTime() : created;
                const isClosed = CLOSED_STATUSES.includes(d.status);
                return {
                    ...d,
                    age_days: Math.floor((now - created) / 86400000),
                    days_since_update: Math.floor((now - updated) / 86400000),
                    is_closed: isClosed,
                };
            })
            .sort((a, b) => sortBy === 'age' ? b.age_days - a.age_days : b.days_since_update - a.days_since_update);
    }, [data, sortBy]);

    const totalPages = Math.ceil(processedData.length / PAGE_SIZE);
    const pagedData = processedData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    if (loading) return <div className="text-xs font-mono animate-pulse" style={{ color: 'var(--text-muted)' }}>CARGANDO DEFECTOS...</div>;

    const getAgeBadgeStyle = (days: number): React.CSSProperties => {
        if (days > 60) return { background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' };
        if (days > 30) return { background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' };
        return { background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' };
    };

    return (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--sura-blue-dark)' }}>
                        <AlertTriangle className="w-4 h-4" style={{ color: 'var(--status-amber)' }} />
                        DETALLE DE DEFECTOS
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {processedData.length} defectos Defecto_TestRail · Ordenados por {sortBy === 'age' ? 'antigüedad' : 'última actualización'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        className="text-[10px] font-mono rounded px-2 py-1 outline-none"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-body)' }}
                        value={sortBy}
                        onChange={e => { setSortBy(e.target.value as 'age' | 'updated'); setPage(0); }}
                    >
                        <option value="age">Por Antigüedad</option>
                        <option value="updated">Por Última Actualización</option>
                    </select>
                    <CsvExportButton
                        data={processedData as unknown as Record<string, unknown>[]}
                        filename="detalle_defectos"
                        columns={[
                            { key: 'key', label: 'Defecto' },
                            { key: 'summary', label: 'Resumen' },
                            { key: 'status', label: 'Estado' },
                            { key: 'priority', label: 'Prioridad' },
                            { key: 'assignee', label: 'Asignado' },
                            { key: 'age_days', label: 'Días Abierto' },
                            { key: 'days_since_update', label: 'Días Sin Actualizar' },
                        ]}
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-light)' }}>
                            {['Defecto', 'Resumen', 'Estado', 'Prioridad', 'Asignado', 'Edad', 'Últ. Actualización'].map(h => (
                                <th key={h} className="py-3 px-4 text-[11px] font-semibold uppercase" style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {pagedData.map((row, idx) => (
                            <tr key={row.key}
                                style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-blue-tint)')}
                                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)')}>
                                <td className="py-2 px-4 font-mono text-sm">
                                    <a href={row.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: 'var(--sura-blue)' }}>
                                        {row.key} <ExternalLink size={10} />
                                    </a>
                                </td>
                                <td className="py-2 px-4 text-sm max-w-[250px] truncate" title={row.summary} style={{ color: 'var(--text-body)' }}>{row.summary}</td>
                                <td className="py-2 px-4">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase"
                                        style={row.is_closed
                                            ? { background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' }
                                            : { background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }
                                        }>{row.status}</span>
                                </td>
                                <td className="py-2 px-4">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase"
                                        style={
                                            row.priority === 'Crítica' ? { background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' } :
                                            row.priority === 'Alta' ? { background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' } :
                                            { background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }
                                        }>{row.priority}</span>
                                </td>
                                <td className="py-2 px-4 text-xs flex items-center gap-1.5" style={{ color: 'var(--text-body)' }}>
                                    <User size={11} style={{ color: 'var(--text-muted)' }} />
                                    <span className="truncate max-w-[120px]">{row.assignee || 'Sin asignar'}</span>
                                </td>
                                <td className="py-2 px-4">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 w-fit" style={getAgeBadgeStyle(row.age_days)}>
                                        <Clock size={10} /> {row.age_days}d
                                    </span>
                                </td>
                                <td className="py-2 px-4">
                                    <span className="text-[10px] font-mono" style={{ color: row.days_since_update > 14 ? '#D97706' : 'var(--text-muted)' }}>
                                        {row.days_since_update}d
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border-light)' }}>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, processedData.length)} de {processedData.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                            className="p-1 rounded transition-colors disabled:opacity-30" style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>Pág {page + 1} / {totalPages || 1}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                            className="p-1 rounded transition-colors disabled:opacity-30" style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
