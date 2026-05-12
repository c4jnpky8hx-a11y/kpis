
'use client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

interface ChartProps {
    data: any[];
}

// ── Sura-brand color palette ────────────────────────────────────────────────
const COLORS = {
    passed:     '#10B981', // Green — Certificados
    failed:     '#EF4444', // Red — Fallados
    blocked:    '#F59E0B', // Amber — Bloqueados
    untested:   '#B4B4B5', // Sura Gray — Sin Probar
    retest:     '#8A9CD3', // Sura Periwinkle — En Progreso (run-level)
    reprueba:   '#A855F7', // Purple — Reprueba (caso/ciclo en re-ejecucion)
    backlog:    '#94A3B8', // Slate — Backlog (no ha llegado fecha)
    pendientes: '#FB923C', // Orange — Pendientes (fecha llegó, 0% ejecución)
};

const COLORS_STATUS: Record<string, string> = {
    'Abierto':     '#EF4444',
    'En Progreso': '#F59E0B',
    'Listo':       '#2D6DF6', // Azul SURA
    'Cerrado':     '#10B981',
};

// ── Shared tooltip (light theme) ────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: '#ffffff',
                border: '1px solid #E2E8F0',
                padding: '8px 12px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,51,160,0.10)',
            }}>
                <p style={{ color: '#4A6390', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</p>
                <p style={{ color: '#0033A0', fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {payload[0]?.value || 0}
                </p>
            </div>
        );
    }
    return null;
};

// ── Shared axis/grid style (light) ──────────────────────────────────────────
const axisStyle = { stroke: '#8499B8', fontSize: 10, fontFamily: 'var(--font-inter)' };
const gridColor = '#E2E8F0';

// ── StatusPieChart ───────────────────────────────────────────────────────────
export function StatusPieChart({ data }: ChartProps) {
    if (!data || data.length === 0) return (
        <div style={{ color: '#8499B8', fontSize: '12px', textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)' }}>
            Sin datos disponibles
        </div>
    );

    const sums = data.reduce((acc, row) => ({
        Passed:     acc.Passed     + (Number(row.runs_passed)      || 0),
        Failed:     acc.Failed     + (Number(row.runs_failed)      || 0),
        Blocked:    acc.Blocked    + (Number(row.runs_blocked)     || 0),
        Retest:     acc.Retest     + (Number(row.runs_retest)      || 0),
        InProgress: acc.InProgress + (Number(row.runs_in_progress) || 0),
        Backlog:    acc.Backlog    + (Number(row.runs_backlog)     || 0),
        Pendientes: acc.Pendientes + (Number(row.runs_pending)    || 0),
    }), { Passed: 0, Failed: 0, Blocked: 0, Retest: 0, InProgress: 0, Backlog: 0, Pendientes: 0 });

    const chartData = [
        { name: 'Certificados', value: sums.Passed,     color: COLORS.passed     },
        { name: 'Fallados',     value: sums.Failed,     color: COLORS.failed     },
        { name: 'Bloqueados',   value: sums.Blocked,    color: COLORS.blocked    },
        { name: 'Reprueba',     value: sums.Retest,     color: COLORS.reprueba   },
        { name: 'En Progreso',  value: sums.InProgress, color: COLORS.retest     },
        { name: 'Pendientes',   value: sums.Pendientes, color: COLORS.pendientes },
        { name: 'Backlog',      value: sums.Backlog,    color: COLORS.backlog    },
    ].filter(d => d.value > 0);

    const total = chartData.reduce((acc, cur) => acc + cur.value, 0);

    return (
        <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ fontSize: '12px', fontFamily: 'var(--font-inter)', color: '#4A6390' }}
                        iconSize={8}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                    />
                </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pr-28">
                <div style={{ fontSize: '32px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0033A0' }}>{total}</div>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#8499B8', letterSpacing: '0.12em' }}>Total Ciclos</div>
            </div>
        </div>
    );
}

// ── DefectsBarChart ──────────────────────────────────────────────────────────
export function DefectsBarChart({ data }: ChartProps) {
    if (!data || data.length === 0) return (
        <div style={{ color: '#8499B8', fontSize: '12px', textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)' }}>
            Sin datos disponibles
        </div>
    );

    const priorityMap: Record<string, string> = {
        'Crítica': 'Crítico', 'Alta': 'Alto', 'Media': 'Medio', 'Baja': 'Bajo',
    };
    const sums: Record<string, number> = { Crítico: 0, Alto: 0, Medio: 0, Bajo: 0 };
    data.forEach((row: any) => {
        const label = priorityMap[row.priority];
        if (label) sums[label] += 1;
    });

    const barColors: Record<string, string> = {
        Crítico: '#EF4444',
        Alto:    '#F59E0B',
        Medio:   '#2D6DF6',
        Bajo:    '#10B981',
    };

    const chartData = Object.entries(sums).map(([name, value]) => ({ name, value, fill: barColors[name] }));

    return (
        <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" {...axisStyle} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" {...axisStyle} tickLine={false} axisLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#DFEAFF', opacity: 0.5 }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// ── DefectsStatusChart ───────────────────────────────────────────────────────
export function DefectsStatusChart({ data }: ChartProps) {
    if (!data || data.length === 0) return (
        <div style={{ color: '#8499B8', fontSize: '12px', textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)' }}>
            Sin datos disponibles
        </div>
    );

    const statusMap: Record<string, string> = {
        'Backlog': 'Abierto', 'Esperando Aprobación': 'Abierto',
        'Desarrollo': 'En Progreso', 'Probando': 'En Progreso', 'Analisis': 'En Progreso', 'En Diseño': 'En Progreso',
        'Listo para Probar': 'Listo',
        'Terminado': 'Cerrado', 'Cerrado': 'Cerrado', 'Cancelado': 'Cerrado', 'Mitigado': 'Cerrado',
    };

    const sums: Record<string, number> = { Abierto: 0, 'En Progreso': 0, Listo: 0, Cerrado: 0 };
    data.forEach((row: any) => {
        const group = statusMap[row.status] || 'Abierto';
        sums[group] += 1;
    });

    const chartData = Object.entries(sums).map(([name, value]) => ({ name, value }));
    const total = chartData.reduce((a, b) => a + b.value, 0);

    return (
        <div className="h-[200px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_STATUS[entry.name] || '#B4B4B5'} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-inter)', color: '#4A6390' }}
                        iconSize={8}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pr-24">
                <div style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0033A0' }}>{total}</div>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#8499B8', letterSpacing: '0.12em' }}>Defectos</div>
            </div>
        </div>
    );
}

// ── VelocityAreaChart ────────────────────────────────────────────────────────
export function VelocityAreaChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) return (
        <div style={{ color: '#8499B8', fontSize: '12px', textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)' }}>
            Sin datos disponibles
        </div>
    );

    return (
        <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#2D6DF6" stopOpacity={0.18} />
                            <stop offset="95%" stopColor="#2D6DF6" stopOpacity={0}    />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="date" {...axisStyle} tickLine={false} axisLine={false} />
                    <YAxis {...axisStyle} tickLine={false} axisLine={false} />
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2D6DF6', strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="count" stroke="#2D6DF6" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ── AutomationDonutChart ─────────────────────────────────────────────────────
export function AutomationDonutChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) return (
        <div style={{ color: '#8499B8', fontSize: '12px', textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)' }}>
            Sin datos disponibles
        </div>
    );

    const COLORS_AUTO: Record<string, string> = {
        'Automatizado': '#00AEC7', // Sura Aqua
        'Manual':       '#B4B4B5', // Sura Gray
    };

    const chartData = data.map(d => ({
        name: d.type,
        value: d.count,
        color: COLORS_AUTO[d.type] || '#B4B4B5'
    }));

    const totalVal = chartData.reduce((a, b) => a + b.value, 0);
    const autoPct = Math.round((chartData.find(d => d.name === 'Automatizado')?.value || 0) / totalVal * 100);

    return (
        <div className="h-[200px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-inter)', color: '#4A6390' }}
                        iconSize={8}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pr-24">
                <div style={{ fontSize: '20px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#00AEC7' }}>{autoPct}%</div>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#8499B8', letterSpacing: '0.12em' }}>Auto</div>
            </div>
        </div>
    );
}

// ── DelayBarChart ────────────────────────────────────────────────────────────
export function DelayBarChart({ data }: ChartProps) {
    if (!data || data.length === 0) return (
        <div style={{ color: '#8499B8', fontSize: '12px', textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-mono)' }}>
            Sin datos disponibles
        </div>
    );

    let totalDelayed = 0;
    let totalOnTime = 0;
    data.forEach(row => {
        if (row.entrega_desarrollo_tardia > 0) totalDelayed += 1;
        else if (row.entrega_desarrollo_tardia === 0) totalOnTime += 1;
    });

    const chartData = [
        { name: 'A Tiempo', value: totalOnTime,  fill: '#10B981' },
        { name: 'Tardía',   value: totalDelayed,  fill: '#F59E0B' },
    ].filter(d => d.value > 0);

    return (
        <div className="h-[200px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }} barSize={50}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="name" {...axisStyle} tickLine={false} axisLine={false} />
                    <YAxis {...axisStyle} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#DFEAFF', opacity: 0.5 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
