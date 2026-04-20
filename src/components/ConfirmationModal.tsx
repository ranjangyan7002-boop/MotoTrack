import { FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isLoading ? undefined : onCancel}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/50"
          >
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-bento-orange/10 text-bento-orange'}`}>
                  <AlertTriangle size={32} />
                </div>
                {!isLoading && (
                  <button 
                    onClick={onCancel}
                    className="p-2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                )}
              </div>

              <h3 className="text-2xl font-black italic tracking-tight uppercase text-white mb-3">
                {title}
              </h3>
              <p className="text-sm font-mono text-zinc-400 tracking-tight leading-relaxed mb-8 italic">
                {message}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`
                    w-full h-14 flex items-center justify-center rounded-2xl font-black tracking-widest uppercase transition-all active:scale-95
                    ${isDestructive 
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]' 
                      : 'bg-white hover:bg-zinc-200 text-black'}
                    ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    confirmLabel
                  )}
                </button>
                {!isLoading && (
                  <button
                    onClick={onCancel}
                    className="w-full h-14 flex items-center justify-center rounded-2xl font-bold tracking-widest uppercase text-zinc-500 hover:bg-white/5 transition-colors"
                  >
                    {cancelLabel}
                  </button>
                )}
              </div>
            </div>

            {/* Decorative bottom line */}
            <div className={`h-1 w-full ${isDestructive ? 'bg-red-600' : 'bg-white'}`} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
