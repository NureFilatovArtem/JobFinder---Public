import React from 'react';
import { useCountry } from '../context/CountryContext';
import { motion, AnimatePresence } from 'framer-motion';

const CountrySwitcher = () => {
    const { selectedCountry, setSelectedCountry, countries } = useCountry();
    const [isOpen, setIsOpen] = React.useState(false);

    const handleSelect = (country) => {
        setSelectedCountry(country);
        setIsOpen(false);
    };

    return (
        <div className="relative z-50 mr-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200 bg-white"
            >
                <img
                    src={`https://flagcdn.com/w40/${selectedCountry.code.toLowerCase()}.png`}
                    srcSet={`https://flagcdn.com/w80/${selectedCountry.code.toLowerCase()}.png 2x`}
                    alt={selectedCountry.name}
                    className="w-6 h-4 object-cover rounded-sm shadow-sm"
                />
                <span className="text-sm font-medium text-gray-700">{selectedCountry.code}</span>
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
                                {countries.map((country) => (
                                    <button
                                        key={country.code}
                                        onClick={() => handleSelect(country)}
                                        className={`
                      w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 transition-colors
                      ${selectedCountry.code === country.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}
                    `}
                                    >
                                        <img
                                            src={`https://flagcdn.com/w40/${country.code.toLowerCase()}.png`}
                                            srcSet={`https://flagcdn.com/w80/${country.code.toLowerCase()}.png 2x`}
                                            alt={country.name}
                                            className="w-6 h-4 object-cover rounded-sm shadow-sm"
                                        />
                                        <span className="text-sm font-medium">{country.name}</span>
                                        {selectedCountry.code === country.code && (
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

export default CountrySwitcher;
