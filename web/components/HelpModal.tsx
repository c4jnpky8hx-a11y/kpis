'use client';

import { useState } from 'react';
import { X, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

interface Indicator {
    id: string;
    name: string;
    icon: string;
    section: string;
    description: string;
    howCalculated: string;
    howToRead: string;
    color: string;
}

const INDICATORS: Indicator[] = [
    // ── KPI CARDS ──────────────────────────────────────────
    {
        id: 'planes-completados',
        name: 'Planes Completados',
        icon: '✅',
        section: 'Indicadores Principales',
        color: 'emerald',
        description: 'Número de planes de prueba que han finalizado su ejecución.',
        howCalculated: 'Un plan se cuenta como Completado si: (a) está marcado como cerrado en TestRail, o (b) tiene 100% de sus casos pasados, aunque no esté cerrado explícitamente.',
        howToRead: 'Muestra el avance en el cierre de pruebas. Un número alto = equipos cumpliendo sus compromisos. Compara con "Planes en Proceso" para entender la proporción de trabajo pendiente.',
    },
    {
        id: 'planes-proceso',
        name: 'Planes en Proceso',
        icon: '🔄',
        section: 'Indicadores Principales',
        color: 'blue',
        description: 'Planes de prueba que están activos pero aún no han alcanzado el 100% de ejecución ni están cerrados.',
        howCalculated: 'Cualquier plan que no cumpla las condiciones de "Completado" y tenga al menos un ciclo de prueba asociado.',
        howToRead: 'Indica trabajo activo en ejecución. Monitorea que este número no crezca desproporcionadamente en relación a los completados.',
    },
    {
        id: 'defectos-activos',
        name: 'Defectos Activos',
        icon: '🔴',
        section: 'Indicadores Principales',
        color: 'red',
        description: 'Defectos reportados en Jira (tipo Defecto_TestRail) que aún no han sido cerrados.',
        howCalculated: 'Cuenta de issues en Jira con type = Defecto_TestRail, excluyendo los estados: Terminado, Cerrado, Cancelado, Mitigado.\n\n• Vinculados = defectos que están referenciados en resultados de TestRail\n• Sin vincular = defectos en Jira sin caso de prueba asociado\n• Total TR = total histórico de Defecto_TestRail (activos + cerrados)',
        howToRead: 'Los vinculados son defectos trazables al proceso de pruebas. Los sin vincular pueden ser bugs encontrados en regresión o reporte directo. Un número alto de sin vincular puede indicar defectos que escaparon el proceso de QA formal.',
    },
    {
        id: 'casos-ejecutados',
        name: 'Casos Ejecutados',
        icon: '▶',
        section: 'Indicadores Principales',
        color: 'gray',
        description: 'Total de ejecuciones de casos de prueba registradas en el período y proyecto seleccionado.',
        howCalculated: 'Suma de todos los casos en todos los ciclos (runs) del proyecto y período filtrado, incluyendo todos los estados (pasado, fallado, bloqueado, sin probar).',
        howToRead: 'Volumen de actividad del equipo de QA. Útil para comparar esfuerzo entre proyectos o períodos.',
    },
    // ── DESGLOSE CICLOS ──────────────────────────────────────
    {
        id: 'desglose-ciclos',
        name: 'Desglose de Ejecución (por Ciclo)',
        icon: '🍩',
        section: 'Gráficos de Ejecución',
        color: 'purple',
        description: 'Distribución del estado de los ciclos de prueba completos, no de casos individuales.',
        howCalculated: 'Cada ciclo (run) recibe un único estado según regla de prioridad estricta:\n1. Backlog: sin casos de prueba, O sin ejecución con fecha de inicio ya vencida o sin fecha\n2. Pendiente: con casos pero sin ejecución Y fecha de inicio futura\n3. Fallado: si tiene AL MENOS 1 caso fallado o en re-prueba\n4. Bloqueado: si tiene AL MENOS 1 bloqueado (y ningún fallado)\n5. En Progreso: ejecución parcial sin fallos ni bloqueos\n6. Certificado: TODOS los casos están pasados',
        howToRead: 'Un ciclo "Fallado" no significa que todo falló, sino que hay al menos 1 caso que requiere atención. Permite ver la salud general del proceso de pruebas de manera binaria clara.',
    },
    // ── UAT ──────────────────────────────────────────────────
    {
        id: 'uat-calidad',
        name: 'Criterios de Calidad (UAT)',
        icon: '🏆',
        section: 'Certificaciones UAT',
        color: 'indigo',
        description: 'Resumen del estado de las soluciones sometidas a pruebas de Aceptación de Usuario (UAT).',
        howCalculated: '• Certificadas: soluciones cuyos ciclos UAT están 100% pasados\n• Devueltas: soluciones que en algún momento tuvieron casos fallados/bloqueados en UAT\n• En Proceso: actualmente en ciclo UAT activo',
        howToRead: 'Una solución "Devuelta" no significa que falló definitivamente — puede haberse corregido y re-certificado. Úsalo para medir la calidad del software que llega a UAT.',
    },
    {
        id: 'uat-evolucion',
        name: 'Evolución de Certificaciones UAT (Scatter)',
        icon: '📡',
        section: 'Certificaciones UAT',
        color: 'teal',
        description: 'Gráfico de dispersión que muestra cada certificación UAT como un punto en el tiempo.',
        howCalculated: 'Cada punto = 1 solución certificada en ese mes.\n• ● Verde = certificada sin incidentes (limpia)\n• ▲ Ámbar = aprobada pero con defectos detectados en QA previo\n• ■ Índigo = aún en proceso\n\nEl eje Y muestra la cantidad acumulada en ese mes.',
        howToRead: 'Permite ver el ritmo y calidad de certificaciones. Meses con muchos triángulos ámbar indican que el equipo de QA encontró problemas antes de llegar a UAT (señal positiva del proceso). Meses vacíos = sin certificaciones.',
    },
    // ── DEFECTOS ─────────────────────────────────────────────
    {
        id: 'severidad-defectos',
        name: 'Severidad de Defectos',
        icon: '⚠',
        section: 'Análisis de Defectos',
        color: 'red',
        description: 'Distribución de defectos activos por nivel de prioridad/severidad.',
        howCalculated: 'Agrupa los Defecto_TestRail activos (filtrados por proyecto si se selecciona uno) según el campo Priority de Jira: Crítica, Alta, Media, Baja.',
        howToRead: 'Un alto número de "Crítica" o "Alta" requiere atención inmediata. El gráfico respeta el filtro de proyecto seleccionado arriba.',
    },
    {
        id: 'estado-defectos',
        name: 'Estado de Defectos',
        icon: '🔵',
        section: 'Análisis de Defectos',
        color: 'blue',
        description: 'Muestra en qué etapa del flujo de trabajo están los defectos activos en Jira.',
        howCalculated: 'Agrupa Defecto_TestRail activos por su Status en Jira (Backlog, Análisis, Desarrollo, Listo para Probar, etc.).',
        howToRead: 'Identifica cuellos de botella. Si muchos defectos están en "Esperando Aprobación" hay un problema de proceso. "Listo para Probar" indica que hay trabajo pendiente para QA.',
    },
    {
        id: 'top-riesgos',
        name: 'Top Riesgos (Defectos Antiguos)',
        icon: '⏳',
        section: 'Análisis de Defectos',
        color: 'amber',
        description: 'Los 5 defectos Defecto_TestRail más antiguos que siguen activos.',
        howCalculated: 'Query directa a raw_jira_issues filtrando type = Defecto_TestRail, estado activo (no Terminado/Cerrado), ordenado por fecha de creación ascendente. Muestra los 5 más viejos.',
        howToRead: 'Un defecto con muchos días abierto es un riesgo operacional. Si tiene prioridad Crítica o Alta y lleva meses abierto, debe escalarse.',
    },
    // ── ANALISTAS ────────────────────────────────────────────
    {
        id: 'carga-trabajo',
        name: 'Carga de Trabajo por Analista',
        icon: '👤',
        section: 'Gestión del Equipo',
        color: 'violet',
        description: 'Distribución de casos de prueba asignados por analista, SOLO en ciclos activos (no 100% completados).',
        howCalculated: 'Primero identifica ciclos con al menos 1 caso no pasado ("activos"). Luego agrupa los casos asignados de esos ciclos por analista y proyecto.',
        howToRead: 'Representa la carga REAL actual, no el histórico. Si un analista no aparece, sus ciclos ya están completados. Útil para balancear la carga del equipo.',
    },
    {
        id: 'demanda-analistas',
        name: 'Demanda de Analistas por Proyecto',
        icon: '📊',
        section: 'Gestión del Equipo',
        color: 'cyan',
        description: 'Histórico de cuántos casos ha ejecutado cada analista por proyecto en el tiempo.',
        howCalculated: 'Muestra todos los casos ejecutados (incluyendo completados) respetando los filtros de proyecto, año y mes seleccionados.',
        howToRead: 'A diferencia de "Carga de Trabajo", este sí muestra el histórico. Útil para medir la contribución total de cada analista al proyecto.',
    },
    // ── AUDITORIA ────────────────────────────────────────────
    {
        id: 'auditoria-defectos',
        name: 'Auditoría de Defectos Jira',
        icon: '📋',
        section: 'Trazabilidad',
        color: 'slate',
        description: 'Tabla detallada de todos los Defecto_TestRail activos, mostrando si están vinculados a un caso de prueba.',
        howCalculated: 'Lista todos los issues con type = Defecto_TestRail que NO están en estado cerrado. Cruza con los resultados de TestRail para determinar si el defecto está referenciado en algún caso ejecutado.',
        howToRead: '"NO VINCULADO" significa que el defecto existe en Jira pero no hay un caso en TestRail que lo referencie — posible brecha en el proceso. La tabla muestra 15 registros por página.',
    },
];

const SECTIONS = [...new Set(INDICATORS.map(i => i.section))];

const COLOR_MAP: Record<string, string> = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    gray: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function IndicatorCard({ ind }: { ind: Indicator }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-lg overflow-hidden transition-all"
            style={{ border: open ? '1px solid var(--border-blue)' : '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-start justify-between p-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)' }}>
                        {ind.icon}
                    </span>
                    <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{ind.name}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{ind.description.slice(0, 80)}…</div>
                    </div>
                </div>
                {open
                    ? <ChevronUp size={16} className="flex-shrink-0 mt-1" style={{ color: 'var(--sura-blue)' }} />
                    : <ChevronDown size={16} className="flex-shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />}
            </button>
            {open && (
                <div className="px-4 pb-4 space-y-4" style={{ borderTop: '1px solid var(--border-light)' }}>
                    <div>
                        <h4 className="text-[10px] uppercase mt-4 mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>¿Qué mide?</h4>
                        <p className="text-xs" style={{ color: 'var(--text-body)' }}>{ind.description}</p>
                    </div>
                    <div>
                        <h4 className="text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>¿Cómo se calcula?</h4>
                        <pre className="text-xs whitespace-pre-wrap font-sans" style={{ color: 'var(--text-secondary)' }}>{ind.howCalculated}</pre>
                    </div>
                    <div>
                        <h4 className="text-[10px] uppercase mb-1" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>¿Cómo interpretarlo?</h4>
                        <p className="text-xs" style={{ color: 'var(--text-body)' }}>{ind.howToRead}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function HelpModal() {
    const [open, setOpen] = useState(false);
    const [activeSection, setActiveSection] = useState(SECTIONS[0]);
    const [search, setSearch] = useState('');

    const filtered = INDICATORS.filter(ind =>
    (search === '' ||
        ind.name.toLowerCase().includes(search.toLowerCase()) ||
        ind.description.toLowerCase().includes(search.toLowerCase()))
    ).filter(ind => search !== '' || ind.section === activeSection);

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium uppercase rounded-lg transition-all"
                style={{ border: '1px solid var(--border-blue)', color: 'var(--sura-blue)', background: 'var(--bg-blue-tint)' }}
            >
                <BookOpen size={12} />
                Cómo Interpretar
            </button>

            {/* Modal Overlay */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 backdrop-blur-sm"
                        style={{ background: 'rgba(0,51,160,0.25)' }}
                        onClick={() => setOpen(false)}
                    />

                    {/* Modal Panel */}
                    <div className="relative rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col z-10"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', boxShadow: '0 20px 60px rgba(0,51,160,0.15)' }}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-6" style={{ borderBottom: '2px solid var(--sura-blue)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                                    style={{ background: 'var(--sura-blue)', color: '#ffffff' }}>
                                    <BookOpen size={18} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold" style={{ color: 'var(--sura-blue-dark)' }}>Cómo Interpretar los Indicadores</h2>
                                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Manual de referencia · KPIS QA SURA</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1 rounded-lg transition-colors"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-6 pt-4 pb-2">
                            <input
                                type="text"
                                placeholder="Buscar indicador..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                                style={{ background: 'var(--bg-page)', border: '1px solid var(--border-light)', color: 'var(--text-body)' }}
                            />
                        </div>

                        {/* Section Tabs */}
                        {search === '' && (
                            <div className="px-6 py-2 flex gap-2 flex-wrap" style={{ borderBottom: '1px solid var(--border-light)' }}>
                                {SECTIONS.map(sec => (
                                    <button
                                        key={sec}
                                        onClick={() => setActiveSection(sec)}
                                        className="px-3 py-1 text-[10px] font-medium uppercase rounded-md border transition-all"
                                        style={activeSection === sec ? {
                                            background: 'var(--sura-blue)',
                                            borderColor: 'var(--sura-blue)',
                                            color: '#ffffff'
                                        } : {
                                            background: 'transparent',
                                            border: '1px solid var(--border-light)',
                                            color: 'var(--text-secondary)'
                                        }}
                                    >
                                        {sec}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-3" style={{ background: 'var(--bg-page)' }}>
                            {filtered.length === 0 ? (
                                <div className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
                                    No se encontraron indicadores
                                </div>
                            ) : (
                                filtered.map(ind => <IndicatorCard key={ind.id} ind={ind} />)
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 text-[9px] text-center" style={{ borderTop: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                            {INDICATORS.length} indicadores documentados · Haz clic en un indicador para expandir su detalle
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
