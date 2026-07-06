import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Trash2, Ban } from 'lucide-react';
import { blockedOrgsAPI } from '../api/blockedOrgs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';

const BlockedOrganizations = () => {
  const [blockedOrgs, setBlockedOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCompany, setNewCompany] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    loadBlockedOrgs();
  }, []);

  const loadBlockedOrgs = async () => {
    try {
      setLoading(true);
      const data = await blockedOrgsAPI.getAll();
      setBlockedOrgs(data);
    } catch (error) {
      console.error('Error loading blocked orgs:', error);
      toast.error(t('blockedOrgs.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!newCompany.trim()) return;
    try {
      const result = await blockedOrgsAPI.block(newCompany.trim());
      if (result.alreadyBlocked) {
        toast.info(t('blockedOrgs.alreadyBlocked'));
      } else {
        toast.success(t('blockedOrgs.blocked', { company: newCompany }));
      }
      setNewCompany('');
      await loadBlockedOrgs();
    } catch (error) {
      toast.error(t('blockedOrgs.blockError'));
    }
  };

  const handleUnblock = async (org) => {
    try {
      await blockedOrgsAPI.unblock(org.id);
      toast.success(t('blockedOrgs.unblocked', { company: org.company_name }));
      setBlockedOrgs(prev => prev.filter(o => o.id !== org.id));
    } catch (error) {
      toast.error(t('blockedOrgs.unblockError'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {t('blockedOrgs.title')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {t('blockedOrgs.subtitle')}
        </p>
      </div>

      {/* Add new blocked company */}
      <div className="flex gap-3">
        <Input
          value={newCompany}
          onChange={(e) => setNewCompany(e.target.value)}
          placeholder={t('blockedOrgs.addPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
          className="max-w-md"
        />
        <Button onClick={handleBlock} disabled={!newCompany.trim()} variant="destructive">
          <Ban className="w-4 h-4 mr-2" />
          {t('blockedOrgs.addButton')}
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : blockedOrgs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <Ban className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">{t('blockedOrgs.empty')}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-950 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {blockedOrgs.map((org) => (
              <div key={org.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{org.company_name}</span>
                  {org.reason && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{org.reason}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {t('blockedOrgs.blockedOn')} {new Date(org.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUnblock(org)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Badge variant="outline" className="text-gray-500">
        {blockedOrgs.length} {t('blockedOrgs.companiesBlocked')}
      </Badge>
    </div>
  );
};

export default BlockedOrganizations;
