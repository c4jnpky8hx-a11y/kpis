
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface MetricCardProps {
    label: string;
    value: string | number;
    subValue?: string | number;
    className?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    statusColor?: 'green' | 'red' | 'yellow' | 'blue' | 'gray';
}

export default function MetricCard({
    label,
    value,
    subValue,
    className,
    trend,
    trendValue,
    statusColor = 'gray'
}: MetricCardProps) {

    const statusStyles = {
        green: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
        red: 'text-rose-400 border-rose-500/20 bg-rose-500/5',
        yellow: 'text-amber-400 border-amber-500/20 bg-amber-500/5',
        blue: 'text-blue-400 border-blue-500/20 bg-blue-500/5',
        gray: 'text-gray-400 border-gray-800 bg-gray-900',
    };

    return (
        <div className={twMerge(
            "relative group overflow-hidden rounded-lg border p-5 transition-all duration-300 hover:border-gray-700",
            "bg-[#111827] border-[rgba(255,255,255,0.04)]",
            className
        )}>
            {/* Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="flex flex-col h-full justify-between relative z-10">
                <h3 className="text-gray-500 text-[11px] font-bold uppercase tracking-wider font-inter mb-2">
                    {label}
                </h3>

                <div className="flex items-baseline gap-2">
                    <span className={clsx(
                        "text-4xl font-mono font-medium tracking-tight",
                        statusColor === 'green' ? 'text-emerald-400' :
                            statusColor === 'red' ? 'text-rose-400' :
                                statusColor === 'yellow' ? 'text-amber-400' :
                                    statusColor === 'blue' ? 'text-blue-400' : 'text-white'
                    )}>
                        {value}
                    </span>
                    {subValue && (
                        <span className="text-sm text-gray-500 font-mono">
                            / {subValue}
                        </span>
                    )}
                </div>

                {(trend || trendValue) && (
                    <div className="flex items-center gap-1 mt-3">
                        {trend === 'up' && <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
                        {trend === 'down' && <ArrowDownRight className="w-3 h-3 text-rose-500" />}
                        {trend === 'neutral' && <Minus className="w-3 h-3 text-gray-500" />}

                        {trendValue && (
                            <span className={clsx("text-xs font-mono",
                                trend === 'up' ? "text-emerald-500" :
                                    trend === 'down' ? "text-rose-500" : "text-gray-500"
                            )}>
                                {trendValue}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
