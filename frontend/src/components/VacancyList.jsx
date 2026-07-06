import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import VacancyItem from './VacancyItem';
import { vacaturesAPI } from '../api/vacatures';
import { motivationAPI } from '../api/motivation';

const VacancyList = ({ profile }) => {
  const { t } = useTranslation();
  const [vacatures, setVacatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(new Set());
  const [batchQueue, setBatchQueue] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadVacatures();
  }, []);

  const loadVacatures = async () => {
    try {
      setLoading(true);
      const data = await vacaturesAPI.getAll();
      setVacatures(data);
      setError(null);
    } catch (err) {
      console.error('Error loading vacatures:', err);
      setError(t('errors.vacanciesLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMotivation = async (vacatureId) => {
    if (!profile || (!profile.skills && !profile.personality)) {
      toast.warning(t('vacancy.completeProfile'));
      return;
    }

    // Add to generating set immediately for UI feedback
    setGenerating(prev => new Set(prev).add(vacatureId));

    // Add to batch queue
    const newQueue = [...batchQueue, vacatureId];
    setBatchQueue(newQueue);

    // Process immediately if queue is full, otherwise wait
    if (newQueue.length >= 5) {
      await processBatch(newQueue);
      setBatchQueue([]);
    } else {
      // Wait 1.5 seconds to see if more are added
      setTimeout(async () => {
        setBatchQueue(currentQueue => {
          if (currentQueue.length > 0) {
            processBatch([...currentQueue]);
            return [];
          }
          // If queue was cleared, process single item
          processBatch([vacatureId]);
          return [];
        });
      }, 1500);
    }
  };

  const processBatch = async (vacatureIds) => {
    const idsToProcess = [...new Set(vacatureIds)]; // Remove duplicates

    if (idsToProcess.length === 0) return;

    try {
      const response = await motivationAPI.generate(idsToProcess, profile);

      // Update vacatures with generated motivations
      setVacatures(prevVacatures =>
        prevVacatures.map(vac => {
          const result = response.results.find(r => r.id === vac.id);
          if (result) {
            return { ...vac, motivation: result.letter };
          }
          return vac;
        })
      );
    } catch (err) {
      console.error('Error generating motivations:', err);
      toast.error(t('errors.motivationGenerationFailed') + ': ' + (err.response?.data?.message || err.message));
    } finally {
      // Remove from generating set
      setGenerating(prev => {
        const newSet = new Set(prev);
        idsToProcess.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  if (vacatures.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">{t('vacancy.noVacancies')}</p>
        <p className="text-gray-400 text-sm mt-2">{t('vacancy.addVacanciesHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">
          {t('vacancy.vacanciesLabel')} ({vacatures.length})
        </h2>
        <button
          onClick={loadVacatures}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
        >
          {t('common.refresh')}
        </button>
      </div>

      {vacatures.map((vacature, index) => (
        <motion.div
          key={vacature.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <VacancyItem
            vacature={vacature}
            onGenerateMotivation={handleGenerateMotivation}
            isGenerating={generating.has(vacature.id)}
            profile={profile}
          />
        </motion.div>
      ))}
    </div>
  );
};

export default VacancyList;
