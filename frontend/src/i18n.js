import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en/translation.json';
import translationNL from './locales/nl/translation.json';
import translationDE from './locales/de/translation.json';
import translationPL from './locales/pl/translation.json';
import translationUA from './locales/ua/translation.json';

const resources = {
    en: {
        translation: translationEN
    },
    nl: {
        translation: translationNL
    },
    de: {
        translation: translationDE
    },
    pl: {
        translation: translationPL
    },
    ua: {
        translation: translationUA
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        debug: true,
        interpolation: {
            escapeValue: false // not needed for react as it escapes by default
        }
    });

export default i18n;
