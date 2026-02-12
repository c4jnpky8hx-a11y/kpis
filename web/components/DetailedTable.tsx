
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
        <div className="bg-[#111827] border border-gray-800 rounded-lg overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-[#1f2937]/50">
                <h3 className="text-sm font-medium text-white tracking-wide flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    DETALLE DE EJECUCION ({type === 'mart' ? 'MART' : 'ASEGURAMIENTO'})
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                    {data.length} REGISTROS
                </span>
            </div>

            <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse relative">
                    <thead className="sticky top-0 bg-[#111827] z-10 shadow-lg">
                        <tr className="text-gray-400 text-xs uppercase font-mono border-b border-gray-800">
                            <th className="px-6 py-3 font-medium">Mes</th>
                            <th className="px-6 py-3 font-medium">Iniciativa / Plan</th>
                            <th className="px-6 py-3 font-medium">Proyecto</th>
                            <th className="px-6 py-3 font-medium text-center">Estado</th>
                            <th className="px-6 py-3 font-medium text-right">Total Tests</th>
                            <th className="px-6 py-3 font-medium text-right text-green-500">Pasados</th>
                            <th className="px-6 py-3 font-medium text-right text-rose-500">Defectos</th>
                            <th className="px-6 py-3 font-medium">Analistas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {sortedData.map((row, idx) => (
                            <tr key={`${row.plan_id}-${idx}`} className="hover:bg-gray-800/50 transition-colors group">
                                <td className="px-6 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                                    {row.month_key}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-200 font-medium max-w-[300px]">
                                    <div className="flex flex-col">
                                        <span className="truncate" title={row.Iniciativa}>{row.Iniciativa}</span>
                                        <span className="text-[10px] text-gray-600 font-mono">ID: {row.plan_id}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3 text-xs text-gray-400">
                                    {row.project_name}
                                </td>
                                <td className="px-6 py-3 text-center">
                                    {row.Estado_Iniciativa === 'Certificada' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-[10px] border border-green-500/20">
                                            <CheckCircle size={10} /> Certified
                                        </span>
                                    )}
                                    {row.Estado_Iniciativa === 'En Proceso' && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[10px] border border-blue-500/20">
                                            <Clock size={10} /> In Process
                                        </span>
                                    )}
                                    {!row.Estado_Iniciativa && (
                                        <span className="text-gray-600 text-[10px]">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-300 text-right font-mono font-medium">
                                    {Number(row.total_tests).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-green-400/80 text-right font-mono font-medium">
                                    {Number(row.total_passed).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-right font-mono">
                                    {Number(row.active_defects_proxy) > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded border border-rose-400/20">
                                            <AlertTriangle className="w-3 h-3" />
                                            {row.active_defects_proxy}
                                        </span>
                                    ) : (
                                        <span className="text-gray-600">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-xs text-gray-400 max-w-[250px]">
                                    {row.analysts ? (
                                        <div className="flex items-start gap-2">
                                            <Users className="w-3 h-3 mt-0.5 text-purple-500 shrink-0" />
                                            <span className="line-clamp-2 md:line-clamp-1 group-hover:line-clamp-none transition-all duration-300">
                                                {row.analysts}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-gray-600 italic text-[10px]">Sin Asignar</span>
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
