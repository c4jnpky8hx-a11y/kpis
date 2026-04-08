
import { Users, AlertCircle, CheckCircle, BarChart2, Layers } from 'lucide-react';

interface ProjectSummaryProps {
    data: any[];
}

export default function ProjectSummaryTable({ data }: ProjectSummaryProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
            <div className="px-6 py-4 flex justify-between items-center"
                style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-blue-tint)' }}>
                <h3 className="text-sm font-semibold flex items-center gap-2"
                    style={{ color: 'var(--sura-blue-dark)' }}>
                    <Layers className="w-4 h-4" style={{ color: 'var(--sura-blue)' }} />
                    Resumen por Proyecto
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ color: 'var(--sura-blue)', background: 'rgba(45,109,246,0.08)' }}>
                    {data.length} proyectos activos
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-light)' }}>
                            {['ID', 'Proyecto', 'Planes Activos', 'Casos (Repo)', 'Ejecutados', 'Pasados', 'Defectos', 'Analistas'].map((h, i) => (
                                <th key={h} className={`px-6 py-3 text-[11px] font-semibold uppercase tracking-wider ${i >= 2 && i <= 6 ? (i >= 3 ? 'text-right' : 'text-center') : ''}`}
                                    style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, idx) => (
                            <tr key={row.project_id} className="group transition-colors"
                                style={{
                                    borderBottom: '1px solid var(--border-light)',
                                    background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)'
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-blue-tint)')}
                                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)')}>
                                <td className="px-6 py-3 text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                                    {row.project_id}
                                </td>
                                <td className="px-6 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {row.project_name}
                                </td>
                                <td className="px-6 py-3 text-sm text-center font-mono" style={{ color: 'var(--text-body)' }}>
                                    {row.active_plans}
                                </td>
                                <td className="px-6 py-3 text-sm text-right font-mono" style={{ color: 'var(--text-secondary)' }}>
                                    {Number(row.total_cases_repo).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-right font-mono font-medium" style={{ color: 'var(--text-body)' }}>
                                    {Number(row.total_tests_execution).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-right font-mono font-medium" style={{ color: '#059669' }}>
                                    {Number(row.status_passed).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-right font-mono">
                                    {Number(row.active_defects) > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                                            style={{ color: '#DC2626', background: '#FEE2E2', border: '1px solid #FECACA' }}>
                                            <AlertCircle className="w-3 h-3" />
                                            {row.active_defects}
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-xs max-w-[300px]" style={{ color: 'var(--text-secondary)' }}>
                                    {row.analysts ? (
                                        <div className="flex items-start gap-2">
                                            <Users className="w-3 h-3 mt-0.5 shrink-0" style={{ color: 'var(--sura-blue)' }} />
                                            <span className="line-clamp-2 md:line-clamp-1 group-hover:line-clamp-none transition-all duration-300">
                                                {row.analysts}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="italic text-[10px]" style={{ color: 'var(--text-muted)' }}>Sin Asignar</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
