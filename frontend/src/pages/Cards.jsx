import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { vacaturesAPI } from '../api/vacatures';
import { useTranslation } from 'react-i18next';

const getInterestingStorageKey = (vacatureId) => `vacancy_${vacatureId}_interesting`;
const getDismissedStorageKey = (vacatureId) => `vacancy_${vacatureId}_not_interested`;

const isVacatureAvailableForSwipe = (vacature) => {
  const isInteresting = localStorage.getItem(getInterestingStorageKey(vacature.id)) === 'true';
  const isDismissed = localStorage.getItem(getDismissedStorageKey(vacature.id)) === 'true';

  return !isInteresting
    && !isDismissed
    && vacature.status !== 'interessant'
    && vacature.status !== 'niet_interessant'
    && vacature.status !== 'toegepast';
};

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

const Cards = () => {
  const [vacatures, setVacatures] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(0);
  const [notification, setNotification] = useState(null);
  const notificationIntervalRef = useRef(null);
  const lastNotificationTimeRef = useRef(0);
  const { t } = useTranslation();

  useEffect(() => {
    loadVacatures();
    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Show notification at least once every 5 seconds
    if (notificationIntervalRef.current) {
      clearInterval(notificationIntervalRef.current);
    }

    notificationIntervalRef.current = setInterval(() => {
      const now = Date.now();
      if (now - lastNotificationTimeRef.current >= 5000 && notification) {
        showNotification(notification);
      }
    }, 5000);

    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }
    };
  }, [notification]);

  const showNotification = (message) => {
    setNotification(message);
    lastNotificationTimeRef.current = Date.now();
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const loadVacatures = async () => {
    try {
      setLoading(true);
      const data = await vacaturesAPI.getAll();
      setVacatures(data.filter(isVacatureAvailableForSwipe));
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading vacatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction) => {
    if (currentIndex >= vacatures.length) return;

    const currentVacature = vacatures[currentIndex];
    setDirection(direction);

    if (direction === 1) {
      // Swipe right - save vacancy to the selected/saved list
      localStorage.setItem(getInterestingStorageKey(currentVacature.id), 'true');
      localStorage.removeItem(getDismissedStorageKey(currentVacature.id));
      await vacaturesAPI.updateStatus(currentVacature.id, 'interessant');
      showNotification(t('swipeCards.appliedNotification', { title: currentVacature.title }));
    } else if (direction === -1) {
      // Swipe left - Niet interessant
      localStorage.setItem(getDismissedStorageKey(currentVacature.id), 'true');
      localStorage.removeItem(getInterestingStorageKey(currentVacature.id));
      await vacaturesAPI.updateStatus(currentVacature.id, 'niet_interessant');
    }

    // Move to next card
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setDirection(0);
    }, 300);
  };

  const handleCardClick = (vacature) => {
    if (vacature.link) {
      window.open(vacature.link, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (vacatures.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-ds-text-primary mb-4 tracking-tight">
            {t('swipeCards.title')}
          </h1>
        </div>
        <div className="text-center py-20">
          <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
            <svg className="w-12 h-12 text-ds-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
            </svg>
          </div>
          <p className="text-xl text-ds-gray-500 font-medium mb-2">{t('swipeCards.noVacancies')}</p>
          <p className="text-ds-gray-400">{t('swipeCards.searchFirst')}</p>
        </div>
      </div>
    );
  }

  if (currentIndex >= vacatures.length) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            {t('swipeCards.title')}
          </h1>
        </div>
        <div className="text-center py-20">
          <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xl text-gray-500 font-medium mb-2">{t('swipeCards.allReviewed')}</p>
          <p className="text-gray-400 mb-6">{t('swipeCards.searchMore')}</p>
          <button
            onClick={loadVacatures}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all"
          >
            {t('swipeCards.reload')}
          </button>
        </div>
      </div>
    );
  }

  const currentVacature = vacatures[currentIndex];
  const nextVacature = vacatures[currentIndex + 1];

  return (
    <div className="max-w-4xl mx-auto text-center">
      <div className="mb-8">
        <h1 className="text-5xl font-bold text-ds-text-primary mb-4 tracking-tight">
          {t('swipeCards.title')}
        </h1>
        <div className="flex items-center justify-center gap-4 mb-2">
          <p className="text-sm text-ds-gray-500">
            {currentIndex + 1} {t('swipeCards.of')} {vacatures.length}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 inline-block">
          <p className="text-sm text-blue-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {t('swipeCards.instructions')}
          </p>
        </div>
      </div>

      <div className="relative" style={{ height: '600px' }}>
        {/* Next card (background) */}
        {nextVacature && (
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 0.95, opacity: 0.5 }}
            animate={{ scale: 0.95, opacity: 0.5 }}
          >
            <Card vacature={nextVacature} />
          </motion.div>
        )}

        {/* Current card */}
        <AnimatePresence mode="wait">
          <SwipeableCard
            key={currentVacature.id}
            vacature={currentVacature}
            onSwipe={handleSwipe}
            onClick={handleCardClick}
            direction={direction}
          />
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-6 mt-8">
        <button
          onClick={() => handleSwipe(-1)}
          className="px-8 py-3 border-2 border-red-500 text-red-500 bg-transparent hover:bg-red-500 hover:text-white text-lg font-medium rounded-full transition-colors"
        >
          {t('swipeCards.notInterested')}
        </button>
        <button
          onClick={() => handleSwipe(1)}
          className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-medium rounded-full border-none shadow-sm transition-colors"
        >
          {t('swipeCards.apply')}
        </button>
      </div>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="bg-gray-800/90 backdrop-blur-sm text-white px-6 py-4 rounded-2xl shadow-2xl border border-gray-700/50">
              <p className="text-sm font-medium">{notification}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SwipeableCard = ({ vacature, onSwipe, onClick, direction }) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (event, info) => {
    const threshold = 100;
    if (Math.abs(info.offset.x) > threshold) {
      onSwipe(info.offset.x > 0 ? 1 : -1);
    }
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, opacity }}
      initial={{ scale: 1, opacity: 1 }}
      exit={{
        x: direction === 1 ? 300 : -300,
        opacity: 0,
        scale: 0.8,
        transition: { duration: 0.3 }
      }}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
    >
      <Card vacature={vacature} onClick={onClick} />
    </motion.div>
  );
};

const Card = ({ vacature, onClick }) => {
  const { t } = useTranslation();
  const formattedDescription = formatDescription(vacature.description, vacature.location, vacature.postcode);

  return (
    <motion.div
      onClick={() => onClick && onClick(vacature)}
      className="bg-white rounded-3xl shadow-2xl border border-gray-200 h-full overflow-hidden flex flex-col"
    >
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="mb-6">
          <span className="px-4 py-2 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
            {vacature.job_type || 'Vacature'}
          </span>
        </div>

        <h2 className="text-3xl font-bold text-ds-text-primary mb-4 tracking-tight">
          {vacature.title}
        </h2>

        <div className="space-y-3 mb-6">
          <div className="flex items-center space-x-2 text-ds-gray-600">
            <svg className="w-5 h-5 text-ds-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="font-medium">{vacature.company || 'Onbekend'}</span>
          </div>
          <div className="flex items-center space-x-2 text-ds-gray-600">
            <svg className="w-5 h-5 text-ds-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{vacature.location || 'Onbekend'}{vacature.postcode ? ` • ${vacature.postcode}` : ''}</span>
          </div>
        </div>

        {formattedDescription && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-ds-gray-700 mb-3">{t('swipeCards.description')}</h3>
            <p className="text-base text-ds-gray-700 leading-relaxed line-clamp-8">
              {formattedDescription.substring(0, 400)}
              {formattedDescription.length > 400 && '...'}
            </p>
            {vacature.link && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(vacature.link, '_blank');
                }}
                className="mt-4 text-blue-600 hover:text-blue-700 font-semibold text-sm inline-flex items-center gap-1"
              >
                {t('swipeCards.readMore')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {vacature.link && (
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              window.open(vacature.link, '_blank');
            }}
            className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all"
          >
            {t('swipeCards.viewFull')}
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default Cards;
