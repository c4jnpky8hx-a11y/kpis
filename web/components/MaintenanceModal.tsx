
'use client';

import { useState, useEffect } from 'react';
import { Settings, X, Lock, Plus, Trash2, Save, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

const AUTH_CODE = 'SuraPanama507';

interface ExternalDate {
    plan_id: string;
    name: string;
    original_start_date: string;
    external_start_date: string | null;
    external_name: string | null;
}

export default function MaintenanceModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ExternalDate[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Form state
    const [newPlanId, setNewPlanId] = useState('');
    const [newDate, setNewDate] = useState('');
    const [newName, setNewName] = useState('');

    const filteredData = data.filter(item =>
        item.plan_id.includes(searchTerm) ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.external_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const fetchDates = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/maintenance/dates', {
                headers: { 'x-auth-code': AUTH_CODE }
            });
            const json = await res.json();
            if (json.data && Array.isArray(json.data)) {
                setData(json.data);
            } else {
                console.error("Data is not an array:", json);
            }
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthenticated && isOpen) {
            fetchDates();
        }
    }, [isAuthenticated, isOpen]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (code === AUTH_CODE) {
            setIsAuthenticated(true);
            setError('');
        } else {
            setError('Código de acceso incorrecto');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPlanId || !newDate) return;

        setLoading(true);
        try {
            const res = await fetch('/api/maintenance/dates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-code': AUTH_CODE
                },
                body: JSON.stringify({
                    plan_id: newPlanId,
                    external_start_date: newDate,
                    external_name: newName
                })
            });

            if (res.ok) {
                setNewPlanId('');
                setNewDate('');
                setNewName('');
                await fetchDates();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (planId: string) => {
        if (!confirm('¿Está seguro de eliminar este mapeo?')) return;

        setLoading(true);
        try {
            await fetch('/api/maintenance/dates?plan_id=' + planId, {
                method: 'DELETE',
                headers: { 'x-auth-code': AUTH_CODE }
            });
            await fetchDates();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPlan = (item: ExternalDate) => {
        setNewPlanId(item.plan_id);
        setNewDate(item.external_start_date || item.original_start_date || '');
        setNewName(item.external_name || item.name || '');
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-1.5 text-xs font-mono uppercase rounded-lg transition-all hover:opacity-80"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
            >
                <Settings size={14} />
                Mantenimiento
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>

                        {/* Header */}
                        <div className="flex items-center justify-between p-6" style={{ background: 'var(--bg-blue-tint)', borderBottom: '1px solid var(--border-light)' }}>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg" style={{ background: 'var(--bg-card)', color: 'var(--sura-blue)' }}>
                                    <Settings size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-medium leading-tight" style={{ color: 'var(--sura-blue-dark)' }}>Mantenimiento de Fechas</h2>
                                    <p className="text-xs font-mono mt-1 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Alineación TestRail vs Excel</p>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="transition-colors hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            {!isAuthenticated ? (
                                /* Login Form */
                                <form onSubmit={handleLogin} className="space-y-4 max-w-sm mx-auto py-8">
                                    <div className="text-center mb-6">
                                        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--bg-blue-tint)', border: '1px solid var(--border-light)' }}>
                                            <Lock size={24} style={{ color: 'var(--sura-blue)' }} />
                                        </div>
                                        <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Controles de Administrador</h3>
                                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ingrese el código de seguridad para continuar</p>
                                    </div>

                                    <div className="space-y-2">
                                        <input
                                            type="password"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            placeholder="Código de Seguridad"
                                            autoFocus
                                            className="w-full rounded-lg px-4 py-3 outline-none transition-colors text-center font-mono tracking-[0.5em]"
                                            style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)', color: 'var(--text-body)' }}
                                        />
                                        {error && (
                                            <div className="flex items-center gap-2 text-xs font-mono justify-center" style={{ color: '#DC2626' }}>
                                                <AlertCircle size={12} />
                                                {error}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 hover:opacity-90"
                                        style={{ background: 'var(--sura-blue)' }}
                                    >
                                        Desbloquear Panel
                                    </button>
                                </form>
                            ) : (
                                /* Main Interface */
                                <div className="space-y-8">

                                    {/* Add New Entry Form */}
                                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)' }}>
                                        <div className="space-y-1 md:col-span-1">
                                            <label className="text-[10px] font-mono uppercase ml-1" style={{ color: 'var(--text-muted)' }}>Plan ID</label>
                                            <input
                                                type="number"
                                                required
                                                value={newPlanId}
                                                onChange={(e) => setNewPlanId(e.target.value)}
                                                className="w-full rounded px-3 py-2 text-sm outline-none"
                                                style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)', color: 'var(--text-body)' }}
                                            />
                                        </div>
                                        <div className="space-y-1 md:col-span-1">
                                            <label className="text-[10px] font-mono uppercase ml-1" style={{ color: 'var(--text-muted)' }}>Fecha Inicio</label>
                                            <input
                                                type="date"
                                                required
                                                value={newDate}
                                                onChange={(e) => setNewDate(e.target.value)}
                                                className="w-full rounded px-3 py-2 text-sm outline-none"
                                                style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)', color: 'var(--text-body)' }}
                                            />
                                        </div>
                                        <div className="space-y-1 md:col-span-1">
                                            <label className="text-[10px] font-mono uppercase ml-1" style={{ color: 'var(--text-muted)' }}>Iniciativa (Ref)</label>
                                            <input
                                                type="text"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                className="w-full rounded px-3 py-2 text-sm outline-none"
                                                style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)', color: 'var(--text-body)' }}
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full disabled:opacity-50 text-white text-xs font-mono uppercase h-[38px] rounded flex items-center justify-center gap-2 transition-all hover:opacity-90"
                                                style={{ background: 'var(--sura-blue)' }}
                                            >
                                                {loading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                                                Guardar
                                            </button>
                                        </div>
                                    </form>

                                    {/* Table of Existing Entries */}
                                    <div className="space-y-3">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                            <h4 className="text-xs font-mono uppercase" style={{ color: 'var(--text-secondary)' }}>Planes Detectados ({filteredData.length})</h4>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Buscar plan..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="rounded px-3 py-1 text-xs outline-none w-48"
                                                    style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)', color: 'var(--text-body)' }}
                                                />
                                                <button onClick={fetchDates} className="text-xs hover:underline" style={{ color: 'var(--sura-blue)' }}>Refrescar</button>
                                            </div>
                                        </div>
                                        <div className="max-h-[400px] overflow-y-auto rounded-lg" style={{ border: '1px solid var(--border-light)' }}>
                                            <table className="w-full text-left border-collapse">
                                                <thead className="sticky top-0 text-[10px] font-mono uppercase z-10" style={{ background: 'var(--bg-blue-tint)', color: 'var(--text-secondary)' }}>
                                                    <tr>
                                                        <th className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>Plan ID</th>
                                                        <th className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>Nombre / Iniciativa</th>
                                                        <th className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>Fecha TestRail</th>
                                                        <th className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-light)' }}>Fecha Ajustada</th>
                                                        <th className="px-4 py-3 text-right" style={{ borderBottom: '1px solid var(--border-light)' }}>Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredData.map((item, idx) => (
                                                        <tr
                                                            key={item.plan_id}
                                                            onClick={() => handleSelectPlan(item)}
                                                            className="transition-colors group cursor-pointer"
                                                            style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)' }}
                                                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-blue-tint)')}
                                                            onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-page)')}
                                                        >
                                                            <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--sura-blue)' }}>{item.plan_id}</td>
                                                            <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-body)' }}>
                                                                <div className="font-medium">{item.name}</div>
                                                                {item.external_name && item.external_name !== item.name && (
                                                                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Ref: {item.external_name}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-xs font-mono italic" style={{ color: 'var(--text-muted)' }}>
                                                                {item.original_start_date || 'N/A'}
                                                            </td>
                                                            <td className="px-4 py-3 text-sm">
                                                                {item.external_start_date ? (
                                                                    <div className="flex items-center gap-2 font-medium" style={{ color: '#059669' }}>
                                                                        <Calendar size={12} />
                                                                        {String(item.external_start_date)}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] uppercase font-mono" style={{ color: 'var(--text-muted)' }}>Sin Ajuste</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                {item.external_start_date && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleDelete(item.plan_id);
                                                                        }}
                                                                        className="p-1 px-2 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                                        style={{ color: '#DC2626' }}
                                                                        title="Eliminar ajuste manual"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {filteredData.length === 0 && !loading && (
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-8 text-center font-mono text-xs" style={{ color: 'var(--text-muted)' }}>No se encontraron planes</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 flex justify-end" style={{ background: 'var(--bg-page)', borderTop: '1px solid var(--border-light)' }}>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 text-xs font-mono uppercase hover:opacity-70"
                                style={{ color: 'var(--text-secondary)' }}
                            >
                                Cerrar Panel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
