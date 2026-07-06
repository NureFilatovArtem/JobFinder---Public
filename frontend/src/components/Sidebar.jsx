import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import AutomationHub from './AutomationHub';

// SVG Icon Components
const ClipboardIcon = ({ className, isActive }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const StarIcon = ({ className, isActive }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

const MapIcon = ({ className, isActive }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
);

const CardsIcon = ({ className, isActive }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
  </svg>
);

const SettingsIcon = ({ className, isActive }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const RocketIcon = ({ className, isActive }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.841m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
  </svg>
);

const ChevronLeftIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRightIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const Sidebar = ({ isOpen: externalIsOpen, onToggle: externalOnToggle }) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const { t } = useTranslation();
  const { openSettings } = useSettings();
  const { autoApplyAccess } = useAuth();

  // Map tab pulse: check if a search just completed
  const [mapTabPulse, setMapTabPulse] = useState(false);

  useEffect(() => {
    const checkPulse = () => {
      if (sessionStorage.getItem('highlightMapTab') === 'true') {
        sessionStorage.removeItem('highlightMapTab');
        setMapTabPulse(true);
        setTimeout(() => setMapTabPulse(false), 4000);
      }
    };
    checkPulse();
    const interval = setInterval(checkPulse, 500);
    return () => clearInterval(interval);
  }, []);

  // Use external state if provided (for mobile), otherwise use internal state (for desktop)
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const setIsOpen = externalOnToggle || setInternalIsOpen;

  const menuItems = [
    {
      path: '/',
      label: t('sidebar.vacancies'),
      icon: ClipboardIcon
    },
    {
      path: '/map',
      label: t('sidebar.demandMap'),
      icon: MapIcon
    },
    {
      path: '/cards',
      label: t('sidebar.cards'),
      icon: CardsIcon
    },
    {
      label: t('sidebar.selected'),
      icon: StarIcon
    },
    // Auto Apply: only visible if user has backend-confirmed access
    ...(autoApplyAccess.hasAccess
      ? [{
          path: '/auto-apply',
          label: 'Auto Apply',
          icon: RocketIcon
        }]
      : []),
  ];

  const toggleSidebar = () => {
    if (externalOnToggle) {
      // Mobile: toggle external state
      externalOnToggle(!isOpen);
    } else {
      // Desktop: toggle collapsed state
      setIsCollapsed(!isCollapsed);
    }
  };

  // On mobile: sidebar should hide when closed
  // On desktop: sidebar should collapse to narrow version when collapsed
  // On desktop (lg and above), always show unless collapsed - ignore external state
  const hasExternalState = externalIsOpen !== undefined;

  // Calculate sidebar width and position
  // On desktop (lg+), always show unless collapsed (ignore external state)
  // On mobile, respect external state
  const isMobileCollapsed = hasExternalState && !isOpen;

  // Calculate width: on desktop use collapsed state, on mobile use external state
  // Desktop (lg+): always show sidebar (280px expanded, 80px collapsed)
  // Mobile: respect external state (0px hidden, 280px shown)
  const getSidebarWidth = () => {
    if (hasExternalState) {
      // External state provided (mobile control)
      // On mobile: use external state (0 or 280)
      // On desktop (lg+): we'll override via CSS to always show (280 or 80)
      return !isOpen ? 0 : 280;
    }
    // No external state = desktop mode, use collapsed state
    return isCollapsed ? 80 : 280;
  };

  const sidebarWidth = getSidebarWidth();

  // Desktop width: always show on desktop, use collapsed state if no external state
  // If external state provided, use collapsed state for desktop override
  const desktopWidth = isCollapsed ? 80 : 280;

  // Use CSS classes for mobile positioning and desktop override
  // On desktop (lg:), always show the sidebar with proper width
  const sidebarClass = hasExternalState
    ? (isMobileCollapsed ? '-translate-x-full lg:translate-x-0' : 'translate-x-0')
    : '';

  return (
    <>
      {/* Backdrop when sidebar is open on mobile */}
      {hasExternalState && isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        data-sidebar="true"
        initial={false}
        animate={{
          width: sidebarWidth
        }}
        transition={{
          duration: 0.25,  // Exactly 250ms as required
          ease: [0.4, 0, 0.2, 1]  // Smooth easing
        }}
        className={`
          fixed lg:sticky top-0 left-0 h-screen bg-ds-bg-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 overflow-hidden
          ${sidebarClass}
        `}
        style={{
          minWidth: sidebarWidth > 0 ? `${sidebarWidth}px` : (hasExternalState && !isOpen ? '0px' : undefined),
          maxWidth: sidebarWidth > 0 ? `${sidebarWidth}px` : undefined,
          ['--desktop-width']: `${desktopWidth}px`
        }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className={`flex items-center ${isCollapsed ? 'justify-center px-3' : 'justify-between px-6'} pt-6 pb-4 border-b border-gray-200 dark:border-gray-800`}>
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.h2
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-lg font-semibold text-ds-text-primary tracking-tight"
                >
                  JobFinder
                </motion.h2>
              )}
            </AnimatePresence>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 flex items-center justify-center group ml-auto"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRightIcon className="w-5 h-5 text-ds-gray-400 group-hover:text-ds-text-primary transition-colors" />
              ) : (
                <ChevronLeftIcon className="w-5 h-5 text-ds-gray-400 group-hover:text-ds-text-primary transition-colors" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {menuItems.map((item, index) => {
              const isActive = location.pathname === item.path;
              const IconComponent = item.icon;

              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  <Link
                    to={item.path}
                    onClick={() => {
                      if (externalOnToggle) {
                        setIsOpen(false);
                      }
                    }}
                    className={`
                      relative flex items-center gap-3 px-4 py-3.5 rounded-xl
                      transition-all duration-200 group
                      ${isActive
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-ds-gray-600 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                      }
                      ${isCollapsed ? 'justify-center px-3' : ''}
                      ${mapTabPulse && item.path === '/map' ? 'animate-map-pulse ring-2 ring-blue-400 ring-opacity-75 bg-blue-50 dark:bg-blue-900/20' : ''}
                    `}
                    title={isCollapsed ? item.label : ''}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gray-900 dark:bg-white rounded-r-full"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}

                    {/* Icon */}
                    <div className={`
                      flex-shrink-0 transition-transform duration-200
                      ${isActive ? 'text-gray-900 dark:text-white' : 'text-ds-gray-400 group-hover:text-gray-900 dark:group-hover:text-white'}
                      ${isCollapsed ? '' : ''}
                    `}>
                      <IconComponent
                        className="w-5 h-5"
                        isActive={isActive}
                      />
                    </div>

                    {/* Label */}
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                          className={`
                            text-sm font-medium whitespace-nowrap
                            ${isActive ? 'text-gray-900 dark:text-white' : 'text-ds-gray-600 group-hover:text-gray-900 dark:group-hover:text-white'}
                          `}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>


                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* Automation Hub Section */}
          <div className="border-t border-gray-200 dark:border-gray-800">
            <AutomationHub isCollapsed={isCollapsed} userId={1} />
          </div>

          {/* Footer / Bottom section */}
          <div className="px-3 py-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={() => openSettings('general')}
              className={`
                w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                transition-all duration-200 group
                text-ds-gray-600 hover:text-ds-text-primary hover:bg-gray-50 dark:hover:bg-gray-800
                ${isCollapsed ? 'justify-center px-3' : ''}
              `}
              title={isCollapsed ? 'Settings' : ''}
            >
              <div className="flex-shrink-0 text-ds-gray-400 group-hover:text-ds-text-primary transition-colors">
                <SettingsIcon className="w-5 h-5" />
              </div>

              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm font-medium whitespace-nowrap"
                  >
                    Settings
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
