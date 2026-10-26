import { motion, AnimatePresence } from 'framer-motion';
import { useNotification } from '@/store/notification';
import { CheckCircle2, AlertCircle, Info, CloudUpload } from 'lucide-react';

export function DynamicIsland() {
  const { isVisible, type, message, progress, filename } = useNotification();

  return (
    <div className="fixed top-4 lg:top-6 inset-x-0 z-[9999] flex justify-center pointer-events-none">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            layout
            initial={{ y: -50, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -50, opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`bg-black text-white shadow-2xl flex items-center justify-center overflow-hidden pointer-events-auto
              ${type === 'upload' ? 'rounded-[28px] px-5 py-4 min-w-[220px]' : 'rounded-full px-5 py-2.5'}
            `}
          >
            {/* Tipe: Upload Progress */}
            {type === 'upload' && (
              <div className="flex flex-col w-full gap-2">
                <div className="flex items-center gap-3">
                  <CloudUpload className="w-5 h-5 text-accent animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate max-w-[150px]">{filename}</p>
                    <p className="text-[10px] text-white/50">Mengunggah... {Math.round(progress)}%</p>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-accent" 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              </div>
            )}

            {/* Tipe: Notifikasi Biasa */}
            {type !== 'upload' && (
              <div className="flex items-center gap-2.5">
                {type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                {type === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                {type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
                <span className="text-sm font-medium">{message}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}