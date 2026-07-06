import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const VacancyItem = ({ vacature, onGenerateMotivation, isGenerating, profile }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {vacature.title}
            </h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-medium">{t('vacancy.companyLabel')}</span> {vacature.company || t('common.unknown')}
              </p>
              <p>
                <span className="font-medium">{t('vacancy.locationLabel')}</span> {vacature.location || t('common.unknown')}
              </p>
              {vacature.source && (
                <p>
                  <span className="font-medium">{t('vacancy.sourceLabel')}</span> {vacature.source}
                </p>
              )}
            </div>
          </div>

          {vacature.description && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition"
              aria-label={isExpanded ? t('vacancy.hideDescription') : t('vacancy.showDescription')}
            >
              {isExpanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          )}
        </div>

        <AnimatePresence>
          {isExpanded && vacature.description && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="font-medium text-gray-700 mb-2">{t('vacancy.descriptionLabel')}</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {vacature.description}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onGenerateMotivation(vacature.id)}
            disabled={isGenerating || !profile}
            className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isGenerating ? t('common.generating') : t('vacancy.generateMotivation')}
          </button>
          {vacature.link && (
            <a
              href={vacature.link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 transition"
            >
              {t('vacancy.viewVacancy')}
            </a>
          )}
        </div>

        {vacature.motivation && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg"
          >
            <h4 className="font-medium text-green-800 mb-2">{t('vacancy.motivationLetterLabel')}</h4>
            <p className="text-sm text-green-900 whitespace-pre-wrap">
              {vacature.motivation}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(vacature.motivation);
                toast.success(t('vacancy.motivationCopied'));
              }}
              className="mt-2 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition"
            >
              {t('vacancy.copyLetter')}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default VacancyItem;
