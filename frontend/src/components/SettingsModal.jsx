import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { useCountry } from '../context/CountryContext';
import { useTranslation } from 'react-i18next';
import { profileAPI } from '../api/profile';
import { featureFlagsAPI } from '../api/featureFlags';
import { Switch } from '@/components/ui/switch';

const THEME_COLORS = [
    { name: 'Green', value: '#10a37f' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Purple', value: '#7c3aed' },
    { name: 'Orange', value: '#ea580c' },
];

const SettingsModal = () => {
    const { isSettingsOpen, closeSettings, activeTab, setActiveTab } = useSettings();
    const { autoApplyAccess, refreshAutoApplyAccess } = useAuth();
    const { selectedCountry, setSelectedCountry, countries } = useCountry();
    const { t, i18n } = useTranslation();

    // Profile State
    const [profile, setProfile] = useState({
        name: '',
        skills: '',
        personality: '',
        availability: ''
    });
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [accentColor, setAccentColor] = useState('#10a37f');

    // Admin tab state
    const [autoApplyEnabled, setAutoApplyEnabled] = useState(false);
    const [loadingFlag, setLoadingFlag] = useState(false);
    const [togglingFlag, setTogglingFlag] = useState(false);

    useEffect(() => {
        if (isSettingsOpen && activeTab === 'personalization') {
            loadProfile();
        }
        if (isSettingsOpen && activeTab === 'admin') {
            loadAutoApplyFlag();
        }
    }, [isSettingsOpen, activeTab]);

    const loadAutoApplyFlag = async () => {
        try {
            setLoadingFlag(true);
            const data = await featureFlagsAPI.get('auto_apply_enabled');
            setAutoApplyEnabled(data.value);
        } catch (err) {
            console.error('Error loading auto_apply_enabled flag:', err);
        } finally {
            setLoadingFlag(false);
        }
    };

    const handleToggleAutoApply = async (checked) => {
        try {
            setTogglingFlag(true);
            await featureFlagsAPI.set('auto_apply_enabled', checked);
            setAutoApplyEnabled(checked);
            // Refresh access state across the app
            await refreshAutoApplyAccess();
        } catch (err) {
            console.error('Error toggling auto_apply_enabled:', err);
        } finally {
            setTogglingFlag(false);
        }
    };

    const loadProfile = async () => {
        try {
            setLoadingProfile(true);
            const data = await profileAPI.get();
            setProfile(data);
        } catch (err) {
            console.error('Error loading profile:', err);
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const saveProfile = async () => {
        try {
            setSavingProfile(true);
            await profileAPI.update(profile);
            // Show success feedback
        } catch (err) {
            console.error('Error saving profile:', err);
        } finally {
            setSavingProfile(false);
        }
    };

    const languages = [
        { code: 'en', label: 'English' },
        { code: 'nl', label: 'Nederlands' },
        { code: 'de', label: 'Deutsch' },
        { code: 'pl', label: 'Polski' },
        { code: 'ua', label: 'Українська' }
    ];

    if (!isSettingsOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closeSettings}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-6xl h-[700px] bg-[#0d0d0d] text-gray-100 rounded-xl shadow-2xl flex overflow-hidden border border-gray-800"
                >
                    {/* Sidebar */}
                    <div className="w-64 bg-[#0d0d0d] border-r border-gray-800 p-4 flex flex-col">
                        <h2 className="text-lg font-semibold mb-6 px-4 text-white">{t('settings.title')}</h2>
                        <nav className="space-y-1">
                            <button
                                onClick={() => setActiveTab('general')}
                                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                                    }`}
                            >
                                {t('settings.generalTab')}
                            </button>
                            <button
                                onClick={() => setActiveTab('personalization')}
                                className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'personalization' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                                    }`}
                            >
                                {t('settings.personalizationTab')}
                            </button>
                            {autoApplyAccess.isPrivileged && (
                                <button
                                    onClick={() => setActiveTab('admin')}
                                    className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'admin' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                                        }`}
                                >
                                    Admin
                                </button>
                            )}
                        </nav>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 bg-[#0d0d0d]">
                        {activeTab === 'general' && (
                            <div className="space-y-8 max-w-xl">
                                <section>
                                    <h3 className="text-lg font-medium text-white mb-4">{t('settings.generalSection')}</h3>

                                    {/* Language */}
                                    <div className="flex items-center justify-between py-3 border-b border-gray-800">
                                        <label className="text-sm text-gray-300">{t('settings.language')}</label>
                                        <select
                                            value={i18n.language}
                                            onChange={(e) => i18n.changeLanguage(e.target.value)}
                                            className="bg-transparent text-gray-300 text-sm focus:outline-none cursor-pointer"
                                        >
                                            {languages.map(lang => (
                                                <option key={lang.code} value={lang.code} className="bg-[#0d0d0d]">
                                                    {lang.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Country */}
                                    <div className="flex items-center justify-between py-3 border-b border-gray-800">
                                        <label className="text-sm text-gray-300">{t('settings.country')}</label>
                                        <select
                                            value={selectedCountry.code}
                                            onChange={(e) => {
                                                const country = countries.find(c => c.code === e.target.value);
                                                setSelectedCountry(country);
                                            }}
                                            className="bg-transparent text-gray-300 text-sm focus:outline-none cursor-pointer"
                                        >
                                            {countries.map(country => (
                                                <option key={country.code} value={country.code} className="bg-[#0d0d0d]">
                                                    {country.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Accent Color */}
                                    <div className="flex items-center justify-between py-3 border-b border-gray-800">
                                        <label className="text-sm text-gray-300">{t('settings.accentColor')}</label>
                                        <div className="flex gap-2">
                                            {THEME_COLORS.map(color => (
                                                <button
                                                    key={color.name}
                                                    onClick={() => setAccentColor(color.value)}
                                                    className={`w-6 h-6 rounded-full border-2 ${accentColor === color.value ? 'border-white' : 'border-transparent'}`}
                                                    style={{ backgroundColor: color.value }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'personalization' && (
                            <div className="space-y-6 max-w-3xl">
                                <h3 className="text-lg font-medium text-white mb-4">{t('settings.personalizationSection')}</h3>

                                {loadingProfile ? (
                                    <div className="text-gray-400">{t('settings.loadingProfile')}</div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-1">{t('settings.nameLabel')}</label>
                                            <input
                                                type="text"
                                                name="name"
                                                value={profile.name}
                                                onChange={handleProfileChange}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gray-500"
                                                placeholder={t('settings.namePlaceholder')}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-1">{t('settings.skillsLabel')}</label>
                                            <textarea
                                                name="skills"
                                                value={profile.skills}
                                                onChange={handleProfileChange}
                                                rows={3}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gray-500"
                                                placeholder={t('settings.skillsPlaceholder')}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-1">{t('settings.personalityLabel')}</label>
                                            <textarea
                                                name="personality"
                                                value={profile.personality}
                                                onChange={handleProfileChange}
                                                rows={3}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gray-500"
                                                placeholder={t('settings.personalityPlaceholder')}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-1">{t('settings.availabilityLabel')}</label>
                                            <input
                                                type="text"
                                                name="availability"
                                                value={profile.availability}
                                                onChange={handleProfileChange}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gray-500"
                                                placeholder={t('settings.availabilityPlaceholder')}
                                            />
                                        </div>

                                        <div className="pt-4">
                                            <button
                                                onClick={saveProfile}
                                                disabled={savingProfile}
                                                className="px-4 py-2 bg-[#10a37f] text-white rounded-lg text-sm font-medium hover:bg-[#0d8c6d] transition-colors disabled:opacity-50"
                                            >
                                                {savingProfile ? t('common.saving') : t('common.save')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'admin' && autoApplyAccess.isPrivileged && (
                            <div className="space-y-8 max-w-xl">
                                <section>
                                    <h3 className="text-lg font-medium text-white mb-2">Admin Settings</h3>
                                    <p className="text-sm text-gray-400 mb-6">Manage feature flags and system-wide settings.</p>

                                    <div className="flex items-center justify-between py-4 px-4 bg-gray-800/50 rounded-lg border border-gray-700">
                                        <div>
                                            <label className="text-sm font-medium text-gray-200" htmlFor="auto-apply-toggle">
                                                Enable Auto Apply
                                            </label>
                                            <p className="text-xs text-gray-500 mt-1">
                                                When disabled, only admin and owner can access Auto Apply.
                                            </p>
                                        </div>
                                        {loadingFlag ? (
                                            <div className="w-9 h-5 bg-gray-700 rounded-full animate-pulse" />
                                        ) : (
                                            <Switch
                                                id="auto-apply-toggle"
                                                checked={autoApplyEnabled}
                                                onCheckedChange={handleToggleAutoApply}
                                                disabled={togglingFlag}
                                            />
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}
                    </div>

                    {/* Close button */}
                    <button
                        onClick={closeSettings}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default SettingsModal;
