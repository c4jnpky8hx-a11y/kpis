'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, ExternalLink, XCircle } from 'lucide-react';

export default function UnlinkedDefectsTable() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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

    if (loading) return <div className="text-gray-500 text-xs font-mono animate-pulse">CARGANDO DEFECTOS...</div>;

    const unlinkedCount = data.filter(d => !d.is_linked).length;

    return (
        <div className="bg-[#111827] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-sm font-medium text-white tracking-wide flex items-center gap-2">
                        AUDITORIA DE DEFECTOS JIRA
                        {unlinkedCount > 0 && (
                            <span className="bg-rose-500/10 text-rose-500 text-[10px] px-2 py-0.5 rounded border border-rose-500/20 font-mono">
                                {unlinkedCount} NO VINCULADOS
                            </span>
                        )}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Defectos en Jira vs Vinculación en TestRail</p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-800 text-xs text-gray-400 font-mono uppercase">
                            <th className="py-2 px-4">Defecto</th>
                            <th className="py-2 px-4">Resumen</th>
                            <th className="py-2 px-4">Estado</th>
                            <th className="py-2 px-4">Prioridad</th>
                            <th className="py-2 px-4">Vinculación</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-gray-300">
                        {data.slice(0, 50).map((row) => (
                            <tr key={row.key} className="border-b border-gray-800 hover:bg-gray-900/50 transition-colors group">
                                <td className="py-2 px-4 font-mono text-blue-400">
                                    <a href={row.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline">
                                        {row.key} <ExternalLink size={10} />
                                    </a>
                                </td>
                                <td className="py-2 px-4 max-w-[300px] truncate" title={row.summary}>{row.summary}</td>
                                <td className="py-2 px-4">
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-800 border border-gray-700 font-mono uppercase">
                                        {row.status}
                                    </span>
                                </td>
                                <td className="py-2 px-4">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border ${row.priority === 'Crítica' ? 'bg-rose-900/20 text-rose-400 border-rose-900/50' :
                                            row.priority === 'Alta' ? 'bg-orange-900/20 text-orange-400 border-orange-900/50' :
                                                'bg-gray-800 text-gray-400 border-gray-700'
                                        }`}>
                                        {row.priority}
                                    </span>
                                </td>
                                <td className="py-2 px-4">
                                    {row.is_linked ? (
                                        <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                                            <CheckCircle size={12} />
                                            <span>Vinculado</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-rose-500 text-xs font-bold bg-rose-500/5 px-2 py-1 rounded w-fit">
                                            <XCircle size={12} />
                                            <span>NO VINCULADO</span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {data.length > 50 && (
                    <div className="text-center py-2 text-xs text-gray-500 font-mono border-t border-gray-800">
                        MOSTRANDO 50 DE {data.length} REGISTROS
                    </div>
                )}
            </div>
        </div>
    );
}
