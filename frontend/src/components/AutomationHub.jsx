import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getAutomationStatus, addToQueue, hasAutoApplyAccess, formatAutoApplyLimit } from '../api/automation';

// Icons
const RocketIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
);

const DownloadIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);

const PlayIcon = ({ className }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
    </svg>
);

const AutomationHub = ({ isCollapsed = false }) => {
    const { t } = useTranslation();
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch automation status on mount and periodically
    useEffect(() => {
        let isMounted = true;

        const fetchStatus = async () => {
            try {
                // getAutomationStatus now uses authenticated client (no userId needed)
                const data = await getAutomationStatus();
                if (isMounted && data) {
                    setStatus(data);
                    setError(null);
                }
            } catch (err) {
                if (isMounted) {
                    setError(t('automation.loadError'));
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchStatus();

        // Poll every 10 seconds
        const interval = setInterval(fetchStatus, 10000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    const isConnected = status?.extension?.connected || false;
    const planName = status?.subscription?.plan || 'free';
    const hasAccess = hasAutoApplyAccess(planName);
    const limit = status?.subscription?.autoApplyLimit || 0;
    const used = status?.subscription?.autoAppliesUsed || 0;
    const ipAddress = status?.extension?.ipAddress || '--';
    const queuePending = status?.queue?.pending || 0;

    // Collapsed view
    if (isCollapsed) {
        return (
            <div className="px-3 py-2">
                <div
                    className="flex items-center justify-center p-3 rounded-xl bg-gradient-to-r from-blue-500/10 to-blue-500/10"
                    title="Automation Hub"
                >
                    <div className="relative">
                        <RocketIcon className="w-5 h-5 text-blue-500" />
                        <span
                            className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${isConnected ? 'bg-green-500' : 'bg-gray-400'
                                }`}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-3 py-4"
        >
            {/* Section Header */}
            <div className="flex items-center gap-2 px-3 mb-3">
                <RocketIcon className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('automation.hubTitle')}
                </span>
            </div>

            {/* Status Card */}
            <div className="bg-gradient-to-br from-blue-500/5 via-blue-500/5 to-pink-500/5 rounded-xl border border-blue-500/10 p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-4">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : error ? (
                    <p className="text-xs text-red-500 text-center py-2">{error}</p>
                ) : (
                    <>
                        {/* Connection Status */}
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-gray-600 dark:text-gray-400">{t('automation.extension')}</span>
                            <div className="flex items-center gap-1.5">
                                <span
                                    className={`w-2 h-2 rounded-full ${isConnected
                                        ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                                        : 'bg-gray-400'
                                        }`}
                                />
                                <span className={`text-xs font-medium ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-500'
                                    }`}>
                                    {isConnected ? t('automation.connected') : t('automation.disconnected')}
                                </span>
                            </div>
                        </div>

                        {/* IP Address */}
                        {isConnected && (
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-gray-600 dark:text-gray-400">{t('automation.localIp')}</span>
                                <span className="text-xs font-mono text-gray-700 dark:text-gray-300">
                                    {ipAddress}
                                </span>
                            </div>
                        )}

                        {/* App Credits */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs text-gray-600 dark:text-gray-400">{t('automation.appCredits')}</span>
                            <span className={`text-xs font-semibold ${hasAccess ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
                                }`}>
                                {formatAutoApplyLimit(limit, used)}
                            </span>
                        </div>

                        {/* Queue Status */}
                        {queuePending > 0 && (
                            <div className="flex items-center justify-between mb-4 px-2 py-1.5 bg-amber-500/10 rounded-lg">
                                <span className="text-xs text-amber-700 dark:text-amber-400">{t('automation.inQueue')}</span>
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                    {queuePending} {t('automation.jobs')}
                                </span>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2">
                            {hasAccess ? (
                                <button
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-blue-500 to-blue-500 hover:from-blue-600 hover:to-blue-600 text-white text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!isConnected}
                                >
                                    <PlayIcon className="w-3.5 h-3.5" />
                                    {t('automation.startAutoApply')}
                                </button>
                            ) : (
                                <Link
                                    to="/pricing"
                                    className="block text-center py-2 px-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer group animate-pulse"
                                >
                                    <p className="text-xs text-gray-500 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                        {t('automation.upgradePro')}
                                    </p>
                                </Link>
                            )}

                            <a
                                href="/extension"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg transition-colors"
                            >
                                <DownloadIcon className="w-3.5 h-3.5" />
                                {t('automation.downloadExtension')}
                            </a>
                        </div>

                        {/* Plan Badge */}
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500">{t('automation.currentPlan')}</span>
                                <Link to="/pricing" className={`text-xs font-bold px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity ${planName === 'fast'
                                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white'
                                    : planName === 'pro'
                                        ? 'bg-gradient-to-r from-blue-500 to-blue-500 text-white'
                                        : planName === 'starter'
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                    }`}>
                                    {planName.charAt(0).toUpperCase() + planName.slice(1)}
                                </Link>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </motion.div>
    );
};

export default AutomationHub;
