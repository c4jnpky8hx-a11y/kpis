
'use client';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

interface ChartProps {
    data: any[];
}

const COLORS = {
    passed: '#10B981', // Emerald 500
    failed: '#F43F5E', // Rose 500
    blocked: '#F59E0B', // Amber 500
    untested: '#374151', // Gray 700
    retest: '#8B5CF6'  // Violet 500
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0B0F14] border border-gray-800 p-2 rounded shadow-xl">
                <p className="text-gray-400 text-xs uppercase mb-1">{label}</p>
                <p className="text-white text-sm font-mono font-bold">
                    {payload[0]?.value || 0}
                </p>
            </div>
        );
    }
    return null;
};

export function StatusPieChart({ data }: ChartProps) {
    if (!data || data.length === 0) return <div className="text-gray-600 text-xs text-center py-10 font-mono">NO HAY DATOS DISPONIBLES</div>;

    const sums = data.reduce((acc, row) => ({
        Passed: acc.Passed + (row.total_passed || 0),
        Failed: acc.Failed + (row.failed_count || 0),
        Blocked: acc.Blocked + (row.total_blocked || 0),
        Untested: acc.Untested + (row.total_untested || 0),
        Retest: acc.Retest + (row.total_returned_cases || 0)
    }), { Passed: 0, Failed: 0, Blocked: 0, Untested: 0, Retest: 0 });

    const chartData = [
        { name: 'Exitosos', value: sums.Passed, color: COLORS.passed },
        { name: 'Fallidos', value: sums.Failed, color: COLORS.failed },
        { name: 'Bloqueados', value: sums.Blocked, color: COLORS.blocked },
        { name: 'Devueltos', value: sums.Retest, color: COLORS.retest },
        { name: 'Sin Probar', value: sums.Untested, color: COLORS.untested },
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
                        wrapperStyle={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                        iconSize={8}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                    />
                </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pr-28">
                <div className="text-3xl font-mono font-bold text-white">{total}</div>
                <div className="text-[10px] uppercase text-gray-500 tracking-widest">Total Pruebas</div>
            </div>
        </div>
    );
}

export function DefectsBarChart({ data }: ChartProps) {
    if (!data || data.length === 0) return <div className="text-gray-600 text-xs text-center py-10 font-mono">NO HAY DATOS DISPONIBLES</div>;

    // Map Jira priority names to display labels
    const priorityMap: Record<string, string> = {
        'Crítica': 'Critico',
        'Alta': 'Alto',
        'Media': 'Medio',
        'Baja': 'Bajo',
    };

    const sums: Record<string, number> = { Critico: 0, Alto: 0, Medio: 0, Bajo: 0 };
    data.forEach((row: any) => {
        const label = priorityMap[row.priority];
        if (label) sums[label] += 1;
    });

    const chartData = Object.entries(sums)
        .map(([name, value]) => ({ name, value }));

    return (
        <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
                    <XAxis type="number" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} fontFamily="var(--font-mono)" />
                    <YAxis dataKey="name" type="category" stroke="#9CA3AF" fontSize={11} tickLine={false} axisLine={false} width={60} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1F2937', opacity: 0.4 }} />
                    <Bar dataKey="value" fill="#F43F5E" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

export function DefectsStatusChart({ data }: ChartProps) {
    if (!data || data.length === 0) return <div className="text-gray-600 text-xs text-center py-10 font-mono">NO HAY DATOS DISPONIBLES</div>;

    // Group Jira statuses into dashboard categories
    const statusMap: Record<string, string> = {
        'Backlog': 'Abierto',
        'Esperando Aprobación': 'Abierto',
        'Desarrollo': 'En Progreso',
        'Probando': 'En Progreso',
        'Analisis': 'En Progreso',
        'En Diseño': 'En Progreso',
        'Listo para Probar': 'Listo',
        'Terminado': 'Cerrado',
        'Cerrado': 'Cerrado',
        'Cancelado': 'Cerrado',
        'Mitigado': 'Cerrado',
    };

    const sums: Record<string, number> = { Abierto: 0, 'En Progreso': 0, Listo: 0, Cerrado: 0 };
    data.forEach((row: any) => {
        const group = statusMap[row.status] || 'Abierto';
        sums[group] += 1;
    });

    const chartData = Object.entries(sums)
        .map(([name, value]) => ({ name, value }));

    const COLORS_STATUS: Record<string, string> = {
        'Abierto': '#EF4444', // Red 500
        'En Progreso': '#F59E0B', // Amber 500
        'Listo': '#3B82F6', // Blue 500
        'Cerrado': '#10B981' // Emerald 500
    };

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
                            <Cell key={`cell-${index}`} fill={COLORS_STATUS[entry.name] || '#6B7280'} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
                        iconSize={8}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pr-24">
                <div className="text-xl font-mono font-bold text-white">
                    {total}
                </div>
                <div className="text-[9px] uppercase text-gray-500 tracking-widest">DEFECTOS</div>
            </div>
        </div>
    );
}
export function VelocityAreaChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <div className="text-gray-600 text-xs text-center py-10 font-mono">NO HAY DATOS DISPONIBLES</div>;

    return (
        <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} fontFamily="var(--font-mono)" />
                    <YAxis stroke="#4B5563" fontSize={10} tickLine={false} axisLine={false} fontFamily="var(--font-mono)" />
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" vertical={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3B82F6', strokeWidth: 1 }} />
                    <Area type="monotone" dataKey="count" stroke="#3B82F6" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export function AutomationDonutChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) return <div className="text-gray-600 text-xs text-center py-10 font-mono">NO HAY DATOS DISPONIBLES</div>;

    const COLORS_AUTO = {
        'Automatizado': '#8B5CF6', // Violet
        'Manual': '#374151'      // Gray
    };

    const chartData = data.map(d => ({
        name: d.type,
        value: d.count,
        color: COLORS_AUTO[d.type as keyof typeof COLORS_AUTO] || '#9CA3AF'
    }));

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
                        wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}
                        iconSize={8}
                        layout="vertical"
                        verticalAlign="middle"
                        align="right"
                    />
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none pr-24">
                <div className="text-xl font-mono font-bold text-white">
                    {Math.round((chartData.find(d => d.name === 'Automatizado')?.value || 0) / (chartData.reduce((a, b) => a + b.value, 0)) * 100)}%
                </div>
                <div className="text-[9px] uppercase text-gray-500 tracking-widest">AUTO</div>
            </div>
        </div>
    );
}
