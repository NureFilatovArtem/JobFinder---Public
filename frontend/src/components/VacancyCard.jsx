import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Gauge } from './ui/Gauge';
import { Checkbox } from './ui/checkbox';
import { calculateMatchScore } from '../utils/matchScoreCalculator';
import { getSourceName, formatDistance } from '../utils/distanceUtils';

// aiScore: number|null from backend (0 is a valid score meaning poor match)
// fallbackScore: number from frontend calculator (used only when aiScore is null)
const MatchScoreGauge = ({ aiScore, fallbackScore, matchDetails, aiAnalysisLabel }) => {
  const hasScore = aiScore != null || fallbackScore != null;
  if (!hasScore) return null;

  const score = aiScore != null ? aiScore : (fallbackScore ?? 0);
  const colorClass = score >= 75 ? 'bg-green-100 text-green-800' : score >= 45 ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800';
  const color = score >= 75 ? 'green' : score >= 45 ? 'orange' : 'gray';

  return (
    <div className="absolute top-4 right-4 z-10">
      <div className={`relative group cursor-help rounded-full p-1 ${colorClass}`}>
        <Gauge value={score} size="medium" showValue={true} color={color} />
        {matchDetails && (
          <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white text-gray-700 text-xs rounded-xl shadow-xl border border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <p className="font-semibold mb-1">{aiAnalysisLabel}</p>
            {matchDetails}
          </div>
        )}
      </div>
    </div>
  );
};

const VacancyCard = ({ vacature, onStatusChange, onGenerateMotivation, isGenerating, profile, isSelected, onToggleSelect, autoApplyStatus, onBlockCompany, distanceKm }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [matchScore, setMatchScore] = useState(null);
  const { t } = useTranslation();

  // Calculate match score when profile or vacancy changes
  useEffect(() => {
    if (profile && vacature) {
      const result = calculateMatchScore(profile, vacature);
      setMatchScore(result);
    }
  }, [profile, vacature]);

  // Format description: remove location repetition and add word spacing
  const formatDescription = (description, location, postcode) => {
    if (!description) return '';

    let formatted = description;

    // Remove location/postcode if it appears at the start or end of description
    if (location) {
      const locationPattern = new RegExp(`^${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[•·]?\\s*`, 'i');
      formatted = formatted.replace(locationPattern, '');
      const locationPatternEnd = new RegExp(`\\s*[•·]?\\s*${location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
      formatted = formatted.replace(locationPatternEnd, '');
    }

    if (postcode) {
      const postcodePattern = new RegExp(`\\s*${postcode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'g');
      formatted = formatted.replace(postcodePattern, ' ');
    }

    // Add spaces between words if they're concatenated (basic heuristic)
    formatted = formatted.replace(/([a-z])([A-Z])/g, '$1 $2');
    formatted = formatted.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

    return formatted.trim();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'toegepast':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'niet_interessant':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'gevonden':
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'toegepast':
        return t('status.applied') || 'Toegepast';
      case 'niet_interessant':
        return t('status.not_interested') || 'Niet interessant';
      case 'gevonden':
      default:
        return t('status.found') || 'Gevonden';
    }
  };

  const getAutoApplyStatusLabel = (status) => {
    switch (status) {
      case 'pending': return { text: t('card.autoApply.pending'), color: 'bg-yellow-100 text-yellow-800' };
      case 'in_progress': return { text: t('card.autoApply.inProgress'), color: 'bg-blue-100 text-blue-800' };
      case 'applied': return { text: t('card.autoApply.applied'), color: 'bg-green-100 text-green-800' };
      case 'failed': return { text: t('card.autoApply.failed'), color: 'bg-red-100 text-red-800' };
      case 'blocked': return { text: t('card.autoApply.blocked'), color: 'bg-gray-100 text-gray-800' };
      default: return null;
    }
  };

  const autoApplyBadge = getAutoApplyStatusLabel(autoApplyStatus);

  return (
    <div
      className={`rounded-2xl shadow-sm hover:shadow-md transition-shadow bg-white overflow-hidden border cursor-pointer flex flex-col h-full ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-50' : 'border-gray-100'}`}
      onClick={() => onToggleSelect && onToggleSelect(vacature.id)}
    >
      <div className="p-6 relative flex flex-col flex-grow">
        {/* Selection Checkbox & Badge Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div onClick={(e) => e.stopPropagation()}>
              <Checkbox
                id={`vacancy-${vacature.id}`}
                checked={isSelected || false}
                onCheckedChange={() => onToggleSelect && onToggleSelect(vacature.id)}
                aria-label={`Select ${vacature.title}`}
              />
            </div>
            {autoApplyBadge && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${autoApplyBadge.color}`}>
                {autoApplyBadge.text}
              </span>
            )}
          </div>
        </div>

        {/* Matching Score - Absolute Positioned */}
        <MatchScoreGauge
          aiScore={vacature.match_score}
          fallbackScore={matchScore?.score}
          matchDetails={vacature.match_details}
          aiAnalysisLabel={t('card.aiAnalysis')}
        />

        <div className="relative">
          {/* Status Badge */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">

              {/* Title and Company */}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight leading-tight pr-16">
                  {vacature.title}
                </h3>
                <div className="flex items-center space-x-2 text-gray-600 mb-4">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="font-medium">{vacature.company || t('common.unknown') || 'Onbekend'}</span>
                </div>

                {/* Structured Vacancy Details - Fixed Order */}
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl">
                  {/* 1. Contract Type */}
                  {vacature.contract_type && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-32 flex-shrink-0 pt-0.5">{t('card.contractType')}:</span>
                      <span className="text-sm text-gray-900 font-medium">{vacature.contract_type}</span>
                    </div>
                  )}

                  {/* 2. Salary */}
                  {(vacature.salary || vacature.salary_min || vacature.salary_max) && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-32 flex-shrink-0 pt-0.5">{t('card.salary')}:</span>
                      <span className="text-sm text-gray-900 font-medium">
                        {vacature.salary_min && vacature.salary_max
                          ? `€${vacature.salary_min.toLocaleString()} - €${vacature.salary_max.toLocaleString()}`
                          : vacature.salary
                            ? `€${vacature.salary.toLocaleString()}`
                            : t('card.negotiable') || 'Negotiable'}
                      </span>
                    </div>
                  )}

                  {/* 3. Location + Distance */}
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-32 flex-shrink-0 pt-0.5">{t('card.location')}:</span>
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm text-gray-900">{vacature.location || t('common.unknown') || 'Onbekend'}{vacature.postcode ? ` (${vacature.postcode})` : ''}</span>
                      {distanceKm != null && (
                        <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                          {formatDistance(distanceKm)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4. Required Experience */}
                  {vacature.experience_required && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-32 flex-shrink-0 pt-0.5">{t('card.experience')}:</span>
                      <span className="text-sm text-gray-900">{vacature.experience_required}</span>
                    </div>
                  )}

                  {/* 5. Additional Details */}
                  {vacature.benefits && vacature.benefits.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-32 flex-shrink-0 pt-0.5">{t('card.benefits')}:</span>
                      <span className="text-sm text-gray-900">{vacature.benefits.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Description Section - Always visible with expand/collapse */}
          <div className="mb-6">
            <button
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              className="flex items-center justify-between w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all duration-200 cursor-pointer group"
              aria-label={isExpanded ? t('card.descriptionHide') : t('card.descriptionShow')}
            >
              <span className="font-semibold text-gray-700 text-sm group-hover:text-gray-900">
                {isExpanded ? t('card.descriptionHide') : t('card.descriptionShow')}
              </span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 p-6 bg-gray-50 rounded-2xl border border-gray-200">
                    {vacature.description && vacature.description.trim() && vacature.description.trim() !== '' ? (
                      <>
                        <div className="text-base text-gray-700 whitespace-pre-wrap max-h-[500px] overflow-y-auto pr-2 leading-relaxed">
                          <p className="word-spacing-normal">{formatDescription(vacature.description, vacature.location, vacature.postcode)}</p>
                        </div>
                        {vacature.description.length >= 1497 && (
                          <p className="text-xs text-gray-400 mt-3 italic">
                            {t('card.descriptionTruncated')}
                          </p>
                        )}
                        {vacature.link && (
                          <a
                            href={vacature.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 underline-offset-2"
                          >
                            <ExternalLink className="w-4 h-4" />
                            {t('card.viewFull')} — {getSourceName(vacature.link)}
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="text-base text-gray-400 italic">{t('card.descriptionNotAvailable')}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons - Refined Design */}
          <div className="flex flex-wrap items-center gap-2 mt-auto pt-4">
            {/* Primary CTA: Solliciteren */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (vacature.link) {
                  window.open(vacature.link, '_blank');
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('card.apply')} → {getSourceName(vacature.link)}
            </button>

            {/* Manual 'Gesolliciteerd' Toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange(vacature.id, vacature.status === 'toegepast' ? 'gevonden' : 'toegepast'); }}
              className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border
              ${vacature.status === 'toegepast'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }
            `}
            >
              {vacature.status === 'toegepast' ? t('card.applied') : t('card.markAsApplied')}
            </button>

            {/* Block Company — placed in middle */}
            {vacature.company && vacature.company !== 'Unknown Company' && onBlockCompany && (
              <button
                onClick={(e) => { e.stopPropagation(); onBlockCompany(vacature.company); }}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border bg-white border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
              {t('card.blockCompany')}
              </button>
            )}

            {/* Secondary Action: Save */}
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange(vacature.id, vacature.status === 'interessant' ? 'gevonden' : 'interessant'); }}
              className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 border
              ${vacature.status === 'interessant'
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                }
            `}
            >
              {vacature.status === 'interessant' ? t('card.saved') : t('card.save')}
            </button>
          </div>

          {/* Motivation Letter */}
          {vacature.motivation && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6 p-6 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl"
            >
              <h4 className="font-semibold text-green-800 mb-3">{t('card.motivationLetter')}</h4>
              <p className="text-sm text-green-900 whitespace-pre-wrap leading-relaxed mb-4">
                {vacature.motivation}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(vacature.motivation);
                  toast.success(t('card.letterCopied'));
                }}
                className="px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 transition-all duration-200 shadow-md shadow-green-200 hover:shadow-lg hover:shadow-green-300"
              >
                {t('card.copyLetter')}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VacancyCard;
