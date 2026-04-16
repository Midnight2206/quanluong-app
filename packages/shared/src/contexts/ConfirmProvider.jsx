import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

const ConfirmContext = createContext(null);

const defaultState = {
  open: false,
  title: "Xác nhận",
  message: "",
  confirmLabel: "Xác nhận",
  cancelLabel: "Huỷ",
  variant: "default",
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(defaultState);
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState((prev) => ({
        ...prev,
        open: true,
        title: options.title ?? defaultState.title,
        message: options.message ?? "",
        confirmLabel: options.confirmLabel ?? defaultState.confirmLabel,
        cancelLabel: options.cancelLabel ?? defaultState.cancelLabel,
        variant: options.variant === "danger" ? "danger" : "default",
      }));
    });
  }, []);

  const finish = useCallback((value) => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setState((s) => ({ ...s, open: false }));
    r?.(value);
  }, []);

  useEffect(() => {
    if (!state.open) {
      return undefined;
    }
    function onKey(e) {
      if (e.key === "Escape") {
        finish(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.open, finish]);

  const confirmVariant = state.variant === "danger" ? "destructive" : "primary";

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-background/80 backdrop-blur-[1px]"
            aria-label={state.cancelLabel}
            onClick={() => finish(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="app-confirm-title"
            className={cn(
              "relative w-full max-w-md rounded-t-2xl border border-border bg-card p-4 shadow-lg sm:rounded-2xl sm:p-5",
            )}
          >
            <p
              id="app-confirm-title"
              className="text-sm font-semibold text-foreground"
            >
              {state.title}
            </p>
            {state.message ? (
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {state.message}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="px-3 py-1.5 text-xs"
                onClick={() => finish(false)}
              >
                {state.cancelLabel}
              </Button>
              <Button
                type="button"
                variant={confirmVariant}
                className="px-3 py-1.5 text-xs"
                onClick={() => finish(true)}
              >
                {state.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}
