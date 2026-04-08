
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

// Sura-brand semantic color mappings (light mode)
const statusConfig = {
    green: {
        value: '#059669',
        badge: { background: '#D1FAE5', color: '#065F46', border: '#6EE7B7' },
        bar: '#10B981',
    },
    red: {
        value: '#DC2626',
        badge: { background: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
        bar: '#EF4444',
    },
    yellow: {
        value: '#D97706',
        badge: { background: '#FEF3C7', color: '#92400E', border: '#FDE68A' },
        bar: '#F59E0B',
    },
    blue: {
        value: '#2D6DF6',
        badge: { background: '#DFEAFF', color: '#0033A0', border: '#93C5FD' },
        bar: '#2D6DF6',
    },
    gray: {
        value: '#4A6390',
        badge: { background: '#F8F8F8', color: '#4A6390', border: '#E2E8F0' },
        bar: '#8A9CD3',
    },
};

export default function MetricCard({
    label,
    value,
    subValue,
    className,
    trend,
    trendValue,
    statusColor = 'gray'
}: MetricCardProps) {
    const cfg = statusConfig[statusColor];

    return (
        <div className={twMerge(
            "relative group overflow-hidden rounded-xl p-5 transition-all duration-300",
            className
        )}
            style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                boxShadow: '0 1px 4px rgba(0,51,160,0.06)',
            }}
        >
            {/* Top accent bar (Sura blue) */}
            <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl transition-all"
                style={{ background: cfg.bar, opacity: 0.7 }} />

            {/* Subtle hover lift */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-xl"
                style={{ boxShadow: '0 4px 16px rgba(45,109,246,0.10)' }} />

            <div className="flex flex-col h-full justify-between relative z-10 pt-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2"
                    style={{ color: 'var(--text-secondary)', letterSpacing: '0.1em' }}>
                    {label}
                </h3>

                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-mono font-semibold tracking-tight"
                        style={{ color: cfg.value }}>
                        {value}
                    </span>
                    {subValue && (
                        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                            {subValue}
                        </span>
                    )}
                </div>

                {(trend || trendValue) && (
                    <div className="flex items-center gap-1 mt-3">
                        {trend === 'up' && <ArrowUpRight className="w-3 h-3" style={{ color: statusConfig.green.value }} />}
                        {trend === 'down' && <ArrowDownRight className="w-3 h-3" style={{ color: statusConfig.red.value }} />}
                        {trend === 'neutral' && <Minus className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />}

                        {trendValue && (
                            <span className="text-xs font-mono" style={{
                                color: trend === 'up' ? statusConfig.green.value :
                                    trend === 'down' ? statusConfig.red.value : 'var(--text-muted)'
                            }}>
                                {trendValue}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
