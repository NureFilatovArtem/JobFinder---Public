import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Match Score Badge Component
 * Displays a vacancy match score (0-100%) with rounded corners
 * Shows color gradient based on score and optional tooltip with breakdown
 */
const MatchScoreBadge = ({ score, breakdown, className = '' }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Ensure score is valid
  const validScore = Math.min(Math.max(score || 0, 0), 100);

  // Determine color based on score
  const getColorClasses = (score) => {
    if (score >= 80) {
      return 'bg-gradient-to-r from-green-500 to-emerald-600 text-white';
    } else if (score >= 60) {
      return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-white';
    } else if (score >= 40) {
      return 'bg-gradient-to-r from-orange-400 to-orange-600 text-white';
    } else {
      return 'bg-gradient-to-r from-red-400 to-red-600 text-white';
    }
  };

  // Get descriptive text based on score
  const getScoreText = (score) => {
    if (score >= 80) return 'Excellent Match';
    if (score >= 60) return 'Good Match';
    if (score >= 40) return 'Fair Match';
    return 'Low Match';
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          px-4 py-2 rounded-2xl font-bold text-sm shadow-lg cursor-pointer
          ${getColorClasses(validScore)}
          hover:shadow-xl transition-all duration-200 hover:scale-105
        `}
      >
        <div className="flex items-center gap-2">
          <span>{validScore}% Match</span>
        </div>
      </motion.div>

      {/* Tooltip with breakdown */}
      <AnimatePresence>
        {showTooltip && breakdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50"
          >
            <div className="bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl min-w-[250px]">
              <p className="font-semibold mb-2 text-sm border-b border-gray-700 pb-2">
                {getScoreText(validScore)}
              </p>
              <div className="space-y-1 text-xs">
                {breakdown.skills !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Skills:</span>
                    <span className="font-semibold">{breakdown.skills}%</span>
                  </div>
                )}
                {breakdown.experience !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Experience:</span>
                    <span className="font-semibold">{breakdown.experience}%</span>
                  </div>
                )}
                {breakdown.languages !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Languages:</span>
                    <span className="font-semibold">{breakdown.languages}%</span>
                  </div>
                )}
                {breakdown.location !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Location:</span>
                    <span className="font-semibold">{breakdown.location}%</span>
                  </div>
                )}
                {breakdown.salary !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Salary:</span>
                    <span className="font-semibold">{breakdown.salary}%</span>
                  </div>
                )}
                {breakdown.jobType !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-300">Job Type:</span>
                    <span className="font-semibold">{breakdown.jobType}%</span>
                  </div>
                )}
              </div>
              {/* Tooltip arrow */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-gray-900"></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MatchScoreBadge;
