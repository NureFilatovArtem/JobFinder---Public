import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import VacancyCard from '../components/VacancyCard';
import { vacaturesAPI } from '../api/vacatures';
import { motivationAPI } from '../api/motivation';
import { profileAPI } from '../api/profile';

const Found = () => {
  const { t } = useTranslation();
  const [vacatures, setVacatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(new Set());
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    loadProfile();
    loadVacatures();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await profileAPI.get();
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadVacatures = async () => {
    try {
      setLoading(true);
      const data = await vacaturesAPI.getAll('gevonden');
      setVacatures(data);
    } catch (error) {
      console.error('Error loading found vacatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await vacaturesAPI.updateStatus(id, status);
      setVacatures(prev => prev.filter(vac => vac.id !== id));
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleGenerateMotivation = async (vacatureId) => {
    if (!profile) {
      toast.warning(t('pages.found.completeProfile'));
      return;
    }

    setGenerating(prev => new Set(prev).add(vacatureId));

    try {
      const response = await motivationAPI.generate([vacatureId], profile);
      if (response.results && response.results.length > 0) {
        const result = response.results[0];
        setVacatures(prev =>
          prev.map(vac => vac.id === vacatureId ? { ...vac, motivation: result.letter } : vac)
        );
      }
    } catch (error) {
      console.error('Error generating motivation:', error);
    } finally {
      setGenerating(prev => {
        const newSet = new Set(prev);
        newSet.delete(vacatureId);
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

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('pages.found.title')}</h2>
        <p className="text-gray-600">{t('pages.found.subtitle')}</p>
      </div>

      {vacatures.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">{t('pages.found.noResults')}</p>
          <p className="text-gray-400 text-sm mt-2">{t('pages.found.resultsHint')}</p>
        </div>
      )}

      <div className="space-y-4">
        {vacatures.map((vacature, index) => (
          <motion.div
            key={vacature.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <VacancyCard
              vacature={vacature}
              onStatusChange={handleStatusChange}
              onGenerateMotivation={handleGenerateMotivation}
              isGenerating={generating.has(vacature.id)}
              profile={profile}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Found;

