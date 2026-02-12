
import { useState, useEffect } from 'react';
import { RefreshCw, Terminal, Activity, X } from 'lucide-react';
import { clsx } from 'clsx';

export default function SyncControl() {
    const [syncing, setSyncing] = useState(false);
    const [logs, setLogs] = useState('');
    const [showLogs, setShowLogs] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (syncing) {
            interval = setInterval(checkStatus, 2000);
        }
        return () => clearInterval(interval);
    }, [syncing]);

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/sync'); // Fixed endpoint
            if (!res.ok) {
                const text = await res.text();
                // Simple check to avoid polluting logs with 404 HTML if endpoint is missing temporarily
                if (!text.startsWith('<!DOCTYPE')) console.error("Sync Status Error:", text);
                return;
            }
            const data = await res.json();
            setLogs(data.logs);
            if (!data.running && syncing) {
                setSyncing(false);
            } else if (data.running && !syncing) {
                setSyncing(true);
            }
        } catch (e) {
            console.error("Poll Error:", e);
        }
    };

    const startSync = async () => {
        try {
            setSyncing(true);
            setShowLogs(true);
            const res = await fetch('/api/sync', { method: 'POST' });
            if (!res.ok) {
                const text = await res.text();
                console.error("Sync Trigger Failed:", text);
                setLogs(prev => prev + `\n[ERROR] Failed to start sync: ${res.status} ${res.statusText}\n`);
                setSyncing(false);
            }
        } catch (e) {
            console.error("Sync Network Error:", e);
            setSyncing(false);
        }
        checkStatus();
    };

    return (
        <div className="border-t border-gray-800 pt-6 mt-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">Estado del Sistema: En Linea</span>
                </div>

                <button
                    onClick={startSync}
                    disabled={syncing}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all border",
                        syncing
                            ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                            : "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                    )}
                >
                    <RefreshCw className={clsx("w-3 h-3", syncing && "animate-spin")} />
                    {syncing ? 'SINCRONIZANDO...' : 'INICIAR SINCRONIZACION'}
                </button>
            </div>

            {showLogs && (
                <div className="bg-[#000] border border-gray-800 rounded p-0 overflow-hidden font-mono text-[10px]">
                    <div className="flex items-center justify-between px-3 py-1 bg-gray-900 border-b border-gray-800">
                        <span className="text-gray-500 flex items-center gap-2">
                            <Terminal className="w-3 h-3" />
                            SYNC_LOGS.TXT
                        </span>
                        <button onClick={() => setShowLogs(false)} className="text-gray-500 hover:text-white">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="p-3 h-32 overflow-y-auto text-emerald-500/80 leading-relaxed">
                        <pre className="whitespace-pre-wrap">{logs || '> Initializing connection...'}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
