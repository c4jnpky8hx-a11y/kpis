import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PlayCircle, Clock, CheckCircle, AlertTriangle, XCircle, Search } from 'lucide-react';

export default function CycleDetailsCard({ data }: { data: any[] }) {
    const [searchTerm, setSearchTerm] = useState('');

    if (!data || data.length === 0) return null;

    const filteredData = data.filter(run =>
        (run.run_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (run.plan_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.month_key).getTime() - new Date(a.month_key).getTime());

    const getStatusStyle = (status: string): React.CSSProperties => {
        switch (status) {
            case 'Certificado': return { background: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' };
            case 'Fallado':     return { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' };
            case 'Bloqueado':   return { background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A' };
            case 'En Progreso': return { background: 'var(--bg-blue-tint)', color: 'var(--sura-blue)', border: '1px solid var(--border-blue)' };
            case 'Backlog':     return { background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' };
            case 'Pendiente':   return { background: '#FFF7ED', color: '#C2410C', border: '1px solid #FDBA74' };
            default:            return { background: 'var(--bg-gray-tint)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' };
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'Certificado': return <CheckCircle className="w-3.5 h-3.5" style={{ color: '#059669' }} />;
            case 'Fallado':     return <XCircle className="w-3.5 h-3.5" style={{ color: '#DC2626' }} />;
            case 'Bloqueado':   return <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#D97706' }} />;
            case 'En Progreso': return <PlayCircle className="w-3.5 h-3.5" style={{ color: 'var(--sura-blue)' }} />;
            case 'Backlog':     return <Clock className="w-3.5 h-3.5" style={{ color: '#475569' }} />;
            case 'Pendiente':   return <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#C2410C' }} />;
            default:            return <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />;
        }
    };

    return (
        <div className="rounded-xl overflow-hidden mt-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
            <div className="px-6 py-4 flex justify-between items-center"
                style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--sura-blue-dark)' }}>
                    <PlayCircle className="w-4 h-4" style={{ color: 'var(--sura-blue)' }} />
                    DETALLE DE EJECUCIÓN POR CICLOS (RUNS)
                </h3>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-3 h-3 absolute left-2 top-2.5" style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Buscar ciclo o plan..."
                            className="text-xs rounded pl-7 pr-3 py-2 w-48 outline-none transition-colors"
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
                        {filteredData.length} CICLOS
                    </span>
                </div>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto"
                style={{ background: 'var(--bg-page)' }}>
                {filteredData.map((run, idx) => {
                    const chartData = [
                        { name: 'Pasados',    value: Number(run.passed_count) || 0,  color: '#10b981' },
                        { name: 'Fallados',   value: Number(run.failed_count) || 0,  color: '#f43f5e' },
                        { name: 'Bloqueados', value: Number(run.blocked_count) || 0, color: '#f97316' },
                        { name: 'En Progreso',value: (Number(run.process_count) || 0) + (Number(run.retest_count) || 0), color: '#3b82f6' },
                        { name: 'Sin Probar', value: Number(run.untested_count) || 0, color: '#CBD5E1' }
                    ].filter(item => item.value > 0);

                    return (
                        <div key={`${run.run_id}-${idx}`}
                            className="rounded-lg p-4 flex flex-col justify-between transition-all"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--sura-blue)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(45,109,246,0.1)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}>
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1 pr-3">
                                    <h4 className="text-sm font-medium line-clamp-2 leading-tight" style={{ color: 'var(--text-body)' }} title={run.run_name}>
                                        {run.run_name}
                                    </h4>
                                    <p className="text-[10px] font-mono mt-1 line-clamp-1" style={{ color: 'var(--text-muted)' }} title={run.plan_name}>
                                        PLAN: {run.plan_name}
                                    </p>
                                    <p className="text-[10px] font-mono line-clamp-1" style={{ color: 'var(--sura-blue)' }}>
                                        {run.project_name}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 px-2 py-1 rounded text-[10px] whitespace-nowrap font-mono font-bold uppercase"
                                    style={getStatusStyle(run.run_status)}>
                                    {getStatusIcon(run.run_status)}
                                    <span>{run.run_status}</span>
                                </div>
                            </div>

                            <div className="flex items-center mt-2 pt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
                                <div className="w-16 h-16 shrink-0 relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={chartData} innerRadius={18} outerRadius={30} dataKey="value" stroke="none">
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '4px 8px', fontSize: '10px' }}
                                                itemStyle={{ color: '#0033A0' }}
                                                cursor={false}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>
                                            {run.total_tests}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 pl-4 grid grid-cols-2 gap-1 gap-x-2">
                                    {chartData.map((item, i) => (
                                        <div key={i} className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="text-[10px] font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                                                {item.name}: <span style={{ color: 'var(--text-body)', fontWeight: 600 }}>{item.value}</span>
                                            </span>
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
