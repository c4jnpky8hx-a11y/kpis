'use client';

import { useEffect, useState, useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
} from 'recharts';

// Project color palette — vibrant and distinct
const PROJECT_COLORS = [
    '#6366f1', // indigo
    '#22d3ee', // cyan
    '#f59e0b', // amber
    '#ec4899', // pink
    '#10b981', // emerald
    '#8b5cf6', // violet
    '#f97316', // orange
    '#14b8a6', // teal
    '#e11d48', // rose
    '#3b82f6', // blue
    '#84cc16', // lime
    '#a855f7', // purple
];

interface WorkloadRow {
    assignedto_id: number;
    analyst_name: string;
    project_id: number;
    project_name: string;
    total_assigned: number;
    active_cases: number;
    passed_cases: number;
    failed_cases: number;
    blocked_cases: number;
    untested_cases: number;
    retest_cases: number;
}

interface AnalystData {
    analyst_name: string;
    total: number;
    [key: string]: string | number; // dynamic project keys
}

export default function WorkloadChart() {
    const [rawData, setRawData] = useState<WorkloadRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/data?type=workload')
            .then((res) => res.json())
            .then((json) => {
                setRawData(json.data || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Transform: pivot from analyst+project rows → one row per analyst with project columns
    const { chartData, projects } = useMemo(() => {
        const projectSet = new Set<string>();
        const analystMap = new Map<string, AnalystData>();

        for (const row of rawData) {
            const name = row.analyst_name;
            const projKey = row.project_name;
            projectSet.add(projKey);

            if (!analystMap.has(name)) {
                analystMap.set(name, { analyst_name: name, total: 0 });
            }
            const entry = analystMap.get(name)!;
            entry[projKey] = (Number(entry[projKey]) || 0) + Number(row.total_assigned);
            entry.total += Number(row.total_assigned);
        }

        // Sort by total descending
        const sorted = Array.from(analystMap.values()).sort((a, b) => b.total - a.total);
        return { chartData: sorted, projects: Array.from(projectSet) };
    }, [rawData]);

    // Color map for projects
    const colorMap = useMemo(() => {
        const m: Record<string, string> = {};
        projects.forEach((p, i) => {
            m[p] = PROJECT_COLORS[i % PROJECT_COLORS.length];
        });
        return m;
    }, [projects]);

    if (loading) {
        return (
            <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <h3 className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                    Carga de Trabajo por Analista
                </h3>
                <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: 'var(--sura-blue)' }}>
                    Cargando...
                </div>
            </div>
        );
    }

    if (!chartData.length) {
        return (
            <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <h3 className="text-xs font-semibold uppercase mb-4" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                    Carga de Trabajo por Analista
                </h3>
                <div className="flex items-center justify-center h-[200px] text-sm" style={{ color: 'var(--text-muted)' }}>
                    Sin datos de asignación
                </div>
            </div>
        );
    }

    // Custom tooltip — Sura light theme
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const items = payload.filter((p: any) => p.value > 0);
        const total = items.reduce((s: number, p: any) => s + p.value, 0);
        return (
            <div style={{
                background: '#ffffff', border: '1px solid #E2E8F0',
                borderRadius: '10px', padding: '12px 14px',
                boxShadow: '0 4px 16px rgba(0,51,160,0.10)', fontSize: '12px'
            }}>
                <p style={{ color: '#0033A0', fontWeight: 700, marginBottom: '8px' }}>{label}</p>
                {items.map((entry: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: '#4A6390', marginBottom: '4px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color, display: 'inline-block' }} />
                            {entry.name}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{entry.value}</span>
                    </div>
                ))}
                <div style={{ borderTop: '1px solid #E2E8F0', marginTop: '8px', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', color: '#0033A0', fontWeight: 700 }}>
                    <span>Total</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{total}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="rounded-xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
                    Carga de Trabajo por Analista
                </h3>
                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {chartData.length} analistas · {projects.length} proyectos
                </span>
            </div>

            <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 50)}>
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                    <XAxis
                        type="number"
                        tick={{ fill: '#8499B8', fontSize: 11, fontFamily: 'var(--font-inter)' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        type="category"
                        dataKey="analyst_name"
                        width={120}
                        tick={{ fill: '#4A6390', fontSize: 11, fontFamily: 'var(--font-inter)' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(45,109,246,0.05)' }} />
                    <Legend
                        wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-inter)', color: '#4A6390' }}
                        iconType="circle"
                        iconSize={8}
                    />
                    {projects.map((proj) => (
                        <Bar
                            key={proj}
                            dataKey={proj}
                            stackId="a"
                            fill={colorMap[proj]}
                            radius={0}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>

            {/* Detail Table */}
            <div className="mt-6 overflow-x-auto" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <table className="w-full text-xs">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                            {['Analista', 'Proyecto', 'Total', 'Activos', 'Pasados', 'Fallidos'].map((h, i) => (
                                <th key={h} className={`py-2 px-2 font-semibold uppercase ${i >= 2 ? 'text-right' : 'text-left'}`}
                                    style={{ color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.08em' }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rawData
                            .sort((a, b) => Number(b.total_assigned) - Number(a.total_assigned))
                            .map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-blue-tint)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <td className="py-2 px-2" style={{ color: 'var(--text-body)' }}>{row.analyst_name}</td>
                                    <td className="py-2 px-2">
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colorMap[row.project_name] || '#B4B4B5', display: 'inline-block' }} />
                                            <span style={{ color: 'var(--text-secondary)' }}>{row.project_name}</span>
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 text-right font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        {Number(row.total_assigned)}
                                    </td>
                                    <td className="py-2 px-2 text-right" style={{ color: '#D97706', fontFamily: 'var(--font-mono)' }}>
                                        {Number(row.active_cases)}
                                    </td>
                                    <td className="py-2 px-2 text-right" style={{ color: '#059669', fontFamily: 'var(--font-mono)' }}>
                                        {Number(row.passed_cases)}
                                    </td>
                                    <td className="py-2 px-2 text-right" style={{ color: '#DC2626', fontFamily: 'var(--font-mono)' }}>
                                        {Number(row.failed_cases)}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
