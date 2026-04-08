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

    const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' };
    const headingStyle = { color: 'var(--text-secondary)', letterSpacing: '0.08em' };
    const tooltipStyle = { background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', boxShadow: '0 4px 16px rgba(0,51,160,0.10)', fontSize: '12px' };

    if (loading) {
        return (
            <div className="rounded-xl p-6" style={cardStyle}>
                <h3 className="text-xs font-semibold uppercase mb-4" style={headingStyle}>Demanda de Analistas por Proyecto</h3>
                <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: 'var(--sura-blue)' }}>Cargando...</div>
            </div>
        );
    }

    if (!chartData.length) {
        return (
            <div className="rounded-xl p-6" style={cardStyle}>
                <h3 className="text-xs font-semibold uppercase mb-4" style={headingStyle}>Demanda de Analistas por Proyecto</h3>
                <div className="flex items-center justify-center h-[200px] text-sm" style={{ color: 'var(--text-muted)' }}>Sin datos de demanda</div>
            </div>
        );
    }

    // Custom Tooltip for the line chart
    const CustomLineTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const items = payload.filter((p: any) => p.value > 0);
        return (
            <div style={tooltipStyle}>
                <p style={{ color: '#0033A0', fontWeight: 700, marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #E2E8F0' }}>{label}</p>
                {items.map((entry: any, i: number) => {
                    const tests = entry.payload?.[`${entry.dataKey}_tests`] || 0;
                    const names = entry.payload?.[`${entry.dataKey}_names`] || '';
                    return (
                        <div key={i} style={{ marginBottom: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#4A6390' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color, display: 'inline-block', flexShrink: 0 }} />
                                    <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0033A0' }}>
                                    {entry.value} {entry.value === 1 ? 'analista' : 'analistas'}
                                </span>
                            </div>
                            <div style={{ fontSize: '10px', color: '#8499B8', paddingLeft: '14px' }}>{tests} casos · {names}</div>
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
            <div style={tooltipStyle}>
                <p style={{ color: '#0033A0', fontWeight: 700, marginBottom: '4px' }}>{data.project}</p>
                <p style={{ color: '#8499B8', fontSize: '11px', marginBottom: '8px' }}>{data.month}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#4A6390' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span>Analistas:</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#2D6DF6' }}>{data.analysts}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span>Casos:</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#00AEC7' }}>{data.tests}</span>
                    </div>
                </div>
                {data.names && (
                    <p style={{ fontSize: '10px', color: '#8499B8', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #E2E8F0' }}>{data.names}</p>
                )}
            </div>
        );
    };

    const axTick = { fill: '#8499B8', fontSize: 11, fontFamily: 'var(--font-inter)' };

    return (
        <div className="rounded-xl p-6" style={cardStyle}>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-xs font-semibold uppercase" style={headingStyle}>Demanda de Analistas por Proyecto</h3>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Evolución del uso de analistas en el tiempo</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>Año:</span>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="text-xs rounded px-2 py-1 outline-none"
                        style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)', color: 'var(--text-body)' }}
                    >
                        <option value="all">Todos</option>
                        {years.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Line Chart */}
            <div className="mb-6">
                <p className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                    Línea de Tendencia — Analistas asignados por mes
                </p>
                <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="month" tick={axTick} axisLine={false} tickLine={false} />
                        <YAxis tick={axTick} axisLine={false} tickLine={false}
                            label={{ value: 'Analistas', angle: -90, position: 'insideLeft', style: { fill: '#8499B8', fontSize: 10, fontFamily: 'var(--font-inter)' } }}
                            allowDecimals={false} />
                        <Tooltip content={<CustomLineTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 10, fontFamily: 'var(--font-inter)', color: '#4A6390' }} iconType="circle" iconSize={7} />
                        {projects.map((proj) => (
                            <Line key={proj} type="monotone" dataKey={proj} stroke={colorMap[proj]} strokeWidth={2}
                                dot={{ r: 4, fill: colorMap[proj], strokeWidth: 0 }}
                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls={false} />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Scatter Plot */}
            <div className="mb-6">
                <p className="text-[10px] uppercase mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                    Dispersión — Tamaño proporcional a casos de prueba
                </p>
                <ResponsiveContainer width="100%" height={280}>
                    <ScatterChart margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="month" type="category" tick={axTick} axisLine={false} tickLine={false} allowDuplicatedCategory={false} />
                        <YAxis dataKey="analysts" type="number" tick={axTick} axisLine={false} tickLine={false}
                            label={{ value: 'Analistas', angle: -90, position: 'insideLeft', style: { fill: '#8499B8', fontSize: 10, fontFamily: 'var(--font-inter)' } }}
                            allowDecimals={false} />
                        <ZAxis dataKey="tests" range={[40, 400]} />
                        <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#DFEAFF' }} />
                        <Scatter data={scatterData} fill="#2D6DF6">
                            {scatterData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            {/* Summary Table */}
            <div className="overflow-x-auto" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <table className="w-full text-xs">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                            {['Mes', 'Proyecto', 'Analistas', 'Casos', 'Equipo'].map((h, i) => (
                                <th key={h} className={`py-2 px-2 font-semibold uppercase ${i >= 2 && i <= 3 ? 'text-right' : 'text-left'}`}
                                    style={{ color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.08em' }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData
                            .sort((a, b) => a.month_key.localeCompare(b.month_key) || Number(b.analyst_count) - Number(a.analyst_count))
                            .map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-blue-tint)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <td className="py-2 px-2" style={{ color: 'var(--text-secondary)' }}>{row.month_key}</td>
                                    <td className="py-2 px-2">
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colorMap[row.project_name] || '#B4B4B5', display: 'inline-block', flexShrink: 0 }} />
                                            <span style={{ color: 'var(--text-body)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.project_name}</span>
                                        </span>
                                    </td>
                                    <td className="py-2 px-2 text-right font-bold" style={{ color: '#2D6DF6', fontFamily: 'var(--font-mono)' }}>{Number(row.analyst_count)}</td>
                                    <td className="py-2 px-2 text-right font-bold" style={{ color: '#00AEC7', fontFamily: 'var(--font-mono)' }}>{Number(row.test_count)}</td>
                                    <td className="py-2 px-2 truncate max-w-[180px]" style={{ color: 'var(--text-muted)' }}>{row.analyst_names || '—'}</td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
