function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return <div className={`animate-pulse rounded ${className || ''}`} style={{ background: 'var(--bg-gray-tint)', ...style }} />;
}

export function MetricCardSkeleton() {
    return (
        <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <Pulse className="h-3 w-24" />
            <Pulse className="h-10 w-16" />
            <Pulse className="h-2 w-20" />
        </div>
    );
}

export function ChartSkeleton({ height = 'h-[300px]' }: { height?: string }) {
    return (
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="flex justify-between mb-6">
                <Pulse className="h-4 w-48" />
                <Pulse className="h-4 w-24" />
            </div>
            <div className={`flex items-end gap-2 ${height}`}>
                {Array.from({ length: 8 }).map((_, i) => (
                    <Pulse
                        key={i}
                        className="flex-1 rounded-t"
                        style={{ height: `${30 + Math.random() * 60}%`, background: 'var(--bg-gray-tint)' }}
                    />
                ))}
            </div>
        </div>
    );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
            <div className="px-6 py-4 flex justify-between items-center" style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                <Pulse className="h-4 w-48" />
                <Pulse className="h-4 w-24" />
            </div>
            <div className="p-4 space-y-3">
                <div className="flex gap-6 pb-3" style={{ borderBottom: '1px solid var(--border-light)' }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Pulse key={i} className="h-3 flex-1" />
                    ))}
                </div>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex gap-6 py-2">
                        {Array.from({ length: 6 }).map((_, j) => (
                            <Pulse key={j} className="h-4 flex-1" />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function SidePanelSkeleton() {
    return (
        <div className="space-y-6">
            <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' }}>
                <Pulse className="h-3 w-32 mb-4" />
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                        <Pulse className="h-4 w-32" />
                        <Pulse className="h-6 w-12" />
                    </div>
                ))}
            </div>
            <div className="rounded-xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <Pulse className="h-3 w-40 mb-4" />
                <Pulse className="h-[120px] w-full" />
            </div>
        </div>
    );
}

export function FullDashboardSkeleton() {
    return (
        <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-5 gap-6">
                {Array.from({ length: 5 }).map((_, i) => (
                    <MetricCardSkeleton key={i} />
                ))}
            </div>
            <div className="col-span-12 lg:col-span-8">
                <ChartSkeleton height="h-[350px]" />
            </div>
            <div className="col-span-12 lg:col-span-4">
                <SidePanelSkeleton />
            </div>
            <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                {Array.from({ length: 3 }).map((_, i) => (
                    <ChartSkeleton key={i} height="h-[200px]" />
                ))}
            </div>
            <div className="col-span-12">
                <TableSkeleton rows={4} />
            </div>
        </div>
    );
}
