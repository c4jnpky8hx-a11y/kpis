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
        <div className="pt-6 mt-2" style={{ borderTop: '1px solid var(--border-light)' }}>
            <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">

                {/* Sync Audit Status */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl px-4 py-3 w-full md:w-auto"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 1px 4px rgba(0,51,160,0.06)' }}>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-mono uppercase mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                            Auditoría de Sincronización BigQuery
                        </span>
                        <div className="flex items-center gap-2">
                            {hasErrors ? (
                                <AlertTriangle className="w-4 h-4" style={{ color: '#DC2626' }} />
                            ) : isRunning ? (
                                <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--sura-blue)' }} />
                            ) : (
                                <CheckCircle2 className="w-4 h-4" style={{ color: '#059669' }} />
                            )}
                            <span className="text-xs font-mono font-bold uppercase tracking-wide"
                                style={{ color: hasErrors ? '#DC2626' : isRunning ? 'var(--sura-blue)' : '#059669' }}>
                                {hasErrors ? 'Errores detectados — revisar urgente' : isRunning ? 'Sincronizando...' : 'Datos actualizados correctamente'}
                            </span>
                        </div>
                    </div>
                    {latestSync && latestSync.getTime() > 0 && (
                        <div className="sm:ml-4 sm:pl-4 flex flex-col w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 mt-2 sm:mt-0"
                            style={{ borderLeft: '1px solid var(--border-light)', borderColor: 'var(--border-light)' }}>
                            <span className="text-[10px] font-mono uppercase mb-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                <Clock className="w-3 h-3" /> Última carga
                            </span>
                            <span className="text-xs font-mono capitalize" style={{ color: 'var(--text-secondary)' }}>
                                Hace {formatDistanceToNow(latestSync, { locale: es })}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center w-full md:w-auto justify-end gap-3">
                    <button
                        onClick={() => setShowLogs(!showLogs)}
                        className="font-mono text-[11px] uppercase transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {showLogs ? 'Ocultar Logs' : 'Ver Logs'}
                    </button>
                    <button
                        onClick={startSync}
                        disabled={syncing || isRunning}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all"
                        style={(syncing || isRunning) ? {
                            background: 'var(--bg-blue-tint)',
                            border: '1px solid var(--border-blue)',
                            color: 'var(--sura-blue)',
                            cursor: 'not-allowed'
                        } : {
                            background: 'var(--sura-blue)',
                            border: '1px solid var(--sura-blue)',
                            color: '#ffffff',
                            boxShadow: '0 2px 8px rgba(45,109,246,0.25)'
                        }}
                    >
                        <RefreshCw className={clsx("w-3 h-3", (syncing || isRunning) && "animate-spin")} />
                        {(syncing || isRunning) ? 'Procesando...' : 'Iniciar Sincronización'}
                    </button>
                </div>
            </div>

            {showLogs && (
                <div className="rounded-xl overflow-hidden font-mono text-[10px] mt-4"
                    style={{ background: '#F8F8F8', border: '1px solid var(--border-light)' }}>
                    <div className="flex items-center justify-between px-3 py-2"
                        style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                        <span className="flex items-center gap-2" style={{ color: 'var(--sura-blue-dark)' }}>
                            <Terminal className="w-3 h-3" />
                            sync_verbose_logs.txt
                        </span>
                        <button onClick={() => setShowLogs(false)} className="transition-colors"
                            style={{ color: 'var(--text-muted)' }}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-4 h-48 overflow-y-auto leading-relaxed" style={{ color: '#059669' }}>
                        <pre className="whitespace-pre-wrap">{logs || '> Inicializando conexión con el motor de sincronización TestRail → BigQuery...'}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
