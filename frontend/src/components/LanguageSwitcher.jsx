import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

const languages = [
    { code: 'en', label: 'EN', name: 'English', flagCode: 'gb' },
    { code: 'nl', label: 'NL', name: 'Nederlands', flagCode: 'nl' },
    { code: 'de', label: 'DE', name: 'Deutsch', flagCode: 'de' },
    { code: 'pl', label: 'PL', name: 'Polski', flagCode: 'pl' },
    { code: 'ua', label: 'UA', name: 'Українська', flagCode: 'ua' }
];

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = React.useState(false);

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    const changeLanguage = (langCode) => {
        i18n.changeLanguage(langCode);
        setIsOpen(false);
    };

    return (
        <div className="relative z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 bg-white"
            >
                <img
                    src={`https://flagcdn.com/w40/${currentLang.flagCode}.png`}
                    srcSet={`https://flagcdn.com/w80/${currentLang.flagCode}.png 2x`}
                    alt={currentLang.name}
                    className="w-6 h-4 object-cover rounded-sm shadow-sm"
                />
                <span className="text-sm font-medium text-gray-700">{currentLang.label}</span>
                <svg
                    className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.1 }}
                            className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                        >
                            <div className="py-1">
                                {languages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => changeLanguage(lang.code)}
                                        className={`
                      w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors
                      ${i18n.language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}
                    `}
                                    >
                                        <img
                                            src={`https://flagcdn.com/w40/${lang.flagCode}.png`}
                                            srcSet={`https://flagcdn.com/w80/${lang.flagCode}.png 2x`}
                                            alt={lang.name}
                                            className="w-6 h-4 object-cover rounded-sm shadow-sm"
                                        />
                                        <span className="text-sm font-medium">{lang.name}</span>
                                        {i18n.language === lang.code && (
                                            <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default LanguageSwitcher;
