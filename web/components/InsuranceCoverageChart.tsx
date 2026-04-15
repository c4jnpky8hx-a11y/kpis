'use client';

import { useEffect, useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
    PieChart, Pie, Legend,
} from 'recharts';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import CsvExportButton from './CsvExport';

const PROCESS_COLORS: Record<string, string> = {
    'Emisión y Cotización': '#3b82f6',
    'Pagos y Cobranza': '#10b981',
    'Siniestros e Indemnizaciones': '#f59e0b',
    'Comisiones y Corredores': '#8b5cf6',
    'Core de Seguros (INSIS)': '#ec4899',
    'Portal Digital y Autogestión': '#22d3ee',
    'Data Warehouse y Analítica': '#f97316',
    'Cancelaciones y Operaciones': '#14b8a6',
    'Automatización y Regresión': '#84cc16',
    'UAT y Certificación': '#6366f1',
    'Sin Clasificar': '#4b5563',
};

// Standard insurance processes in Panama that SHOULD be tested
const EXPECTED_PROCESSES = [
    'Emisión y Cotización',
    'Pagos y Cobranza',
    'Siniestros e Indemnizaciones',
    'Comisiones y Corredores',
    'Core de Seguros (INSIS)',
    'Portal Digital y Autogestión',
    'Data Warehouse y Analítica',
    'Cancelaciones y Operaciones',
    'Reaseguro',
    'Renovaciones',
    'Endosos y Modificaciones',
    'Cumplimiento y Regulación',
];

interface CoverageRow {
    insurance_process: string;
    total_tests: number;
    unique_cases: number;
    total_runs: number;
    projects_involved: number;
    passed: number;
    failed: number;
    other_status: number;
    projects: string;
    first_test: { value: string };
    last_test: { value: string };
}

export default function InsuranceCoverageChart() {
    const [data, setData] = useState<CoverageRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/data?type=insurance_coverage')
            .then(r => r.json())
            .then(json => {
                if (json.data) setData(json.data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    // Gap analysis: which expected processes are missing?
    const { chartData, pieData, missingProcesses, totalTests } = useMemo(() => {
        const existing = new Set(data.map(d => d.insurance_process));
        const missing = EXPECTED_PROCESSES.filter(p => !existing.has(p));

        const barData = data
            .filter(d => d.insurance_process !== 'Sin Clasificar')
            .sort((a, b) => b.total_tests - a.total_tests)
            .map(d => ({
                name: d.insurance_process,
                tests: d.total_tests,
                cases: d.unique_cases,
                runs: d.total_runs,
                passed: d.passed,
                failed: d.failed,
                projects: d.projects,
                color: PROCESS_COLORS[d.insurance_process] || '#6b7280',
            }));

        const pie = data
            .filter(d => d.insurance_process !== 'Sin Clasificar')
            .map(d => ({
                name: d.insurance_process,
                value: d.total_tests,
                color: PROCESS_COLORS[d.insurance_process] || '#6b7280',
            }));

        const total = data.reduce((s, d) => s + d.total_tests, 0);

        return { chartData: barData, pieData: pie, missingProcesses: missing, totalTests: total };
    }, [data]);

    const unclassified = data.find(d => d.insurance_process === 'Sin Clasificar');

    if (loading) {
        return (
            <div className="rounded-lg p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                <div className="flex items-center justify-center h-[300px] text-sm font-mono animate-pulse" style={{ color: 'var(--text-muted)' }}>
                    ANALIZANDO COBERTURA DE PROCESOS...
                </div>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0]?.payload;
        if (!d) return null;
        return (
            <div className="rounded-lg p-4 shadow-xl text-xs font-mono min-w-[250px]" style={{ background: '#ffffff', border: '1px solid #E2E8F0' }}>
                <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                </div>
                <div className="space-y-1.5">
                    <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Tests</span><span style={{ color: 'var(--text-primary)' }} className="font-bold">{d.tests}</span></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Casos Únicos</span><span style={{ color: 'var(--text-primary)' }} className="font-bold">{d.cases}</span></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Ciclos</span><span style={{ color: 'var(--text-primary)' }} className="font-bold">{d.runs}</span></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Pasados</span><span className="font-bold" style={{ color: '#059669' }}>{d.passed}</span></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Fallidos</span><span className="font-bold" style={{ color: '#DC2626' }}>{d.failed}</span></div>
                </div>
                {d.projects && (
                    <div className="mt-2 pt-2 text-[10px]" style={{ borderTop: '1px solid #E2E8F0', color: 'var(--text-muted)' }}>
                        {d.projects}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="rounded-lg p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-start mb-6">
                <div>
                    <h3 className="text-sm font-medium tracking-wide flex items-center gap-2" style={{ color: 'var(--sura-blue-dark)' }}>
                        <ShieldCheck className="w-4 h-4" style={{ color: 'var(--sura-blue)' }} />
                        COBERTURA POR PROCESO DE SEGUROS
                    </h3>
                    <p className="text-[10px] font-mono mt-1 uppercase" style={{ color: 'var(--text-muted)' }}>
                        Clasificación automática de pruebas por dominio de negocio · {totalTests} tests analizados
                    </p>
                </div>
                <div className="flex items-center gap-3 mt-3 md:mt-0">
                    <div className="text-center">
                        <div className="text-2xl font-mono font-bold" style={{ color: 'var(--sura-blue)' }}>{chartData.length}</div>
                        <div className="text-[9px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>Procesos Cubiertos</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-mono font-bold" style={{ color: '#DC2626' }}>{missingProcesses.length}</div>
                        <div className="text-[9px] font-mono uppercase" style={{ color: 'var(--text-muted)' }}>Sin Cobertura</div>
                    </div>
                    <CsvExportButton data={data as unknown as Record<string, unknown>[]} filename="cobertura_procesos_seguros" />
                </div>
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Bar chart - 2 cols */}
                <div className="lg:col-span-2">
                    <p className="text-[10px] font-mono uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Tests por Proceso de Negocio</p>
                    <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                            <XAxis type="number" stroke="#8499B8" fontSize={10} tickLine={false} axisLine={false} fontFamily="monospace" />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={180}
                                tick={{ fill: '#4A6390', fontSize: 10, fontFamily: 'monospace' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-blue-tint)', opacity: 0.4 }} />
                            <Bar dataKey="tests" radius={[0, 4, 4, 0]} barSize={24}>
                                {chartData.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Donut chart - 1 col */}
                <div>
                    <p className="text-[10px] font-mono uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Distribución Proporcional</p>
                    <div className="h-[380px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={index} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: unknown) => [`${value} tests`, '']}
                                    contentStyle={{ backgroundColor: '#ffffff', borderColor: '#E2E8F0', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                                    itemStyle={{ color: 'var(--text-primary)' }}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace' }}
                                    iconSize={7}
                                    layout="vertical"
                                    verticalAlign="bottom"
                                    align="center"
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute top-[45%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <div className="text-2xl font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{totalTests}</div>
                            <div className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Total Tests</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Gap Analysis - Missing Processes */}
            {missingProcesses.length > 0 && (
                <div className="rounded-lg p-4 mb-6" style={{ background: '#FEE2E2', border: '1px solid #FECACA' }}>
                    <h4 className="text-xs font-mono uppercase mb-3 flex items-center gap-2" style={{ color: '#DC2626' }}>
                        <AlertTriangle className="w-4 h-4" />
                        PROCESOS SIN COBERTURA DE PRUEBAS
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {missingProcesses.map(proc => (
                            <div key={proc} className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#EF4444' }} />
                                <span className="text-[11px] font-mono" style={{ color: '#991B1B' }}>{proc}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] font-mono mt-3" style={{ color: '#DC2626' }}>
                        Estos procesos de seguros no tienen casos de prueba asociados. Evaluar si requieren cobertura de QA.
                    </p>
                </div>
            )}

            {/* Unclassified warning */}
            {unclassified && unclassified.total_tests > 0 && (
                <div className="rounded-lg p-3 mb-6" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: '#F59E0B' }} />
                        <span className="text-[11px] font-mono" style={{ color: '#D97706' }}>
                            {unclassified.total_tests} tests sin clasificar — requieren revisión de nombres para mejorar el análisis
                        </span>
                    </div>
                </div>
            )}

            {/* Detail table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                    <thead>
                        <tr className="uppercase" style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                            <th className="text-left py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Proceso</th>
                            <th className="text-right py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Tests</th>
                            <th className="text-right py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Casos</th>
                            <th className="text-right py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Ciclos</th>
                            <th className="text-right py-2 px-3" style={{ color: '#059669' }}>Pasados</th>
                            <th className="text-right py-2 px-3" style={{ color: '#DC2626' }}>Fallidos</th>
                            <th className="text-left py-2 px-3" style={{ color: 'var(--text-secondary)' }}>Proyectos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.sort((a, b) => b.total_tests - a.total_tests).map((row, i) => (
                            <tr key={i}
                                className="transition-colors"
                                style={{ borderBottom: '1px solid var(--border-light)', background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-blue-tint)')}
                                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)')}>
                                <td className="py-2 px-3">
                                    <span className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PROCESS_COLORS[row.insurance_process] || '#6b7280' }} />
                                        <span style={{ color: 'var(--text-body)' }}>{row.insurance_process}</span>
                                    </span>
                                </td>
                                <td className="py-2 px-3 text-right font-bold" style={{ color: 'var(--text-primary)' }}>{row.total_tests}</td>
                                <td className="py-2 px-3 text-right" style={{ color: 'var(--text-secondary)' }}>{row.unique_cases}</td>
                                <td className="py-2 px-3 text-right" style={{ color: 'var(--text-secondary)' }}>{row.total_runs}</td>
                                <td className="py-2 px-3 text-right" style={{ color: '#059669' }}>{row.passed}</td>
                                <td className="py-2 px-3 text-right" style={{ color: '#DC2626' }}>{row.failed}</td>
                                <td className="py-2 px-3 truncate max-w-[250px]" style={{ color: 'var(--text-muted)' }}>{row.projects}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
