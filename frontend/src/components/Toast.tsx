/**
 * Toast Notification Component
 * 
 * Beautiful animated toast notifications with different variants:
 * - success: Green with checkmark
 * - error: Red with X
 * - warning: Yellow with warning icon
 * - info: Blue with info icon
 * - prediction: Special style for predictions (green/red gradient)
 */

import { useState, useEffect, createContext, useContext, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// TYPES
// =============================================================================

type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'prediction-yes' | 'prediction-no';

interface Toast {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  duration?: number;
  icon?: ReactNode;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  // Convenience methods
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  predictionYes: (title: string, message?: string) => void;
  predictionNo: (title: string, message?: string) => void;
}

// =============================================================================
// CONTEXT
// =============================================================================

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// =============================================================================
// PROVIDER
// =============================================================================

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Convenience methods
  const success = useCallback((title: string, message?: string) => {
    showToast({ title, message, variant: 'success', duration: 4000 });
  }, [showToast]);

  const error = useCallback((title: string, message?: string) => {
    showToast({ title, message, variant: 'error', duration: 5000 });
  }, [showToast]);

  const warning = useCallback((title: string, message?: string) => {
    showToast({ title, message, variant: 'warning', duration: 4000 });
  }, [showToast]);

  const info = useCallback((title: string, message?: string) => {
    showToast({ title, message, variant: 'info', duration: 4000 });
  }, [showToast]);

  const predictionYes = useCallback((title: string, message?: string) => {
    showToast({ title, message, variant: 'prediction-yes', duration: 5000 });
  }, [showToast]);

  const predictionNo = useCallback((title: string, message?: string) => {
    showToast({ title, message, variant: 'prediction-no', duration: 5000 });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast, success, error, warning, info, predictionYes, predictionNo }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// =============================================================================
// TOAST CONTAINER
// =============================================================================

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// TOAST ITEM
// =============================================================================

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 4000;

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        onDismiss(toast.id);
      }
    }, 50);

    return () => clearInterval(timer);
  }, [toast.id, duration, onDismiss]);

  const getVariantStyles = () => {
    switch (toast.variant) {
      case 'success':
        return {
          bg: 'bg-gradient-to-r from-green-600 to-emerald-600',
          border: 'border-green-400/30',
          icon: (
            <svg className="w-6 h-6 text-green-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ),
          progressBg: 'bg-green-300/30',
          progressBar: 'bg-green-200',
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-r from-red-600 to-rose-600',
          border: 'border-red-400/30',
          icon: (
            <svg className="w-6 h-6 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          progressBg: 'bg-red-300/30',
          progressBar: 'bg-red-200',
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-r from-yellow-600 to-orange-600',
          border: 'border-yellow-400/30',
          icon: (
            <svg className="w-6 h-6 text-yellow-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ),
          progressBg: 'bg-yellow-300/30',
          progressBar: 'bg-yellow-200',
        };
      case 'info':
        return {
          bg: 'bg-gradient-to-r from-blue-600 to-cyan-600',
          border: 'border-blue-400/30',
          icon: (
            <svg className="w-6 h-6 text-blue-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          progressBg: 'bg-blue-300/30',
          progressBar: 'bg-blue-200',
        };
      case 'prediction-yes':
        return {
          bg: 'bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600',
          border: 'border-green-400/50',
          icon: (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm">
              <span className="text-lg">✓</span>
            </div>
          ),
          progressBg: 'bg-green-300/30',
          progressBar: 'bg-gradient-to-r from-green-200 to-emerald-200',
        };
      case 'prediction-no':
        return {
          bg: 'bg-gradient-to-r from-red-600 via-rose-600 to-pink-600',
          border: 'border-red-400/50',
          icon: (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm">
              <span className="text-lg">✗</span>
            </div>
          ),
          progressBg: 'bg-red-300/30',
          progressBar: 'bg-gradient-to-r from-red-200 to-rose-200',
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-gray-700 to-gray-600',
          border: 'border-gray-500/30',
          icon: null,
          progressBg: 'bg-gray-400/30',
          progressBar: 'bg-gray-300',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        pointer-events-auto
        min-w-[320px] max-w-[420px]
        ${styles.bg}
        rounded-xl
        border ${styles.border}
        shadow-2xl shadow-black/30
        backdrop-blur-lg
        overflow-hidden
      `}
    >
      {/* Content */}
      <div className="p-4 flex items-start gap-3">
        {/* Icon */}
        {(toast.icon || styles.icon) && (
          <div className="flex-shrink-0 mt-0.5">
            {toast.icon || styles.icon}
          </div>
        )}

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white text-sm leading-tight">
            {toast.title}
          </h4>
          {toast.message && (
            <p className="mt-1 text-white/80 text-xs leading-relaxed">
              {toast.message}
            </p>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
      <div className={`h-1 ${styles.progressBg}`}>
        <motion.div
          className={`h-full ${styles.progressBar}`}
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.05, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
}

// =============================================================================
// EXPORT
// =============================================================================

export { ToastContext };
export type { Toast, ToastVariant, ToastContextType };
