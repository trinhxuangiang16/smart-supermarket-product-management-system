import { PropsWithChildren, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ToastType = "success" | "error" | "warning" | "info";
type ToastInput = { type?: ToastType; message: string };
type Toast = ToastInput & { id: number };

type ToastContextValue = { notify: (toast: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const typeStyles: Record<ToastType, string> = {
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  error: "border-[#e0b4a0] bg-[#fdf1ec] text-[#9c4326]",
  warning: "border-amber-300 bg-amber-50 text-amber-800",
  info: "border-[#ead6aa] bg-[#fff9ee] text-[#6d5935]",
};

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const notify = useCallback((toast: ToastInput) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md border px-4 py-3 text-sm shadow ${typeStyles[t.type ?? "info"]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
