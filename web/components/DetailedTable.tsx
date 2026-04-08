
import { Users, FileText, Calendar, Clock, AlertTriangle, CheckCircle, XCircle, PlayCircle, StopCircle } from 'lucide-react';

interface DetailedTableProps {
    data: any[];
    type: 'mart' | 'pruebas';
}

export default function DetailedTable({ data, type }: DetailedTableProps) {
    if (!data || data.length === 0) return null;

    // Sort by date desc
    const sortedData = [...data].sort((a, b) => new Date(b.month_key).getTime() - new Date(a.month_key).getTime());

    return (
        <div className="rounded-xl overflow-hidden mt-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
            <div className="px-6 py-4 flex justify-between items-center"
                style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg-blue-tint)' }}>
                <h3 className="text-sm font-semibold flex items-center gap-2"
                    style={{ color: 'var(--sura-blue-dark)' }}>
                    <FileText className="w-4 h-4" style={{ color: 'var(--sura-blue)' }} />
                    Detalle de Ejecución ({type === 'mart' ? 'Mart' : 'Aseguramiento'})
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded"
                    style={{ color: 'var(--sura-blue)', background: 'rgba(45,109,246,0.08)' }}>
                    {data.length} registros
                </span>
            </div>

            <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse relative">
                    <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-page)', boxShadow: '0 1px 0 var(--border-light)' }}>
                        <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                            {['Mes', 'Iniciativa / Plan', 'Proyecto', 'Estado', 'Total Tests', 'Pasados', 'Defectos', 'Retraso', 'Analistas'].map((h, i) => (
                                <th key={h} className={`px-6 py-3 text-[11px] font-semibold uppercase ${[3,7].includes(i) ? 'text-center' : i >= 4 && i <= 6 ? 'text-right' : ''}`}
                                    style={{ color: 'var(--text-secondary)', letterSpacing: '0.07em' }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((row, idx) => (
                            <tr key={`${row.plan_id}-${idx}`} className="transition-colors"
                                style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-blue-tint)')}
                                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)')}>
                                <td className="px-6 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                                    {row.month_key}
                                </td>
                                <td className="px-6 py-3 text-sm font-medium max-w-[300px]" style={{ color: 'var(--text-primary)' }}>
                                    <div className="flex flex-col">
                                        <span className="truncate" title={row.Iniciativa}>{row.Iniciativa}</span>
                                        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>ID: {row.plan_id}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    {row.project_name}
                                </td>
                                <td className="px-6 py-3 text-center">
                                    {row.Estado_Iniciativa === 'Certificada' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                                            style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                                            <CheckCircle size={10} /> Certificada
                                        </span>
                                    )}
                                    {row.Estado_Iniciativa === 'En Proceso' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                                            style={{ background: 'var(--bg-blue-tint)', color: 'var(--sura-blue)', border: '1px solid var(--border-blue)' }}>
                                            <Clock size={10} /> En Proceso
                                        </span>
                                    )}
                                    {!row.Estado_Iniciativa && (
                                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>-</span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-sm text-right font-mono font-medium" style={{ color: 'var(--text-body)' }}>
                                    {Number(row.total_tests).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-right font-mono font-medium" style={{ color: '#059669' }}>
                                    {Number(row.total_passed).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-right font-mono">
                                    {Number(row.active_defects_proxy) > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                                            style={{ color: '#DC2626', background: '#FEE2E2', border: '1px solid #FECACA' }}>
                                            <AlertTriangle className="w-3 h-3" />
                                            {row.active_defects_proxy}
                                        </span>
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-sm text-center font-mono">
                                    {row.entrega_desarrollo_tardia === 1 && row.dias_retraso_desarrollo > 0 ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs" title="Entrega de Desarrollo Tardía"
                                            style={{ color: '#D97706', background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                                            <Clock className="w-3 h-3" />
                                            {row.dias_retraso_desarrollo}d
                                        </span>
                                    ) : (
                                        <span className="text-[10px]" style={{ color: '#059669' }}>A Tiempo</span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-xs max-w-[250px]" style={{ color: 'var(--text-secondary)' }}>
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
