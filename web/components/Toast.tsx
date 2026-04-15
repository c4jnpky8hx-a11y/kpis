'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';

type ToastType = 'error' | 'success' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

export function useToast() {
    return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = 'error') => {
        const id = nextId++;
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-md">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => onDismiss(toast.id), 6000);
        return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    const Icon = toast.type === 'error' ? AlertTriangle : toast.type === 'success' ? CheckCircle : Info;

    return (
        <div
            className="flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg"
            style={
                toast.type === 'error' ? { background: '#FEE2E2', border: '1px solid #FECACA', color: '#991B1B' } :
                toast.type === 'success' ? { background: '#D1FAE5', border: '1px solid #6EE7B7', color: '#065F46' } :
                { background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', color: 'var(--sura-blue-dark)' }
            }
        >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <p className="text-sm font-mono flex-1">{toast.message}</p>
            <button onClick={() => onDismiss(toast.id)} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                <X size={14} />
            </button>
        </div>
    );
}
