'use client';

import { useState, useMemo } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    Cell,
    ZAxis,
} from 'recharts';

interface TimelineData {
    month_key: string;
    uat_cert_clean: number;
    uat_cert_defects: number;
    uat_in_process: number;
}

interface Props {
    data: TimelineData[];
}

// Expand monthly summary into individual scatter points for a dispersion view
function expandToPoints(data: TimelineData[]) {
    const cleanPoints: any[] = [];
    const defectPoints: any[] = [];
    const inProcessPoints: any[] = [];

    // Sort months
    const sorted = [...data].sort((a, b) => a.month_key.localeCompare(b.month_key));
    const monthIndex = (m: string) => sorted.findIndex(d => d.month_key === m);

    sorted.forEach((row, idx) => {
        const xBase = idx;
        // For each certification unit, create a point with slight Y-jitter for visual dispersion
        for (let i = 0; i < row.uat_cert_clean; i++) {
            cleanPoints.push({
                x: xBase,
                y: i + 1,
                month: row.month_key,
                type: 'Certificada Limpia',
                total_month: row.uat_cert_clean + row.uat_cert_defects,
                idx: i,
                z: 400,
            });
        }
        for (let i = 0; i < row.uat_cert_defects; i++) {
            defectPoints.push({
                x: xBase,
                y: i + 1,
                month: row.month_key,
                type: 'Con Incidentes en QA',
                total_month: row.uat_cert_clean + row.uat_cert_defects,
                idx: i,
                z: 400,
            });
        }
        for (let i = 0; i < row.uat_in_process; i++) {
            inProcessPoints.push({
                x: xBase,
                y: i + 1,
                month: row.month_key,
                type: 'En Proceso',
                total_month: row.uat_in_process,
                idx: i,
                z: 350,
            });
        }
    });

    return { cleanPoints, defectPoints, inProcessPoints, sorted };
}

const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    const typeColor = d.type === 'Certificada Limpia' ? '#10b981' : d.type === 'Con Incidentes en QA' ? '#F59E0B' : '#8A9CD3';
    return (
        <div style={{
            background: '#ffffff',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
            padding: '14px 16px',
            boxShadow: '0 4px 16px rgba(0,51,160,0.12)',
            minWidth: '220px',
            fontSize: '12px',
            fontFamily: 'var(--font-inter)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #E2E8F0' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: typeColor, display: 'inline-block' }} />
                <span style={{ color: '#0033A0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.type}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
                    <span style={{ color: '#8499B8' }}>Mes</span>
                    <span style={{ color: '#0033A0', fontWeight: 700 }}>{d.month}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
                    <span style={{ color: '#8499B8' }}>Cert. ese mes</span>
                    <span style={{ color: '#0033A0', fontWeight: 700 }}>{d.total_month}</span>
                </div>
                {d.type !== 'En Proceso' && (
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #E2E8F0' }}>
                        <span style={{
                            fontSize: '10px',
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            background: d.type === 'Certificada Limpia' ? '#D1FAE5' : '#FEF3C7',
                            color: d.type === 'Certificada Limpia' ? '#065F46' : '#92400E',
                        }}>
                            {d.type === 'Certificada Limpia' ? '✓ Sin incidentes en QA' : '⚠ Con fallos previos en QA'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function UatTimelineChart({ data }: Props) {
    const [highlightType, setHighlightType] = useState<string | null>(null);

    if (!data || data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-xs border-dashed rounded-xl"
                style={{ color: 'var(--text-muted)', border: '2px dashed var(--border-light)', background: 'var(--bg-page)' }}>
                Sin datos históricos de UAT
            </div>
        );
    }

    const { cleanPoints, defectPoints, inProcessPoints, sorted } = useMemo(
        () => expandToPoints(data),
        [data]
    );

    const totalCertified = cleanPoints.length + defectPoints.length;
    const totalClean = cleanPoints.length;
    const qualityRate = totalCertified > 0 ? ((totalClean / totalCertified) * 100).toFixed(1) : '0';

    const xTicks = sorted.map((_, i) => i);
    const formatXTick = (idx: number) => sorted[idx]?.month_key || '';

    return (
        <div className="rounded-xl p-6 w-full"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-start mb-6">
                <div>
                    <h3 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>
                        Evolución de Certificaciones UAT
                    </h3>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        Dispersión temporal · Cada punto = 1 solución certificada
                    </p>
                </div>

                {/* Summary Stats */}
                <div className="flex items-center gap-4 mt-4 md:mt-0">
                    {[
                        { label: 'Limpias', value: totalClean, color: '#059669' },
                        { label: 'Con Incidentes', value: defectPoints.length, color: '#D97706' },
                        { label: 'En Proceso', value: inProcessPoints.length, color: '#8A9CD3' },
                    ].map(s => (
                        <div key={s.label} className="text-center">
                            <div className="text-2xl font-mono font-bold" style={{ color: s.color }}>{s.value}</div>
                            <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{s.label}</div>
                        </div>
                    ))}
                    <div className="text-center px-3 py-2 rounded-lg"
                        style={{ background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' }}>
                        <div className="text-xl font-mono font-bold" style={{ color: 'var(--sura-blue-dark)' }}>{qualityRate}%</div>
                        <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>Calidad</div>
                    </div>
                </div>
            </div>

            {/* Legend / Filter */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                {[
                    { id: 'clean', label: 'Limpias (Sin Defectos)', color: '#10b981', key: 'Certificada Limpia' },
                    { id: 'defect', label: 'Con Incidentes en QA', color: '#F59E0B', key: 'Con Incidentes en QA' },
                    { id: 'process', label: 'En Proceso', color: '#8A9CD3', key: 'En Proceso' },
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setHighlightType(highlightType === item.key ? null : item.key)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium uppercase transition-all"
                        style={highlightType === item.key ? {
                            border: `1px solid ${item.color}`,
                            background: `${item.color}18`,
                            color: item.color
                        } : {
                            border: '1px solid var(--border-light)',
                            background: 'var(--bg-page)',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                        {item.label}
                    </button>
                ))}
                {highlightType && (
                    <button
                        onClick={() => setHighlightType(null)}
                        className="text-[10px] underline"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        Ver todo
                    </button>
                )}
            </div>

            {/* Scatter Chart */}
            <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                            type="number"
                            dataKey="x"
                            domain={[-0.5, sorted.length - 0.5]}
                            ticks={xTicks}
                            tickFormatter={formatXTick}
                            stroke="#8499B8"
                            fontSize={10}
                            fontFamily="var(--font-inter)"
                            tickMargin={8}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            type="number"
                            dataKey="y"
                            domain={[0, 'dataMax + 1']}
                            stroke="#8499B8"
                            fontSize={10}
                            fontFamily="var(--font-inter)"
                            axisLine={false}
                            tickLine={false}
                            label={{
                                value: 'Certificaciones',
                                angle: -90,
                                position: 'insideLeft',
                                fill: '#8499B8',
                                fontSize: 10,
                                fontFamily: 'var(--font-inter)',
                            }}
                            allowDecimals={false}
                        />
                        <ZAxis dataKey="z" range={[120, 400]} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#DFEAFF' }} />

                        {/* Reference lines between months */}
                        {xTicks.slice(0, -1).map((x) => (
                            <ReferenceLine key={x} x={x + 0.5} stroke="#E2E8F0" strokeDasharray="2 4" />
                        ))}

                        {/* Clean certifications */}
                        <Scatter
                            name="Certificadas Limpias"
                            data={highlightType && highlightType !== 'Certificada Limpia' ? [] : cleanPoints}
                            fill="#10b981"
                            opacity={highlightType === 'Certificada Limpia' || !highlightType ? 1 : 0.2}
                        >
                            {cleanPoints.map((_, index) => (
                                <Cell key={index} fill="#10b981" />
                            ))}
                        </Scatter>

                        {/* Defect certifications */}
                        <Scatter
                            name="Con Incidentes en QA"
                            data={highlightType && highlightType !== 'Con Incidentes en QA' ? [] : defectPoints}
                            fill="#f59e0b"
                            shape="triangle"
                            opacity={highlightType === 'Con Incidentes en QA' || !highlightType ? 1 : 0.2}
                        >
                            {defectPoints.map((_, index) => (
                                <Cell key={index} fill="#f59e0b" />
                            ))}
                        </Scatter>

                        {/* In process */}
                        <Scatter
                            name="En Proceso"
                            data={highlightType && highlightType !== 'En Proceso' ? [] : inProcessPoints}
                            fill="#6366f1"
                            shape="square"
                            opacity={highlightType === 'En Proceso' || !highlightType ? 1 : 0.2}
                        >
                            {inProcessPoints.map((_, index) => (
                                <Cell key={index} fill="#6366f1" />
                            ))}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            {/* Footnote */}
            <p className="text-[9px] mt-3 text-center uppercase tracking-wider"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                ● Verde = Certificación limpia &nbsp;|&nbsp;
                ▲ Ámbar = Con incidentes en QA &nbsp;|&nbsp;
                ■ Azul = En Proceso
            </p>
        </div>
    );
}
