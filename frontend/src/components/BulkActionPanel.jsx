import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, CheckSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const BulkActionPanel = ({ selectedCount, onAddToAutoApply, onClearSelection }) => {
    const { t } = useTranslation();

    return (
        <AnimatePresence>
            {selectedCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 100, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 100, scale: 0.95 }}
                    transition={{
                        duration: 0.25,
                        ease: [0.25, 0.46, 0.45, 0.94]
                    }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl"
                >
                    <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl flex items-center justify-between px-6 py-4">
                        {/* Left: Selection Info */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-200">
                                <CheckSquare className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <p className="text-slate-900 font-semibold text-base">
                                    {t('bulkAction.vacancySelected', { count: selectedCount })}
                                </p>
                                <p className="text-slate-500 text-xs">
                                    {t('bulkAction.readyForAutoApply')}
                                </p>
                            </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={onClearSelection}
                                className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium px-4 py-2.5 hover:bg-slate-100 rounded-xl transition-all duration-150"
                                aria-label={t('bulkAction.clearSelection')}
                            >
                                <X className="w-4 h-4" />
                                <span className="hidden sm:inline">{t('bulkAction.clear')}</span>
                            </button>
                            <button
                                onClick={onAddToAutoApply}
                                className="bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all duration-150 flex items-center gap-2"
                            >
                                <span>{t('bulkAction.addToQueue')}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default BulkActionPanel;
