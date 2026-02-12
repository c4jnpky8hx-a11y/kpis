
import { Users, AlertCircle, CheckCircle, BarChart2, Layers } from 'lucide-react';

interface ProjectSummaryProps {
    data: any[];
}

export default function ProjectSummaryTable({ data }: ProjectSummaryProps) {
    if (!data || data.length === 0) return null;

    return (
        <div className="bg-[#111827] border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-[#1f2937]/50">
                <h3 className="text-sm font-medium text-white tracking-wide flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    RESUMEN POR PROYECTO
                </h3>
                <span className="text-xs text-gray-500 font-mono">
                    {data.length} PROYECTOS ACTIVOS
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#111827] text-gray-400 text-xs uppercase font-mono border-b border-gray-800">
                            <th className="px-6 py-3 font-medium">ID</th>
                            <th className="px-6 py-3 font-medium">Proyecto</th>
                            <th className="px-6 py-3 font-medium text-center">Planes Activos</th>
                            <th className="px-6 py-3 font-medium text-right">Casos (Repo)</th>
                            <th className="px-6 py-3 font-medium text-right">Ejecutados</th>
                            <th className="px-6 py-3 font-medium text-right text-green-500">Pasados</th>
                            <th className="px-6 py-3 font-medium text-right text-rose-500">Defectos</th>
                            <th className="px-6 py-3 font-medium">Analistas Asignados</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {data.map((row) => (
                            <tr key={row.project_id} className="hover:bg-gray-800/50 transition-colors group">
                                <td className="px-6 py-3 text-sm text-gray-500 font-mono">
                                    {row.project_id}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-200 font-medium">
                                    {row.project_name}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-400 text-center font-mono">
                                    {row.active_plans}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-400 text-right font-mono">
                                    {Number(row.total_cases_repo).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-300 text-right font-mono font-medium">
                                    {Number(row.total_tests_execution).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-green-400/80 text-right font-mono font-medium">
                                    {Number(row.status_passed).toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-right font-mono">
                                    {Number(row.active_defects) > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded border border-rose-400/20">
                                            <AlertCircle className="w-3 h-3" />
                                            {row.active_defects}
                                        </span>
                                    ) : (
                                        <span className="text-gray-600">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-xs text-gray-400 max-w-[300px]">
                                    {row.analysts ? (
                                        <div className="flex items-start gap-2">
                                            <Users className="w-3 h-3 mt-0.5 text-blue-500 shrink-0" />
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
