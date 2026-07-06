import React from 'react';
import ResumeSection from '../components/ResumeSection';
import { useTranslation } from 'react-i18next';

const Profile = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-ds-text-primary mb-2">{t('profile.pageTitle')}</h2>
        <p className="text-ds-gray-600">{t('profile.pageSubtitle')}</p>
      </div>

      {/* Resume Section - Priority for auto-apply */}
      <ResumeSection />
    </div>
  );
};

export default Profile;
