'use client';

import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, ExternalLink, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import CsvExportButton from './CsvExport';

const CLOSED_STATUSES = ['Terminado', 'Cerrado', 'Cancelado', 'Mitigado', 'Done', 'Closed', 'Resolved'];
const PAGE_SIZE = 15;

interface Props {
    excludedProjects?: Set<string>;
    selectedProject?: string;
    projects?: { id: string | number; name: string }[];
}

export default function UnlinkedDefectsTable({ excludedProjects = new Set<string>(), selectedProject = 'All', projects = [] }: Props) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);

    useEffect(() => {
        fetch('/api/data?type=unlinked')
            .then(res => res.json())
            .then(json => {
                if (json.data) setData(json.data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch unlinked defects", err);
                setLoading(false);
            });
    }, []);

    // Reset page when filters change
    useEffect(() => { setPage(0); }, [selectedProject, excludedProjects]);

    // Build excluded project names from IDs
    const excludedNames = useMemo(() => {
        const names = new Set<string>();
        excludedProjects.forEach(id => {
            const proj = projects.find(p => String(p.id) === id);
            if (proj) names.add(proj.name);
        });
        return names;
    }, [excludedProjects, projects]);

    // Get selected project name for filtering
    const selectedProjectName = useMemo(() => {
        if (selectedProject === 'All') return null;
        const proj = projects.find(p => String(p.id) === selectedProject);
        return proj?.name || null;
    }, [selectedProject, projects]);

    if (loading) return <div className="text-xs font-mono animate-pulse" style={{ color: 'var(--text-muted)' }}>CARGANDO DEFECTOS...</div>;

    const activeData = data.filter(d => {
        // Only active defects
        if (CLOSED_STATUSES.includes(d.status)) return false;

        // When a specific project is selected:
        // Show ONLY defects linked to that project
        if (selectedProjectName) {
            if (!d.is_linked || !d.linked_projects) return false;
            const linkedList = d.linked_projects.split(',').map((s: string) => s.trim());
            if (!linkedList.includes(selectedProjectName)) return false;
            return true;
        }

        // When no project filter ("All"):
        // Show ALL active defects (linked + unlinked), respecting excluded projects
        if (excludedNames.size > 0 && d.linked_projects) {
            const linkedList = d.linked_projects.split(',').map((s: string) => s.trim());
            if (linkedList.every((name: string) => excludedNames.has(name))) return false;
        }
        return true;
    });
    const unlinkedCount = activeData.filter(d => !d.is_linked).length;
    const linkedCount = activeData.filter(d => d.is_linked).length;
    const totalPages = Math.ceil(activeData.length / PAGE_SIZE);
    const pagedData = activeData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
        <div className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
            <div className="px-6 py-4 flex items-center justify-between"
                style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--sura-blue-dark)' }}>
                        AUDITORIA DE DEFECTOS JIRA
                        {selectedProjectName && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono border"
                                style={{ background: '#DBEAFE', color: '#2563EB', border: '1px solid #BFDBFE' }}>
                                {selectedProjectName}
                            </span>
                        )}
                        {!selectedProjectName && unlinkedCount > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono border"
                                style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
                                {unlinkedCount} NO VINCULADOS
                            </span>
                        )}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {selectedProjectName
                            ? `Defectos vinculados a ${selectedProjectName} · ${activeData.length} activos`
                            : `Solo Defecto_TestRail · Activos (${activeData.length}) — ${linkedCount} vinculados · ${unlinkedCount} sin vincular`
                        }
                    </p>
                </div>
                <CsvExportButton
                    data={activeData}
                    filename="auditoria_defectos"
                    columns={[
                        { key: 'key', label: 'Defecto' },
                        { key: 'summary', label: 'Resumen' },
                        { key: 'status', label: 'Estado' },
                        { key: 'priority', label: 'Prioridad' },
                        { key: 'is_linked', label: 'Vinculado' },
                        { key: 'linked_projects', label: 'Proyectos' },
                    ]}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-page)', boxShadow: '0 1px 0 var(--border-light)' }}>
                        <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                            {['Defecto', 'Resumen', 'Estado', 'Prioridad', 'Vinculación'].map(h => (
                                <th key={h} className="py-3 px-4 text-[11px] font-semibold uppercase"
                                    style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>
                                    {h}
                                </th>
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
                                    <a href={row.url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 hover:underline"
                                        style={{ color: 'var(--sura-blue)' }}>
                                        {row.key} <ExternalLink size={10} />
                                    </a>
                                </td>
                                <td className="py-2 px-4 text-sm max-w-[300px] truncate" title={row.summary}
                                    style={{ color: 'var(--text-body)' }}>
                                    {row.summary}
                                </td>
                                <td className="py-2 px-4">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase"
                                        style={{ background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
                                        {row.status}
                                    </span>
                                </td>
                                <td className="py-2 px-4">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border`}
                                        style={
                                            row.priority === 'Crítica' ? { background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' } :
                                            row.priority === 'Alta' ? { background: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' } :
                                            { background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }
                                        }>
                                        {row.priority}
                                    </span>
                                </td>
                                <td className="py-2 px-4">
                                    {row.is_linked ? (
                                        <div className="flex items-center gap-1.5 text-xs" style={{ color: '#059669' }}>
                                            <CheckCircle size={12} />
                                            <span>Vinculado</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded w-fit"
                                            style={{ color: '#DC2626', background: '#FEE2E2', border: '1px solid #FECACA' }}>
                                            <XCircle size={12} />
                                            <span>NO VINCULADO</span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="flex items-center justify-between px-4 py-3"
                    style={{ borderTop: '1px solid var(--border-light)' }}>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, activeData.length)} de {activeData.length} activos
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
                            Pág {page + 1} / {totalPages || 1}
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
            </div>
        </div>
    );
}
