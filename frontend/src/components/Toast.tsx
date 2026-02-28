import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++_id;
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const dismiss = (id: number) => setToasts(t => t.filter(x => x.id !== id));

  const Icon = { success: CheckCircle, error: XCircle, info: Info };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => {
          const I = Icon[t.type];
          return (
            <div key={t.id} className={`toast toast--${t.type}`}>
              <I size={15} />
              <span className="toast__message">{t.message}</span>
              <button className="toast__close" onClick={() => dismiss(t.id)}><X size={12} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
