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
    return (
        <div className="bg-[#1f2937] border border-gray-600 rounded-lg p-4 shadow-2xl min-w-[220px] text-xs font-mono">
            <div className="flex items-center gap-2 mb-3 border-b border-gray-700 pb-2">
                <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{
                        backgroundColor:
                            d.type === 'Certificada Limpia' ? '#10b981' :
                                d.type === 'Con Incidentes en QA' ? '#f59e0b' : '#6366f1',
                    }}
                />
                <span className="text-white font-bold uppercase tracking-wide">{d.type}</span>
            </div>
            <div className="space-y-1.5">
                <div className="flex justify-between gap-6">
                    <span className="text-gray-400">Mes</span>
                    <span className="text-white font-bold">{d.month}</span>
                </div>
                <div className="flex justify-between gap-6">
                    <span className="text-gray-400">Certificaciones ese mes</span>
                    <span className="text-white font-bold">{d.total_month}</span>
                </div>
                {d.type !== 'En Proceso' && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${d.type === 'Certificada Limpia'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/20 text-amber-400'
                            }`}>
                            {d.type === 'Certificada Limpia'
                                ? '✓ Sin incidentes detectados en QA'
                                : '⚠ Tuvo fallos detectados en QA antes de certificar'}
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
            <div className="h-64 flex items-center justify-center text-gray-500 font-mono text-xs border border-gray-800 border-dashed rounded bg-[#111827]/50">
                NO HAY DATOS HISTÓRICOS DE UAT
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
        <div className="bg-[#111827] border border-gray-800 rounded-lg p-6 w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-start mb-6">
                <div>
                    <h3 className="text-sm font-medium text-white tracking-wide">
                        EVOLUCIÓN DE CERTIFICACIONES UAT
                    </h3>
                    <p className="text-[10px] font-mono text-gray-500 mt-1 uppercase">
                        Dispersión temporal de certificaciones · Cada punto = 1 solución certificada
                    </p>
                </div>

                {/* Summary Stats */}
                <div className="flex items-center gap-6 mt-4 md:mt-0">
                    <div className="text-center">
                        <div className="text-2xl font-mono font-bold text-emerald-400">{totalClean}</div>
                        <div className="text-[9px] font-mono text-gray-500 uppercase">Limpias</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-mono font-bold text-amber-400">{defectPoints.length}</div>
                        <div className="text-[9px] font-mono text-gray-500 uppercase">Con Incidentes</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-mono font-bold text-indigo-400">{inProcessPoints.length}</div>
                        <div className="text-[9px] font-mono text-gray-500 uppercase">En Proceso</div>
                    </div>
                    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-center">
                        <div className="text-xl font-mono font-bold text-white">{qualityRate}%</div>
                        <div className="text-[9px] font-mono text-gray-500 uppercase">Calidad</div>
                    </div>
                </div>
            </div>

            {/* Legend / Filter */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                {[
                    { id: 'clean', label: 'Limpias (Sin Defectos)', color: '#10b981', key: 'Certificada Limpia' },
                    { id: 'defect', label: 'Con Incidentes en QA', color: '#f59e0b', key: 'Con Incidentes en QA' },
                    { id: 'process', label: 'En Proceso', color: '#6366f1', key: 'En Proceso' },
                ].map(item => (
                    <button
                        key={item.id}
                        onClick={() => setHighlightType(highlightType === item.key ? null : item.key)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded border text-[10px] font-mono uppercase transition-all ${highlightType === item.key
                                ? 'border-white/50 bg-white/10 text-white'
                                : 'border-gray-700 bg-transparent text-gray-400 hover:border-gray-500 hover:text-gray-300'
                            }`}
                    >
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
                        {item.label}
                    </button>
                ))}
                {highlightType && (
                    <button
                        onClick={() => setHighlightType(null)}
                        className="text-[10px] font-mono text-gray-600 hover:text-gray-400 underline"
                    >
                        Ver todo
                    </button>
                )}
            </div>

            {/* Scatter Chart */}
            <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis
                            type="number"
                            dataKey="x"
                            domain={[-0.5, sorted.length - 0.5]}
                            ticks={xTicks}
                            tickFormatter={formatXTick}
                            stroke="#4B5563"
                            fontSize={10}
                            fontFamily="monospace"
                            tickMargin={8}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            type="number"
                            dataKey="y"
                            domain={[0, 'dataMax + 1']}
                            stroke="#4B5563"
                            fontSize={10}
                            fontFamily="monospace"
                            axisLine={false}
                            tickLine={false}
                            label={{
                                value: 'Certificaciones',
                                angle: -90,
                                position: 'insideLeft',
                                fill: '#6B7280',
                                fontSize: 10,
                                fontFamily: 'monospace',
                            }}
                            allowDecimals={false}
                        />
                        <ZAxis dataKey="z" range={[120, 400]} />
                        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3', stroke: '#374151' }} />

                        {/* Reference lines between months */}
                        {xTicks.slice(0, -1).map((x) => (
                            <ReferenceLine key={x} x={x + 0.5} stroke="#1f2937" strokeDasharray="2 4" />
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
            <p className="text-[9px] font-mono text-gray-600 mt-3 text-center uppercase tracking-wider">
                ● Círculo Verde = Certificación limpia &nbsp;|&nbsp;
                ▲ Triángulo Ámbar = Con incidentes detectados en QA &nbsp;|&nbsp;
                ■ Cuadro Índigo = En Proceso
            </p>
        </div>
    );
}
