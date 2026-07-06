import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useConfirm, ConfirmDialog } from '../components/ui/confirm-dialog';
import { vacaturesAPI } from '../api/vacatures';
import VacancyCard from '../components/VacancyCard';

const SelectedVacatures = () => {
    const [vacatures, setVacatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [profile, setProfile] = useState(null);
    const { t } = useTranslation();
    const { openConfirm, dialogProps } = useConfirm();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Load profile
            let profileData = null;
            try {
                const response = await fetch('/api/profile');
                if (response.ok) {
                    profileData = await response.json();
                    setProfile(profileData);
                }
            } catch (err) {
                console.warn('Failed to load profile:', err);
            }

            // Load all vacatures
            console.log('Fetching vacatures...');
            const allVacatures = await vacaturesAPI.getAll();
            console.log('Vacatures response:', allVacatures);

            if (!Array.isArray(allVacatures)) {
                console.error('API returned non-array:', allVacatures);
                throw new Error('Invalid data format received from API');
            }

            // Filter for interesting ones
            const interestingVacatures = allVacatures.filter(vac => {
                if (vac.status === 'interessant') return true;
                const stored = localStorage.getItem(`vacancy_${vac.id}_interesting`);
                return stored === 'true';
            });

            console.log('Interesting vacatures:', interestingVacatures);
            setVacatures(interestingVacatures);
        } catch (error) {
            console.error('Error loading data:', error);
            setError(error.message || 'Failed to load vacancies');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        try {
            await vacaturesAPI.updateStatus(id, newStatus);

            // Update localStorage
            if (newStatus === 'interessant') {
                localStorage.setItem(`vacancy_${id}_interesting`, 'true');
            } else {
                localStorage.removeItem(`vacancy_${id}_interesting`);
            }

            // Reload data to update the list
            loadData();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleMarkAllAsApplied = () => {
        openConfirm({
            title: t('pages.selected.confirmMarkAll'),
            confirmLabel: 'Mark All',
            variant: 'primary',
            onConfirm: async () => {
                try {
                    for (const vac of vacatures) {
                        await vacaturesAPI.updateStatus(vac.id, 'toegepast');
                        localStorage.removeItem(`vacancy_${vac.id}_interesting`);
                    }
                    loadData();
                } catch (error) {
                    console.error('Error marking all as applied:', error);
                    toast.error('Failed to mark all as applied');
                }
            }
        });
    };

    const handleClearAll = () => {
        openConfirm({
            title: t('pages.selected.confirmClearAll'),
            confirmLabel: 'Clear All',
            variant: 'danger',
            onConfirm: () => {
                vacatures.forEach(vac => {
                    localStorage.removeItem(`vacancy_${vac.id}_interesting`);
                });
                loadData();
            }
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-red-500 text-xl font-semibold mb-2">{t('common.error')}</div>
                <p className="text-gray-600">{error}</p>
                <button
                    onClick={loadData}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <ConfirmDialog {...dialogProps} />
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-5xl font-bold text-ds-text-primary tracking-tight">
                            {t('selectedVacancies.title')}
                        </h1>
                        <p className="text-xl text-ds-gray-600 font-light mt-2">
                            {t('selectedVacancies.subtitle')}
                        </p>
                    </div>

                    {vacatures.length > 0 && (
                        <div className="flex gap-3">
                            <button
                                onClick={handleMarkAllAsApplied}
                                className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all shadow-md"
                            >
                                {t('pages.selected.markAllApplied')}
                            </button>
                            <button
                                onClick={handleClearAll}
                                className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all"
                            >
                                {t('pages.selected.clearList')}
                            </button>
                        </div>
                    )}
                </div>

                {/* Stats */}
                {vacatures.length > 0 && (
                    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <p className="text-yellow-800 font-medium">
                                {t('pages.selected.selectedCount', { count: vacatures.length })}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Vacatures Grid */}
            {vacatures.length === 0 ? (
                <div className="text-center py-20">
                    <div className="inline-block p-4 bg-yellow-100 rounded-full mb-4">
                        <svg className="w-12 h-12 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </div>
                    <p className="text-xl text-ds-gray-500 font-medium mb-2">{t('pages.selected.noSelected')}</p>
                    <p className="text-ds-gray-400">{t('pages.selected.selectHint')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    <AnimatePresence mode="popLayout">
                        {vacatures.map((vacature, index) => (
                            <motion.div
                                key={vacature.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ delay: index * 0.05, duration: 0.3 }}
                            >
                                <VacancyCard
                                    vacature={vacature}
                                    onStatusChange={handleStatusChange}
                                    profile={profile}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default SelectedVacatures;
