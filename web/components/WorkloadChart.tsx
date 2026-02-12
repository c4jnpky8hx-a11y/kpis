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
            <div className="bg-[#111827] border border-gray-800 rounded-lg p-6">
                <h3 className="text-xs font-mono uppercase text-gray-500 mb-4">
                    Carga de Trabajo por Analista
                </h3>
                <div className="flex items-center justify-center h-[300px] text-gray-500 text-sm font-mono">
                    Cargando...
                </div>
            </div>
        );
    }

    if (!chartData.length) {
        return (
            <div className="bg-[#111827] border border-gray-800 rounded-lg p-6">
                <h3 className="text-xs font-mono uppercase text-gray-500 mb-4">
                    Carga de Trabajo por Analista
                </h3>
                <div className="flex items-center justify-center h-[200px] text-gray-600 text-sm font-mono">
                    Sin datos de asignación
                </div>
            </div>
        );
    }

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const items = payload.filter((p: any) => p.value > 0);
        const total = items.reduce((s: number, p: any) => s + p.value, 0);
        return (
            <div className="bg-[#1f2937] border border-gray-700 rounded-lg p-3 shadow-xl text-sm">
                <p className="font-mono text-white font-bold mb-2">{label}</p>
                {items.map((entry: any, i: number) => (
                    <div key={i} className="flex justify-between gap-4 text-gray-300">
                        <span className="flex items-center gap-2">
                            <span
                                className="w-2.5 h-2.5 rounded-full inline-block"
                                style={{ backgroundColor: entry.color }}
                            />
                            {entry.name}
                        </span>
                        <span className="font-mono font-bold">{entry.value}</span>
                    </div>
                ))}
                <div className="border-t border-gray-600 mt-2 pt-2 flex justify-between text-white font-bold">
                    <span>Total</span>
                    <span className="font-mono">{total}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-[#111827] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono uppercase text-gray-500">
                    Carga de Trabajo por Analista
                </h3>
                <span className="text-xs font-mono text-gray-600">
                    {chartData.length} analistas · {projects.length} proyectos
                </span>
            </div>

            <ResponsiveContainer width="100%" height={Math.max(250, chartData.length * 50)}>
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                    <XAxis
                        type="number"
                        tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
                        axisLine={{ stroke: '#374151' }}
                    />
                    <YAxis
                        type="category"
                        dataKey="analyst_name"
                        width={120}
                        tick={{ fill: '#d1d5db', fontSize: 11, fontFamily: 'monospace' }}
                        axisLine={{ stroke: '#374151' }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Legend
                        wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }}
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
            <div className="mt-6 overflow-x-auto">
                <table className="w-full text-xs font-mono">
                    <thead>
                        <tr className="border-b border-gray-800 text-gray-500 uppercase">
                            <th className="text-left py-2 px-2">Analista</th>
                            <th className="text-left py-2 px-2">Proyecto</th>
                            <th className="text-right py-2 px-2">Total</th>
                            <th className="text-right py-2 px-2">Activos</th>
                            <th className="text-right py-2 px-2">Pasados</th>
                            <th className="text-right py-2 px-2">Fallidos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rawData
                            .sort((a, b) => Number(b.total_assigned) - Number(a.total_assigned))
                            .map((row, i) => (
                                <tr
                                    key={i}
                                    className="border-b border-gray-800/50 hover:bg-white/5 transition-colors"
                                >
                                    <td className="py-2 px-2 text-gray-300">{row.analyst_name}</td>
                                    <td className="py-2 px-2">
                                        <span className="flex items-center gap-1.5">
                                            <span
                                                className="w-2 h-2 rounded-full inline-block"
                                                style={{ backgroundColor: colorMap[row.project_name] || '#6b7280' }}
                                            />
                                            <span className="text-gray-400">{row.project_name}</span>
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 text-right text-white font-bold">
                                        {Number(row.total_assigned)}
                                    </td>
                                    <td className="py-2 px-2 text-right text-amber-400">
                                        {Number(row.active_cases)}
                                    </td>
                                    <td className="py-2 px-2 text-right text-emerald-400">
                                        {Number(row.passed_cases)}
                                    </td>
                                    <td className="py-2 px-2 text-right text-rose-400">
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
