import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import VacancyCard from '../components/VacancyCard';
import { vacaturesAPI } from '../api/vacatures';

const Ignored = () => {
  const { t } = useTranslation();
  const [vacatures, setVacatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVacatures();
  }, []);

  const loadVacatures = async () => {
    try {
      setLoading(true);
      const data = await vacaturesAPI.getAll('niet_interessant');
      setVacatures(data);
    } catch (error) {
      console.error('Error loading ignored vacatures:', error);
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
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{t('pages.ignored.title')}</h2>
        <p className="text-gray-600">{t('pages.ignored.subtitle')}</p>
      </div>

      {vacatures.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">{t('pages.ignored.noResults')}</p>
          <p className="text-gray-400 text-sm mt-2">{t('pages.ignored.resultsHint')}</p>
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
              onGenerateMotivation={() => {}}
              isGenerating={false}
              profile={null}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Ignored;

