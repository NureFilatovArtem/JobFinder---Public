import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useCountry } from '../context/CountryContext';
import { Checkbox } from './ui/checkbox';
import { SlidersHorizontal, LocateFixed, MapPin, X, Tag } from 'lucide-react';
import RegionAutocomplete from './RegionAutocomplete';
import { useGeolocation } from '../hooks/useGeolocation';
import { RADIUS_OPTIONS } from '../utils/distanceUtils';
import { cityToCoords } from '../data/belgianCoords';
import { useAuth } from '../context/AuthContext';

// Job categories — matches backend config/jobCategories.js
const JOB_CATEGORIES = [
  { id: 'student', emoji: '🎓' },
  { id: 'sales', emoji: '🛒' },
  { id: 'admin', emoji: '📋' },
  { id: 'logistics', emoji: '📦' },
  { id: 'hospitality', emoji: '🍽️' },
  { id: 'technical', emoji: '🔧' },
  { id: 'healthcare', emoji: '🏥' },
  { id: 'it', emoji: '💻' },
  { id: 'cleaning', emoji: '🧹' },
  { id: 'production', emoji: '🏭' },
  { id: 'transport', emoji: '🚛' },
  { id: 'construction', emoji: '🏗️' },
  { id: 'education', emoji: '📚' },
  { id: 'security', emoji: '🔒' },
  { id: 'finance', emoji: '💰' },
  { id: 'gardening', emoji: '🌿' },
  { id: 'retail', emoji: '🏪' },
];

// Employment type definitions
const EMPLOYMENT_TYPES = [
  { id: 'fulltime', emoji: '🕐' },
  { id: 'parttime', emoji: '⏰' },
  { id: 'student', emoji: '🎓' },
  { id: 'flexi', emoji: '⚡' },
];

// Smart search shortcuts
const SMART_SEARCHES = [
  { i18nKey: 'retailFulltime', keywords: 'winkel verkoper kassamedewerker', categories: ['retail', 'sales'] },
  { i18nKey: 'studentJobs', keywords: 'studentenjob jobstudent flexi', categories: ['student'] },
  { i18nKey: 'construction', keywords: 'bouwvakker technicus monteur', categories: ['construction', 'technical'] },
  { i18nKey: 'itJobs', keywords: 'developer software engineer ICT', categories: ['it'] },
  { i18nKey: 'cleaning', keywords: 'schoonmaak poetshulp reiniging', categories: ['cleaning'] },
  { i18nKey: 'warehouse', keywords: 'magazijnier orderpicker logistiek', categories: ['logistics'] },
  { i18nKey: 'hospitality', keywords: 'ober kok barista horeca', categories: ['hospitality'] },
  { i18nKey: 'healthcare', keywords: 'verpleegkundige verzorgende zorgkundige', categories: ['healthcare'] },
];

// Build city options from belgianCoords
const CITY_OPTIONS = Object.entries(cityToCoords)
  .filter(([key]) => key !== 'unknown')
  .reduce((acc, [key, val]) => {
    const coordKey = `${val.lat},${val.lng}`;
    if (!acc.seen.has(coordKey)) {
      acc.seen.add(coordKey);
      acc.cities.push({ label: key.charAt(0).toUpperCase() + key.slice(1), lat: val.lat, lng: val.lng });
    }
    return acc;
  }, { seen: new Set(), cities: [] }).cities.sort((a, b) => a.label.localeCompare(b.label));


const SearchFilters = ({ onSearch, onFilterChange }) => {
  const [keywords, setKeywords] = useState('');
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAdditionalFilters, setShowAdditionalFilters] = useState(false);
  const [autoApplyOnly, setAutoApplyOnly] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [excludedCategories, setExcludedCategories] = useState([]);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState([]);
  const { t } = useTranslation();
  const { selectedCountry } = useCountry();
  const { autoApplyAccess } = useAuth();
  const geo = useGeolocation();

  // Proximity state
  const [userOrigin, setUserOrigin] = useState(null);
  const [radiusKm, setRadiusKm] = useState(null);
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Update origin when geolocation succeeds
  useEffect(() => {
    if (geo.coords) {
      setUserOrigin({ lat: geo.coords.lat, lng: geo.coords.lng, label: t('filters.myLocation') });
      if (!radiusKm) setRadiusKm(25);
    }
  }, [geo.coords]);

  // Reset selected regions when country changes
  useEffect(() => {
    setSelectedRegions([]);
  }, [selectedCountry]);

  // Notify parent when filters change (including proximity)
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({ autoApplyOnly, userOrigin, radiusKm, selectedCategories, excludedCategories, selectedEmploymentTypes });
    }
  }, [autoApplyOnly, userOrigin, radiusKm, selectedCategories, excludedCategories, selectedEmploymentTypes]);

  // Tri-state category toggle: off → include → exclude → off
  const toggleCategory = (catId) => {
    const isIncluded = selectedCategories.includes(catId);
    const isExcluded = excludedCategories.includes(catId);

    if (!isIncluded && !isExcluded) {
      // off → include
      setSelectedCategories(prev => [...prev, catId]);
    } else if (isIncluded) {
      // include → exclude
      setSelectedCategories(prev => prev.filter(c => c !== catId));
      setExcludedCategories(prev => [...prev, catId]);
    } else {
      // exclude → off
      setExcludedCategories(prev => prev.filter(c => c !== catId));
    }
  };

  // Smart search: fill keywords + select categories
  const applySmartSearch = (smart) => {
    setKeywords(smart.keywords);
    setSelectedCategories(smart.categories);
    setExcludedCategories([]);
  };

  const handleSearch = () => {
    onSearch({
      keywords: keywords.trim(),
      regions: selectedRegions,
      jobTypes: [],
      country: selectedCountry.code
    });
  };

  // City selector
  const filteredCityOptions = useMemo(() => {
    if (!citySearch) return CITY_OPTIONS.slice(0, 15);
    return CITY_OPTIONS.filter(c => c.label.toLowerCase().includes(citySearch.toLowerCase())).slice(0, 15);
  }, [citySearch]);

  const selectCity = (city) => {
    setUserOrigin({ lat: city.lat, lng: city.lng, label: city.label });
    setCitySearch('');
    setShowCityDropdown(false);
    if (!radiusKm) setRadiusKm(25);
  };

  const clearOrigin = () => {
    setUserOrigin(null);
    setRadiusKm(null);
    setCitySearch('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-gray-100 mb-8">
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-gray-900 tracking-tight">{t('filters.title')}</h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all duration-200"
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
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-clip"
              style={{ overflow: 'visible' }}
            >
              <div className="space-y-6">
                {/* Keywords */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('filters.keywords')}
                  </label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder={t('filters.keywordsPlaceholder')}
                    className="w-full px-6 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-400 bg-gray-50 hover:bg-white appearance-none"
                    style={{
                      borderRadius: '1rem',
                      boxSizing: 'border-box'
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>

                {/* Regions — Autocomplete */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    {t('filters.region')} ({selectedCountry.name})
                  </label>
                  <RegionAutocomplete
                    selectedRegions={selectedRegions}
                    onRegionsChange={setSelectedRegions}
                  />
                </div>

                {/* Proximity Filter */}
                <div className="bg-blue-50/50 rounded-xl border border-blue-100 p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    📍 {t('filters.proximity')}
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Use my location */}
                    <button
                      onClick={geo.requestLocation}
                      disabled={geo.loading}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${userOrigin && userOrigin.label === 'My Location'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-blue-700 hover:bg-blue-100 border border-blue-200'
                        }`}
                    >
                      <LocateFixed className="w-4 h-4" />
                      {geo.loading ? t('filters.detecting') : t('filters.myLocation')}
                    </button>

                    <span className="text-xs text-gray-400">{t('filters.or')}</span>

                    {/* City selector */}
                    <div className="relative">
                      <input
                        type="text"
                        value={citySearch}
                        onChange={(e) => {
                          setCitySearch(e.target.value);
                          setShowCityDropdown(true);
                        }}
                        onFocus={() => setShowCityDropdown(true)}
                        onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                        placeholder={t('filters.selectCityPlaceholder')}
                        className="px-3 py-2 w-44 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      {showCityDropdown && filteredCityOptions.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-44 bg-white border rounded-lg shadow-xl max-h-40 overflow-y-auto">
                          {filteredCityOptions.map(city => (
                            <button
                              key={`${city.lat}-${city.lng}`}
                              onMouseDown={() => selectCity(city)}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors"
                            >
                              <MapPin className="w-3 h-3 inline mr-1.5 text-gray-400" />
                              {city.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Radius buttons */}
                    {userOrigin && (
                      <>
                        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                          {RADIUS_OPTIONS.map(opt => (
                            <button
                              key={opt.label}
                              onClick={() => setRadiusKm(opt.value)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${radiusKm === opt.value
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Active badge */}
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs border border-blue-200">
                          <MapPin className="w-3 h-3" />
                          {userOrigin.label}
                          <button onClick={clearOrigin} className="hover:text-red-600">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {geo.error && (
                    <p className="text-xs text-amber-600 mt-2">⚠️ {geo.error}</p>
                  )}
                </div>

                {/* Search Button */}
                <button
                  onClick={handleSearch}
                  disabled={!keywords.trim()}
                  className="w-full px-6 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium text-base shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 disabled:shadow-none"
                >
                  {t('filters.searchButton')}
                </button>

                {/* Additional Filters Toggle */}
                <button
                  onClick={() => setShowAdditionalFilters(!showAdditionalFilters)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors duration-200 mt-2"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {t('filters.additionalFilters')}
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${showAdditionalFilters ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {(autoApplyOnly || selectedCategories.length > 0 || excludedCategories.length > 0 || selectedEmploymentTypes.length > 0) && (
                    <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full" />
                  )}
                </button>

                {/* Smart Search Shortcuts */}
                <div className="flex flex-wrap gap-2 mt-1">
                  {SMART_SEARCHES.map(smart => (
                    <button
                      key={smart.i18nKey}
                      onClick={() => applySmartSearch(smart)}
                      className="text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200 hover:border-blue-400 hover:shadow-sm transition-all duration-200 font-medium"
                    >
                      {t(`filters.smartSearches.${smart.i18nKey}`)}
                    </button>
                  ))}
                </div>

                {/* Additional Filters Content */}
                <AnimatePresence>
                  {showAdditionalFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
                        {/* Employment Type Chips */}
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm font-medium text-gray-700">{t('filters.employmentType')}</span>
                            {selectedEmploymentTypes.length > 0 && (
                              <button
                                onClick={() => setSelectedEmploymentTypes([])}
                                className="text-xs text-blue-600 hover:text-blue-800 ml-auto"
                              >
                                {t('filters.clear')}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {EMPLOYMENT_TYPES.map(type => {
                              const isSelected = selectedEmploymentTypes.includes(type.id);
                              return (
                                <button
                                  key={type.id}
                                  onClick={() => {
                                    setSelectedEmploymentTypes(prev =>
                                      isSelected
                                        ? prev.filter(t => t !== type.id)
                                        : [...prev, type.id]
                                    );
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border ${isSelected
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
                                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                    }`}
                                >
                                  <span>{type.emoji}</span>
                                  {t(`filters.employmentChips.${type.id}`)}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Category Chips — Tri-state: off → include (blue) → exclude (red) → off */}
                        <div className="pt-3 border-t border-gray-200">
                          <div className="flex items-center gap-2 mb-3">
                            <Tag className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">{t('filters.jobCategories')}</span>
                            <span className="text-[10px] text-gray-400">{t('filters.categoriesHint')}</span>
                            {(selectedCategories.length > 0 || excludedCategories.length > 0) && (
                              <button
                                onClick={() => { setSelectedCategories([]); setExcludedCategories([]); }}
                                className="text-xs text-blue-600 hover:text-blue-800 ml-auto"
                              >
                                {t('filters.clearAll')}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {JOB_CATEGORIES.map(cat => {
                              const isIncluded = selectedCategories.includes(cat.id);
                              const isExcluded = excludedCategories.includes(cat.id);
                              return (
                                <button
                                  key={cat.id}
                                  onClick={() => toggleCategory(cat.id)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${isIncluded
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200'
                                      : isExcluded
                                        ? 'bg-red-50 text-red-600 border-red-300 line-through'
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                                    }`}
                                >
                                  <span>{cat.emoji}</span>
                                  {t(`filters.categoryChips.${cat.id}`)}
                                  {isExcluded && <X className="w-3 h-3 ml-0.5" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Auto Apply Filter — admin/owner only */}
                        {autoApplyAccess?.hasAccess && (
                        <div className="flex items-center space-x-3 pt-3 border-t border-gray-200">
                          <Checkbox
                            id="auto-apply-filter"
                            checked={autoApplyOnly}
                            onCheckedChange={(checked) => setAutoApplyOnly(!!checked)}
                          />
                          <label
                            htmlFor="auto-apply-filter"
                            className="text-sm font-medium text-gray-700 cursor-pointer select-none leading-snug"
                          >
                            {t('filters.autoApplyAvailable')}
                            <span className="block text-xs text-gray-400 font-normal mt-0.5">
                              {t('filters.autoApplyAvailableHint')}
                            </span>
                          </label>
                        </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SearchFilters;
