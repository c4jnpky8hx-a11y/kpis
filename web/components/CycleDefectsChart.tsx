'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Bug } from 'lucide-react';

export default function CycleDefectsChart({ data }: { data: any[] }) {
    const chartData = useMemo(() => {
        return data
            .filter(d => (Number(d.Total_Defectos) || 0) > 0)
            .sort((a, b) => (Number(b.Total_Defectos) || 0) - (Number(a.Total_Defectos) || 0))
            .slice(0, 15)
            .map(d => ({
                name: String(d.Iniciativa || '').slice(0, 25) + (String(d.Iniciativa || '').length > 25 ? '...' : ''),
                fullName: d.Iniciativa,
                project: d.project_name,
                activos: Number(d.Defectos_Activos) || 0,
                cerrados: Number(d.Defectos_Cerrados) || 0,
                total: Number(d.Total_Defectos) || 0,
            }));
    }, [data]);

    if (!chartData.length) {
        return (
            <div className="flex items-center justify-center h-[200px] text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                Sin defectos asociados a ciclos
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0]?.payload;
        return (
            <div style={{ background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px', fontSize: '11px', fontFamily: 'monospace', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <p style={{ color: 'var(--sura-blue-dark)', fontWeight: 600, marginBottom: 6 }}>{d.fullName}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 9, marginBottom: 4 }}>{d.project}</p>
                <div style={{ display: 'flex', gap: 16 }}>
                    <span style={{ color: '#DC2626' }}>Activos: {d.activos}</span>
                    <span style={{ color: '#059669' }}>Cerrados: {d.cerrados}</span>
                </div>
            </div>
        );
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <Bug className="w-4 h-4" style={{ color: 'var(--sura-blue)' }} />
                <h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                    Defectos por Iniciativa
                </h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" stroke="#8499B8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" width={160} tick={{ fill: '#4A6390', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-blue-tint)', opacity: 0.5 }} />
                    <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }} />
                    <Bar dataKey="activos" name="Activos" stackId="a" fill="#EF4444" radius={[0, 0, 0, 0]} barSize={16} />
                    <Bar dataKey="cerrados" name="Cerrados" stackId="a" fill="#10B981" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
