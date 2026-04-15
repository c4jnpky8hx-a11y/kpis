'use client';

import { Download } from 'lucide-react';

interface CsvExportProps {
    data: Record<string, unknown>[];
    filename: string;
    columns?: { key: string; label: string }[];
}

export function exportToCsv(data: Record<string, unknown>[], filename: string, columns?: { key: string; label: string }[]) {
    if (!data.length) return;

    const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }));
    const header = cols.map(c => `"${c.label}"`).join(',');
    const rows = data.map(row =>
        cols.map(c => {
            const val = row[c.key];
            const str = val == null ? '' : String(val).replace(/"/g, '""');
            return `"${str}"`;
        }).join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function CsvExportButton({ data, filename, columns }: CsvExportProps) {
    return (
        <button
            onClick={() => exportToCsv(data, filename, columns)}
            disabled={!data.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono uppercase rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
            title="Exportar a CSV"
        >
            <Download size={12} />
            CSV
        </button>
    );
}
