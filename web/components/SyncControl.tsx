import { useState, useEffect } from 'react';
import { RefreshCw, Terminal, X, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function SyncControl() {
    const [syncing, setSyncing] = useState(false);
    const [logs, setLogs] = useState('');
    const [showLogs, setShowLogs] = useState(false);
    const [syncState, setSyncState] = useState<any[]>([]);

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/sync/status');
                if (res.ok) {
                    const json = await res.json();
                    setSyncState(json.data || []);
                }
            } catch (e) {
                console.error(e);
            }
        };
        fetchStatus();
        const intervalStatus = setInterval(fetchStatus, 30000);
        return () => clearInterval(intervalStatus);
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (syncing) {
            interval = setInterval(checkLogs, 2000);
        }
        return () => clearInterval(interval);
    }, [syncing]);

    const checkLogs = async () => {
        try {
            const res = await fetch('/api/sync');
            if (!res.ok) return;
            const data = await res.json();
            setLogs(data.logs);
            if (!data.running && syncing) {
                setSyncing(false);
                fetch('/api/sync/status').then(r => r.json()).then(d => setSyncState(d.data || []));
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
        checkLogs();
    };

    const hasErrors = syncState.some(s => s.status === 'ERROR');
    const isRunning = syncState.some(s => s.status === 'SYNCING') || syncing;
    const latestSync = syncState.length > 0
        ? new Date(Math.max(...syncState.map(s => {
            const d = s.last_sync_ts?.value || s.last_sync_ts;
            return d ? new Date(d).getTime() : 0;
        })))
        : null;

    return (
        <div className="border-t border-gray-800 pt-6 mt-6">
            <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">

                {/* Sync Audit Status */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[#111827] border border-gray-800 rounded px-4 py-3 w-full md:w-auto shadow-sm">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-mono uppercase mb-1">Auditoria de Sincronizacion BigQuery</span>
                        <div className="flex items-center gap-2">
                            {hasErrors ? (
                                <AlertTriangle className="w-4 h-4 text-rose-500" />
                            ) : isRunning ? (
                                <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                            <span className={clsx(
                                "text-xs font-mono font-bold uppercase tracking-wide",
                                hasErrors ? "text-rose-400" : isRunning ? "text-blue-400" : "text-emerald-400"
                            )}>
                                {hasErrors ? 'ERRORES DETECTADOS URGENTE' : isRunning ? 'SINCRONIZANDO...' : 'DATOS ACTUALIZADOS CORRECTAMENTE'}
                            </span>
                        </div>
                    </div>
                    {latestSync && latestSync.getTime() > 0 && (
                        <div className="sm:ml-4 sm:pl-4 sm:border-l border-gray-700 flex flex-col w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 mt-2 sm:mt-0">
                            <span className="text-[10px] text-gray-500 font-mono uppercase mb-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Ultima Carga
                            </span>
                            <span className="text-xs text-gray-300 font-mono capitalize">
                                Hace {formatDistanceToNow(latestSync, { locale: es })}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center w-full md:w-auto justify-end gap-3">
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className="text-gray-500 hover:text-gray-300 font-mono text-[10px] uppercase"
                    >
                        {showLogs ? 'Ocultar Logs' : 'Ver Logs'}
                    </button>
                    <button
                        onClick={startSync}
                        disabled={syncing || isRunning}
                        className={clsx(
                            "flex items-center gap-2 px-4 py-2 rounded text-xs font-mono uppercase tracking-wider transition-all border",
                            (syncing || isRunning)
                                ? "bg-blue-500/10 border-blue-500/30 text-blue-400 cursor-not-allowed"
                                : "bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
                        )}
                    >
                        <RefreshCw className={clsx("w-3 h-3", (syncing || isRunning) && "animate-spin")} />
                        {(syncing || isRunning) ? 'PROCESANDO...' : 'INICIAR SINCRONIZACION'}
                    </button>
                </div>
            </div>

            {showLogs && (
                <div className="bg-[#0b0f19] border border-gray-800 rounded p-0 overflow-hidden font-mono text-[10px] shadow-inner mt-4">
                    <div className="flex items-center justify-between px-3 py-1 bg-gray-900 border-b border-gray-800">
                        <span className="text-gray-400 flex items-center gap-2">
                            <Terminal className="w-3 h-3" />
                            SYNC_VERBOSE_LOGS.TXT
                        </span>
                        <button onClick={() => setShowLogs(false)} className="text-gray-500 hover:text-rose-400 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-4 h-48 overflow-y-auto text-emerald-500/80 leading-relaxed font-light">
                        <pre className="whitespace-pre-wrap">{logs || '> Inicializando conexion con el motor de sincronizacion TestRail -> BigQuery...'}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
