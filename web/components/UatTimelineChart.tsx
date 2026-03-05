'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
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

export default function UatTimelineChart({ data }: Props) {
    if (!data || data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-gray-500 font-mono text-xs border border-gray-800 border-dashed rounded bg-[#111827]/50">
                NO HAY DATOS HISTORICOS DE UAT
            </div>
        );
    }

    // Define custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#1f2937] border border-gray-700 p-3 rounded shadow-xl min-w-[200px]">
                    <p className="text-gray-300 font-mono text-xs mb-2 border-b border-gray-700 pb-2">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex justify-between items-center py-1">
                            <span className="text-[10px] text-gray-400 font-mono uppercase truncate max-w-[150px]" style={{ color: entry.color }}>
                                {entry.name}
                            </span>
                            <span className="font-mono text-sm font-bold text-white ml-3">
                                {entry.value}
                            </span>
                        </div>
                    ))}
                    <div className="mt-2 pt-2 border-t border-gray-700 flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 font-mono uppercase">Total Mes</span>
                        <span className="font-mono text-sm font-bold text-gray-300">
                            {payload.reduce((sum: number, entry: any) => sum + entry.value, 0)}
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-[#111827] border border-gray-800 rounded-lg p-6 w-full">
            <div className="flex flex-col md:flex-row justify-between md:items-end mb-6">
                <div>
                    <h3 className="text-sm font-medium text-white tracking-wide">EVOLUCION DE CERTIFICACIONES UAT (12 MESES)</h3>
                    <p className="text-[10px] font-mono text-gray-500 mt-1 uppercase">Cantidad de soluciones certificadas por mes, identificando rechazos previos durante QA.</p>
                </div>

                {/* Custom Legend */}
                <div className="flex items-center gap-4 mt-4 md:mt-0 bg-[#1f2937]/50 px-3 py-1.5 rounded border border-gray-800">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></div>
                        <span className="text-[10px] font-mono text-gray-400 uppercase">Limpias (Sin Defectos)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm bg-amber-500"></div>
                        <span className="text-[10px] font-mono text-gray-400 uppercase">Con Incidentes Previos</span>
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                        barSize={40}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                        <XAxis
                            dataKey="month_key"
                            stroke="#6B7280"
                            fontSize={10}
                            tickMargin={10}
                            axisLine={false}
                            tickLine={false}
                            fontFamily="monaco, monospace"
                        />
                        <YAxis
                            stroke="#6B7280"
                            fontSize={10}
                            axisLine={false}
                            tickLine={false}
                            fontFamily="monaco, monospace"
                            allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1f2937', opacity: 0.4 }} />

                        <Bar dataKey="uat_cert_clean" name="Certificaciones Limpias" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="uat_cert_defects" name="Con Incidentes Previos" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
