'use client';

import { useEffect, useState, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
    Scatter,
    ScatterChart,
    ZAxis,
    ComposedChart,
    Area,
} from 'recharts';

// Project color palette
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

interface DemandRow {
    project_id: number;
    project_name: string;
    month_key: string;
    year: number;
    analyst_count: number;
    test_count: number;
    analyst_names: string;
}

export default function ProjectDemandChart() {
    const [rawData, setRawData] = useState<DemandRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState<string>('all');

    useEffect(() => {
        fetch('/api/data?type=demand')
            .then((res) => res.json())
            .then((json) => {
                setRawData(json.data || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Available years for filter
    const years = useMemo(() => {
        const ySet = new Set<number>();
        rawData.forEach((r) => ySet.add(Number(r.year)));
        return Array.from(ySet).sort();
    }, [rawData]);

    // Filter by year
    const filteredData = useMemo(() => {
        if (selectedYear === 'all') return rawData;
        return rawData.filter((r) => String(r.year) === selectedYear);
    }, [rawData, selectedYear]);

    // Pivot: one row per month_key, columns = project analyst_count
    const { chartData, projects } = useMemo(() => {
        const projectSet = new Set<string>();
        const monthMap = new Map<string, Record<string, number | string>>();

        // Collect all months
        for (const row of filteredData) {
            const projName = row.project_name;
            projectSet.add(projName);

            if (!monthMap.has(row.month_key)) {
                monthMap.set(row.month_key, { month: row.month_key });
            }
            const entry = monthMap.get(row.month_key)!;
            entry[projName] = Number(row.analyst_count);
            // Store test count for tooltip
            entry[`${projName}_tests`] = Number(row.test_count);
            entry[`${projName}_names`] = row.analyst_names || '';
        }

        // Sort by month
        const sorted = Array.from(monthMap.values()).sort((a, b) =>
            String(a.month).localeCompare(String(b.month))
        );

        return { chartData: sorted, projects: Array.from(projectSet).sort() };
    }, [filteredData]);

    // Color map
    const colorMap = useMemo(() => {
        const m: Record<string, string> = {};
        projects.forEach((p, i) => {
            m[p] = PROJECT_COLORS[i % PROJECT_COLORS.length];
        });
        return m;
    }, [projects]);

    // Scatter data for the combined view
    const scatterData = useMemo(() => {
        return filteredData.map((row) => ({
            month: row.month_key,
            project: row.project_name,
            analysts: Number(row.analyst_count),
            tests: Number(row.test_count),
            names: row.analyst_names,
            color: colorMap[row.project_name] || '#6b7280',
        }));
    }, [filteredData, colorMap]);

    if (loading) {
        return (
            <div className="bg-[#111827] border border-gray-800 rounded-lg p-6">
                <h3 className="text-xs font-mono uppercase text-gray-500 mb-4">
                    Demanda de Analistas por Proyecto
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
                    Demanda de Analistas por Proyecto
                </h3>
                <div className="flex items-center justify-center h-[200px] text-gray-600 text-sm font-mono">
                    Sin datos de demanda
                </div>
            </div>
        );
    }

    // Custom Tooltip for the line chart
    const CustomLineTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const items = payload.filter((p: any) => p.value > 0);
        return (
            <div className="bg-[#1f2937] border border-gray-700 rounded-lg p-3 shadow-xl text-sm max-w-xs">
                <p className="font-mono text-white font-bold mb-2 border-b border-gray-600 pb-1">{label}</p>
                {items.map((entry: any, i: number) => {
                    const testKey = `${entry.dataKey}_tests`;
                    const namesKey = `${entry.dataKey}_names`;
                    const tests = entry.payload?.[testKey] || 0;
                    const names = entry.payload?.[namesKey] || '';
                    return (
                        <div key={i} className="mb-1.5">
                            <div className="flex justify-between gap-3 text-gray-300">
                                <span className="flex items-center gap-1.5">
                                    <span
                                        className="w-2 h-2 rounded-full inline-block shrink-0"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="truncate max-w-[150px]">{entry.name}</span>
                                </span>
                                <span className="font-mono font-bold text-white shrink-0">
                                    {entry.value} {entry.value === 1 ? 'analista' : 'analistas'}
                                </span>
                            </div>
                            <div className="text-[10px] text-gray-500 pl-3.5">
                                {tests} casos · {names}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Custom Tooltip for scatter
    const CustomScatterTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const data = payload[0]?.payload;
        if (!data) return null;
        return (
            <div className="bg-[#1f2937] border border-gray-700 rounded-lg p-3 shadow-xl text-sm">
                <p className="font-mono text-white font-bold mb-1">{data.project}</p>
                <p className="text-gray-400 text-xs mb-2">{data.month}</p>
                <div className="space-y-1 text-gray-300">
                    <div className="flex justify-between gap-4">
                        <span>Analistas:</span>
                        <span className="font-mono font-bold text-indigo-400">{data.analysts}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span>Casos:</span>
                        <span className="font-mono font-bold text-cyan-400">{data.tests}</span>
                    </div>
                </div>
                {data.names && (
                    <p className="text-[10px] text-gray-500 mt-2 border-t border-gray-600 pt-1">
                        {data.names}
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className="bg-[#111827] border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-xs font-mono uppercase text-gray-500">
                        Demanda de Analistas por Proyecto
                    </h3>
                    <p className="text-[10px] text-gray-600 mt-0.5 font-mono">
                        Evolución del uso de analistas en el tiempo
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 font-mono uppercase">Año:</span>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="bg-[#0d1117] border border-gray-700 text-gray-300 text-xs font-mono rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    >
                        <option value="all">Todos</option>
                        {years.map((y) => (
                            <option key={y} value={String(y)}>
                                {y}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Line Chart */}
            <div className="mb-6">
                <p className="text-[10px] text-gray-600 font-mono uppercase mb-2">
                    Línea de Tendencia — Analistas asignados por mes
                </p>
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis
                            dataKey="month"
                            tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
                            axisLine={{ stroke: '#374151' }}
                        />
                        <YAxis
                            tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
                            axisLine={{ stroke: '#374151' }}
                            label={{
                                value: 'Analistas',
                                angle: -90,
                                position: 'insideLeft',
                                style: { fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' },
                            }}
                            allowDecimals={false}
                        />
                        <Tooltip content={<CustomLineTooltip />} />
                        <Legend
                            wrapperStyle={{ fontSize: 10, fontFamily: 'monospace' }}
                            iconType="circle"
                            iconSize={7}
                        />
                        {projects.map((proj) => (
                            <Line
                                key={proj}
                                type="monotone"
                                dataKey={proj}
                                stroke={colorMap[proj]}
                                strokeWidth={2}
                                dot={{ r: 4, fill: colorMap[proj], strokeWidth: 0 }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls={false}
                            />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Scatter Plot — Bubble chart: x=month, y=analysts, size=tests */}
            <div className="mb-6">
                <p className="text-[10px] text-gray-600 font-mono uppercase mb-2">
                    Dispersión — Tamaño proporcional a casos de prueba
                </p>
                <ResponsiveContainer width="100%" height={280}>
                    <ScatterChart margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis
                            dataKey="month"
                            type="category"
                            tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
                            axisLine={{ stroke: '#374151' }}
                            allowDuplicatedCategory={false}
                        />
                        <YAxis
                            dataKey="analysts"
                            type="number"
                            tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
                            axisLine={{ stroke: '#374151' }}
                            label={{
                                value: 'Analistas',
                                angle: -90,
                                position: 'insideLeft',
                                style: { fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' },
                            }}
                            allowDecimals={false}
                        />
                        <ZAxis dataKey="tests" range={[40, 400]} />
                        <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#374151' }} />
                        <Scatter data={scatterData} fill="#6366f1">
                            {scatterData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            {/* Summary Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                    <thead>
                        <tr className="border-b border-gray-800 text-gray-500 uppercase">
                            <th className="text-left py-2 px-2">Mes</th>
                            <th className="text-left py-2 px-2">Proyecto</th>
                            <th className="text-right py-2 px-2">Analistas</th>
                            <th className="text-right py-2 px-2">Casos</th>
                            <th className="text-left py-2 px-2">Equipo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData
                            .sort((a, b) => a.month_key.localeCompare(b.month_key) || Number(b.analyst_count) - Number(a.analyst_count))
                            .map((row, i) => (
                                <tr
                                    key={i}
                                    className="border-b border-gray-800/50 hover:bg-white/5 transition-colors"
                                >
                                    <td className="py-2 px-2 text-gray-400">{row.month_key}</td>
                                    <td className="py-2 px-2">
                                        <span className="flex items-center gap-1.5">
                                            <span
                                                className="w-2 h-2 rounded-full inline-block shrink-0"
                                                style={{ backgroundColor: colorMap[row.project_name] || '#6b7280' }}
                                            />
                                            <span className="text-gray-300 truncate max-w-[200px]">{row.project_name}</span>
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                        <span className="text-indigo-400 font-bold">{Number(row.analyst_count)}</span>
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                        <span className="text-cyan-400 font-bold">{Number(row.test_count)}</span>
                                    </td>
                                    <td className="py-2 px-2 text-gray-500 truncate max-w-[180px]">
                                        {row.analyst_names || '—'}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
