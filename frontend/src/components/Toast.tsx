import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastKind, { border: string; icon: ReactNode; bar: string }> = {
  success: {
    border: 'border-emerald-400/30',
    bar: 'bg-emerald-400',
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
  },
  error: {
    border: 'border-rose-400/30',
    bar: 'bg-rose-400',
    icon: <XCircle className="h-5 w-5 text-rose-400" />,
  },
  info: {
    border: 'border-cyan-400/30',
    bar: 'bg-cyan-400',
    icon: <Info className="h-5 w-5 text-cyan-400" />,
  },
  warning: {
    border: 'border-amber-400/30',
    bar: 'bg-amber-400',
    icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-4), { id, kind, message }]);
      window.setTimeout(() => remove(id), kind === 'error' ? 6500 : 4000);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      notify,
      success: (message: string) => notify('success', message),
      error: (message: string) => notify('error', message),
      info: (message: string) => notify('info', message),
      warning: (message: string) => notify('warning', message),
    }),
    [notify],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto animate-fade-up overflow-hidden rounded-xl border ${STYLES[toast.kind].border} bg-ink-800/95 shadow-2xl backdrop-blur`}
          >
            <div className="flex items-start gap-3 p-3.5">
              <div className="mt-0.5 shrink-0">{STYLES[toast.kind].icon}</div>
              <p className="flex-1 text-sm leading-snug text-slate-200">{toast.message}</p>
              <button
                onClick={() => remove(toast.id)}
                className="rounded p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className={`h-0.5 w-full ${STYLES[toast.kind].bar} opacity-60`} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
