import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { profileAPI } from '../api/profile';

const ProfileForm = ({ onProfileUpdate }) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState({
    name: '',
    skills: '',
    personality: '',
    availability: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await profileAPI.get();
      setProfile(data);
      if (onProfileUpdate) {
        onProfileUpdate(data);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
    setSaved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await profileAPI.update(profile);
      setProfile(updated);
      setSaved(true);
      if (onProfileUpdate) {
        onProfileUpdate(updated);
      }
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error(t('profileForm.saveFailed'));
    } finally {
      setSaving(false);
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-200 rounded-lg shadow-sm p-6"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{t('profileForm.title')}</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            {t('profileForm.nameLabel')}
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={profile.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('profileForm.namePlaceholder')}
          />
        </div>

        <div>
          <label htmlFor="skills" className="block text-sm font-medium text-gray-700 mb-2">
            {t('profileForm.skillsLabel')}
          </label>
          <textarea
            id="skills"
            name="skills"
            value={profile.skills}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('profileForm.skillsPlaceholder')}
          />
        </div>

        <div>
          <label htmlFor="personality" className="block text-sm font-medium text-gray-700 mb-2">
            {t('profileForm.personalityLabel')}
          </label>
          <textarea
            id="personality"
            name="personality"
            value={profile.personality}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('profileForm.personalityPlaceholder')}
          />
        </div>

        <div>
          <label htmlFor="availability" className="block text-sm font-medium text-gray-700 mb-2">
            {t('profileForm.availabilityLabel')}
          </label>
          <input
            type="text"
            id="availability"
            name="availability"
            value={profile.availability}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('profileForm.availabilityPlaceholder')}
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? t('profileForm.saving') : t('profileForm.save')}
          </button>

          {saved && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-green-600 text-sm font-medium"
            >
              {t('profileForm.saved')}
            </motion.span>
          )}
        </div>
      </form>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>{t('profileForm.tip')}</strong> {t('profileForm.tipText')}
        </p>
      </div>
    </motion.div>
  );
};

export default ProfileForm;
