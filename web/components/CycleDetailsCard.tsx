import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PlayCircle, Clock, CheckCircle, AlertTriangle, XCircle, Search } from 'lucide-react';
import { clsx } from 'clsx';

export default function CycleDetailsCard({ data }: { data: any[] }) {
    const [searchTerm, setSearchTerm] = useState('');

    if (!data || data.length === 0) return null;

    // Sort by recent and filter by search term
    const filteredData = data.filter(run =>
        (run.run_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (run.plan_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.month_key).getTime() - new Date(a.month_key).getTime());

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Certificado': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
            case 'Fallado': return <XCircle className="w-4 h-4 text-rose-500" />;
            case 'Bloqueado': return <AlertTriangle className="w-4 h-4 text-orange-500" />;
            case 'En Progreso': return <PlayCircle className="w-4 h-4 text-blue-500" />;
            default: return <Clock className="w-4 h-4 text-gray-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Certificado': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'Fallado': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            case 'Bloqueado': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'En Progreso': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            default: return 'bg-gray-800 text-gray-400 border-gray-700';
        }
    };

    return (
        <div className="bg-[#111827] border border-gray-800 rounded-lg overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-[#1f2937]/50">
                <h3 className="text-sm font-medium text-white tracking-wide flex items-center gap-2">
                    <PlayCircle className="w-4 h-4 text-blue-400" />
                    DETALLE DE EJECUCIÓN POR CICLOS (RUNS)
                </h3>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-3 h-3 text-gray-500 absolute left-2 top-2.5" />
                        <input
                            type="text"
                            placeholder="Buscar ciclo o plan..."
                            className="bg-gray-900 border border-gray-700 text-xs rounded pl-7 pr-3 py-2 border-gray-700 focus:outline-none focus:border-blue-500 text-gray-300 w-48 transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <span className="text-xs text-gray-500 font-mono">
                        {filteredData.length} CICLOS
                    </span>
                </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
                {filteredData.map((run, idx) => {
                    const chartData = [
                        { name: 'Pasados', value: Number(run.passed_count) || 0, color: '#10b981' },
                        { name: 'Fallados', value: Number(run.failed_count) || 0, color: '#f43f5e' },
                        { name: 'Bloqueados', value: Number(run.blocked_count) || 0, color: '#f97316' },
                        { name: 'En Progreso', value: (Number(run.process_count) || 0) + (Number(run.retest_count) || 0), color: '#3b82f6' },
                        { name: 'Sin Probar', value: Number(run.untested_count) || 0, color: '#6b7280' }
                    ].filter(item => item.value > 0);

                    return (
                        <div key={`${run.run_id}-${idx}`} className="bg-[#1a2235] border border-gray-800 rounded p-4 flex flex-col justify-between hover:border-gray-600 transition-colors group">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 pr-4">
                                    <h4 className="text-sm text-gray-200 font-medium line-clamp-2 leading-tight" title={run.run_name}>{run.run_name}</h4>
                                    <p className="text-[10px] text-gray-500 font-mono mt-1 line-clamp-1" title={run.plan_name}>PLAN: {run.plan_name}</p>
                                    <p className="text-[10px] text-purple-400/70 font-mono line-clamp-1">{run.project_name}</p>
                                </div>
                                <div className={clsx("flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] whitespace-nowrap", getStatusColor(run.run_status))}>
                                    {getStatusIcon(run.run_status)}
                                    <span className="font-mono font-bold uppercase tracking-wider">{run.run_status}</span>
                                </div>
                            </div>

                            <div className="flex items-center mt-2 pt-2 border-t border-gray-800/80">
                                <div className="w-16 h-16 shrink-0 relative transition-transform group-hover:scale-105">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData}
                                                innerRadius={18}
                                                outerRadius={30}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '4px', padding: '4px 8px', fontSize: '10px' }}
                                                itemStyle={{ color: '#fff' }}
                                                cursor={false}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-[10px] text-gray-400 font-mono">{run.total_tests}</span>
                                    </div>
                                </div>
                                <div className="flex-1 pl-4 grid grid-cols-2 gap-1 gap-x-2">
                                    {chartData.map((item, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                                            <span className="text-[10px] text-gray-400 font-mono truncate">{item.name}: <span className="text-gray-200">{item.value}</span></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
