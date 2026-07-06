import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useConfirm, ConfirmDialog } from '../components/ui/confirm-dialog';
import SearchFilters from '../components/SearchFilters';
import VacancyCard from '../components/VacancyCard';
import { searchAPI } from '../api/search';
import { vacaturesAPI } from '../api/vacatures';
import { autoApplyAPI } from '../api/autoApply';
import BulkActionPanel from '../components/BulkActionPanel';
import { Button } from '../components/ui/button';

import { motivationAPI } from '../api/motivation';
import { profileAPI } from '../api/profile';
import { blockedOrgsAPI } from '../api/blockedOrgs';
import { haversineDistance } from '../utils/distanceUtils';
import { cityToCoords, postcodePrefixToCoords } from '../data/belgianCoords';
import { useAuth } from '../context/AuthContext';

const ITEMS_PER_PAGE = 40;

// Resolve coordinates for a vacancy (same logic as DemandMap)
const resolveCoords = (postcode, cityName, locationText) => {
  if (postcode && postcode.length >= 2) {
    const prefix = postcode.substring(0, 2);
    const prefixMatch = postcodePrefixToCoords[prefix];
    if (prefixMatch) return { lat: prefixMatch.lat, lng: prefixMatch.lng };
  }
  const names = [cityName, locationText].filter(Boolean);
  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (cityToCoords[key]) return { lat: cityToCoords[key].lat, lng: cityToCoords[key].lng };
    const firstWord = key.split(/[\s,(]/)[0];
    if (firstWord && cityToCoords[firstWord]) return { lat: cityToCoords[firstWord].lat, lng: cityToCoords[firstWord].lng };
  }
  return null;
};

const Vacatures = () => {
  const [vacatures, setVacatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [generating, setGenerating] = useState(new Set());
  const [profile, setProfile] = useState(null);
  const { t } = useTranslation();
  const { autoApplyAccess } = useAuth();
  const { openConfirm, dialogProps } = useConfirm();

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

  // Auto Apply State
  const [selectedVacancyIds, setSelectedVacancyIds] = useState([]);
  const [autoApplyStatuses, setAutoApplyStatuses] = useState({}); // { vacancyId: 'pending' | 'applied' ... }

  // Display Filter State (from SearchFilters checkboxes)
  const [displayFilters, setDisplayFilters] = useState({ autoApplyOnly: false });

  // Distance-aware filtering: apply radius, category, employment type filters
  const filteredVacatures = useMemo(() => {
    const origin = displayFilters.userOrigin;
    const radius = displayFilters.radiusKm;
    const cats = displayFilters.selectedCategories || [];
    const excludedCats = displayFilters.excludedCategories || [];
    const empTypes = displayFilters.selectedEmploymentTypes || [];

    let results = vacatures;

    // Category include filter: show vacancies matching ANY selected category
    if (cats.length > 0) {
      results = results.filter(vac => {
        if (!vac.categories || !Array.isArray(vac.categories)) return false;
        return cats.some(cat => vac.categories.includes(cat));
      });
    }

    // Category exclude filter: hide vacancies matching ANY excluded category
    if (excludedCats.length > 0) {
      results = results.filter(vac => {
        if (!vac.categories || !Array.isArray(vac.categories)) return true;
        return !excludedCats.some(cat => vac.categories.includes(cat));
      });
    }

    // Employment type filter: show vacancies matching ANY selected employment type
    if (empTypes.length > 0) {
      results = results.filter(vac => {
        if (!vac.employment_type) return false;
        return empTypes.includes(vac.employment_type);
      });
    }

    if (!origin) return results.map(v => ({ ...v, _distanceKm: null }));

    return results
      .map(vac => {
        const coords = resolveCoords(vac.postcode, vac.city_name, vac.location);
        if (!coords) return { ...vac, _distanceKm: null };
        const dist = haversineDistance(origin.lat, origin.lng, coords.lat, coords.lng);
        return { ...vac, _distanceKm: dist };
      })
      .filter(vac => {
        if (!radius) return true;
        if (vac._distanceKm == null) return false;
        return vac._distanceKm <= radius;
      })
      .sort((a, b) => {
        if (a._distanceKm == null && b._distanceKm == null) return 0;
        if (a._distanceKm == null) return 1;
        if (b._distanceKm == null) return -1;
        return a._distanceKm - b._distanceKm;
      });
  }, [vacatures, displayFilters.userOrigin, displayFilters.radiusKm, displayFilters.selectedCategories, displayFilters.excludedCategories, displayFilters.selectedEmploymentTypes]);

  // Computed pagination values
  const totalPages = useMemo(() => Math.ceil(filteredVacatures.length / ITEMS_PER_PAGE), [filteredVacatures.length]);

  const paginatedVacatures = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredVacatures.slice(startIndex, endIndex);
  }, [filteredVacatures, currentPage]);

  // Check if all items on current page are selected (must be before any early returns)
  const allPageSelected = useMemo(() => {
    if (paginatedVacatures.length === 0) return false;
    return paginatedVacatures.every(v => selectedVacancyIds.includes(v.id));
  }, [paginatedVacatures, selectedVacancyIds]);

  const handleFilterChange = (filters) => {
    setDisplayFilters(prev => ({ ...prev, ...filters }));
  };

  // Reload from server whenever autoApplyOnly filter changes
  useEffect(() => {
    setCurrentPage(1);
    loadVacatures({ autoApplyOnly: displayFilters.autoApplyOnly });
  }, [displayFilters.autoApplyOnly]);

  useEffect(() => {
    loadProfile();
    loadAutoApplyStatuses();
  }, []);

  const loadAutoApplyStatuses = async () => {
    try {
      const statuses = await autoApplyAPI.getStatuses();
      setAutoApplyStatuses(statuses);
    } catch (error) {
      console.error('Failed to load auto apply statuses', error);
    }
  };

  const loadProfile = async () => {
    try {
      const data = await profileAPI.get();
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadVacatures = async (options = {}) => {
    try {
      setLoading(true);
      const data = await vacaturesAPI.getAll(undefined, options);
      setVacatures(data);
    } catch (error) {
      console.error('Error loading vacatures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (filters) => {
    try {
      setLoading(true);

      // Validate keywords
      if (!filters.keywords || !filters.keywords.trim()) {
        toast.warning(t('pages.vacatures.keywordsRequired'));
        setLoading(false);
        return;
      }

      // Search and save jobs
      const response = await searchAPI.searchAndSave(filters);

      if (response && response.success) {
        // Reload vacatures from database
        await loadVacatures();

        // Trigger map tab pulse in sidebar
        sessionStorage.setItem('highlightMapTab', 'true');

        // Show success message
        if (response.count > 0) {
          toast.success(t('pages.vacatures.foundAndSaved', { count: response.count }));
        } else {
          const message = response.message || t('pages.vacatures.noVacanciesFound');
          toast.info(message);
        }
      } else {
        toast.error(t('pages.vacatures.searchFailed'));
      }
    } catch (error) {
      console.error('Error searching:', error);
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Onbekende fout. Controleer of de backend server draait.';
      toast.error(`Fout bij het zoeken: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await vacaturesAPI.updateStatus(id, status);
      setVacatures(prev =>
        prev.map(vac => vac.id === id ? { ...vac, status } : vac)
      );
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(t('errors.statusUpdateFailed'));
    }
  };

  const handleBlockCompany = (companyName) => {
    if (!companyName) return;

    openConfirm({
      title: t('blockedOrgs.confirmBlock', { company: companyName }),
      confirmLabel: 'Block',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await blockedOrgsAPI.block(companyName);
          toast.success(t('blockedOrgs.blocked', { company: companyName }));
          setVacatures(prev =>
            prev.filter(v =>
              (v.company || '').toLowerCase().trim() !== companyName.toLowerCase().trim()
            )
          );
        } catch (error) {
          console.error('Error blocking company:', error);
          toast.error(t('blockedOrgs.blockError'));
        }
      }
    });
  };

  const handleGenerateMotivation = async (vacatureId) => {
    if (!profile) {
      toast.warning(t('pages.vacatures.completeProfileFirst'));
      return;
    }

    if (!profile.skills && !profile.personality && !profile.name) {
      toast.warning(t('pages.vacatures.completeProfileMinimum'));
      return;
    }

    setGenerating(prev => new Set(prev).add(vacatureId));

    try {
      console.log('Generating motivation for vacature:', vacatureId);
      console.log('Profile:', profile);

      // Get the vacature to ensure it exists
      const vacature = vacatures.find(v => v.id === vacatureId);
      if (!vacature) {
        toast.error(t('errors.vacancyNotFound'));
        setGenerating(prev => {
          const newSet = new Set(prev);
          newSet.delete(vacatureId);
          return newSet;
        });
        return;
      }

      // Prepare profile with defaults
      const profileData = {
        name: profile.name || 'Kandidaat',
        skills: profile.skills || 'Niet gespecificeerd',
        personality: profile.personality || 'Niet gespecificeerd',
        availability: profile.availability || 'Flexibel beschikbaar'
      };

      console.log('Sending request with profile:', profileData);

      const response = await motivationAPI.generate([vacatureId], profileData);
      console.log('Motivation API response:', response);

      if (response && response.success) {
        if (response.results && response.results.length > 0) {
          const result = response.results[0];
          console.log('Generated motivation result:', result);

          // Update the vacature in state
          setVacatures(prev =>
            prev.map(vac =>
              vac.id === vacatureId || vac.id === result.id
                ? { ...vac, motivation: result.letter }
                : vac
            )
          );

          await loadVacatures();

          toast.success(t('pages.vacatures.motivationGenerated'));
        } else {
          console.error('No results in response:', response);
          toast.error(t('errors.motivationNoResults'));
        }
      } else {
        console.error('API returned success:false:', response);
        const errorMsg = response?.error || response?.message || t('common.unknown');
        toast.error(`${t('errors.motivationGenerationFailed')}: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error generating motivation:', error);
      console.error('Error details:', error.response?.data);
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        t('errors.motivationServerError');
      toast.error(`${t('errors.motivationGenerationFailed')}: ${errorMessage}`);
    } finally {
      setGenerating(prev => {
        const newSet = new Set(prev);
        newSet.delete(vacatureId);
        return newSet;
      });
    }
  };

  if (loading && vacatures.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Pagination Handlers
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      console.log(`[PAGINATION] Page change: ${currentPage} → ${newPage}`);
      setCurrentPage(newPage);
      // Scroll to top of vacancy grid
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  };

  // Selection Handlers
  const handleToggleSelect = (vacancyId) => {
    setSelectedVacancyIds(prev => {
      const isCurrentlySelected = prev.includes(vacancyId);
      const newSelection = isCurrentlySelected
        ? prev.filter(id => id !== vacancyId)
        : [...prev, vacancyId];

      console.log(`[SELECTION] ${isCurrentlySelected ? 'Deselected' : 'Selected'} vacancy ${vacancyId}, total: ${newSelection.length}`);
      return newSelection;
    });
  };

  const handleClearSelection = () => {
    console.log('[SELECTION] Cleared all selections');
    setSelectedVacancyIds([]);
  };

  const handleAddToAutoApply = async () => {
    if (selectedVacancyIds.length === 0) {
      console.log('[QUEUE] No vacancies selected, skipping');
      return;
    }

    const count = selectedVacancyIds.length;
    console.log(`[QUEUE] 📋 Adding ${count} vacancies to queue:`, selectedVacancyIds);

    // Optimistic UI update
    const newStatuses = { ...autoApplyStatuses };
    selectedVacancyIds.forEach(id => {
      newStatuses[id] = 'pending';
    });
    setAutoApplyStatuses(newStatuses);
    console.log('[QUEUE] Optimistic status update applied');

    try {
      console.log('[QUEUE] 📤 Calling autoApplyAPI.addToQueue...');
      const result = await autoApplyAPI.addToQueue(selectedVacancyIds);
      console.log('[QUEUE] ✅ API Response:', JSON.stringify(result, null, 2));

      const enqueuedCount = result?.enqueued || count;
      const failedCount = result?.failed || 0;

      if (failedCount > 0) {
        console.warn('[QUEUE] ⚠️ Some failed:', result?.results?.failed);
        toast.warning(`${enqueuedCount} toegevoegd, ${failedCount} mislukt`);
      } else {
        toast.success(`${enqueuedCount} vacature${enqueuedCount !== 1 ? 's' : ''} toegevoegd aan Auto Apply wachtrij`);
      }

      handleClearSelection();

      // Refresh statuses with await for confirmation
      console.log('[QUEUE] 🔄 Refreshing auto-apply statuses...');
      await loadAutoApplyStatuses();
      console.log('[QUEUE] ✅ Statuses refreshed');

    } catch (error) {
      console.error('[QUEUE] ❌ Failed to add to queue:', error);
      console.error('[QUEUE] Error response:', error.response?.data);
      const errorMsg = error.response?.data?.details || error.response?.data?.error || error.message || 'Unknown error';
      toast.error(`Fout: ${errorMsg}`);
      // Revert optimistic update
      await loadAutoApplyStatuses();
    }
  };

  const handleSelectAll = () => {
    // Select all currently visible (paginated) vacancies
    const pageIds = paginatedVacatures.map(v => v.id);
    const allCurrentPageSelected = pageIds.every(id => selectedVacancyIds.includes(id));

    if (allCurrentPageSelected && pageIds.length > 0) {
      // Deselect all on current page
      const newSelection = selectedVacancyIds.filter(id => !pageIds.includes(id));
      console.log(`[SELECTION] Deselected all on page ${currentPage}, remaining: ${newSelection.length}`);
      setSelectedVacancyIds(newSelection);
    } else {
      // Select all on current page (preserve selections from other pages)
      const newSelection = [...new Set([...selectedVacancyIds, ...pageIds])];
      console.log(`[SELECTION] Selected all on page ${currentPage}, total: ${newSelection.length}`);
      setSelectedVacancyIds(newSelection);
    }
  };

  const handleRefreshMatching = async () => {
    if (matching) return;
    setMatching(true);
    toast(t('pages.vacatures.matchingStarted'), { duration: 3000 });
    try {
      const result = await vacaturesAPI.matchAll({ force: true });

      // Apply scores directly from the response — don't rely on re-fetch
      if (result.results && result.results.length > 0) {
        const scoreMap = {};
        for (const r of result.results) {
          if (r.success && r.score != null) {
            scoreMap[r.id] = { match_score: r.score, match_details: r.reason ?? null };
          }
        }
        setVacatures(prev => prev.map(vac =>
          scoreMap[vac.id] != null
            ? { ...vac, ...scoreMap[vac.id] }
            : vac
        ));
      }

      const updated = result.results?.filter(r => r.success).length ?? result.count ?? 0;
      toast.success(`AI scores updated for ${updated} vacancies`, { duration: 3000 });
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Unknown error';
      toast.error(`Matching failed: ${msg}`);
    } finally {
      setMatching(false);
    }
  };

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 relative min-h-screen">
      <ConfirmDialog {...dialogProps} />
      {/* Hero Section */}
      <div className="mb-8 mt-8">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
          {t('vacancies.title')}
        </h1>
        <p className="mt-2 text-lg text-gray-500">
          {t('pages.vacatures.findPerfectMatch')}
        </p>
        {/* Select All Toggle for current page */}
        <button
          onClick={handleSelectAll}
          className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          {allPageSelected ? t('pages.vacatures.deselectPage') : t('pages.vacatures.selectPage')}
          {selectedVacancyIds.length > 0 && (
            <span className="ml-2 text-slate-500">
              ({selectedVacancyIds.length} total selected)
            </span>
          )}
        </button>
      </div>

      {/* Search Section - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10 w-full"
      >
        <SearchFilters onSearch={handleSearch} onFilterChange={handleFilterChange} />
      </motion.div>

      {/* AI Matching Refresh */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={handleRefreshMatching}
          disabled={matching}
          title={t('pages.vacatures.refreshAiScores')}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${matching ? 'animate-spin' : ''}`} />
          {t('pages.vacatures.refreshAiScores')}
        </button>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
        </div>
      )}

      {vacatures.length === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-gray-50 rounded-3xl border border-gray-100"
        >
          <div className="inline-block p-6 bg-white rounded-full mb-6 shadow-sm">
            <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('vacancies.noResults')}</h3>
          <p className="text-gray-500 max-w-md mx-auto">{t('vacancies.noResultsText')}</p>
        </motion.div>
      )}

      {/* Bulk Action Panel - only for admin/owner */}
      {autoApplyAccess?.hasAccess && (
        <BulkActionPanel
          selectedCount={selectedVacancyIds.length}
          onAddToAutoApply={handleAddToAutoApply}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Pagination Info */}
      {vacatures.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {t('pages.vacatures.showingResults', {
              start: ((currentPage - 1) * ITEMS_PER_PAGE) + 1,
              end: Math.min(currentPage * ITEMS_PER_PAGE, filteredVacatures.length),
              total: filteredVacatures.length
            })}
            {displayFilters.radiusKm && displayFilters.userOrigin && (
              <span className="ml-1 text-blue-500 font-medium">
                {t('pages.vacatures.withinRadius', { radius: displayFilters.radiusKm, location: displayFilters.userOrigin.label })}
              </span>
            )}
          </p>
          {totalPages > 1 && (
            <p className="text-sm text-slate-500">
              {t('pages.vacatures.pageInfo', { current: currentPage, total: totalPages })}
            </p>
          )}
        </div>
      )}

      {/* Vacancies Grid - Responsive: 1 col mobile, 2 cols tablet, 3 cols desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
        {paginatedVacatures.map((vacature, index) => (
          <motion.div
            key={vacature.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.2 }}
            className="h-full"
          >
            <VacancyCard
              vacature={vacature}
              onStatusChange={handleStatusChange}
              onGenerateMotivation={handleGenerateMotivation}
              isGenerating={generating.has(vacature.id)}
              profile={profile}
              // Props for Auto Apply
              isSelected={selectedVacancyIds.includes(vacature.id)}
              onToggleSelect={handleToggleSelect}
              autoApplyStatus={autoApplyStatuses[vacature.id]}
              onBlockCompany={handleBlockCompany}
              distanceKm={vacature._distanceKm}
            />
          </motion.div>
        ))}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-8 pb-24">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {/* First page */}
            {currentPage > 3 && (
              <>
                <Button
                  variant={currentPage === 1 ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  className="w-9 h-9 p-0"
                >
                  1
                </Button>
                {currentPage > 4 && <span className="px-2 text-slate-400">...</span>}
              </>
            )}

            {/* Pages around current */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page => page >= currentPage - 2 && page <= currentPage + 2)
              .map(page => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                  className="w-9 h-9 p-0"
                >
                  {page}
                </Button>
              ))}

            {/* Last page */}
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="px-2 text-slate-400">...</span>}
                <Button
                  variant={currentPage === totalPages ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  className="w-9 h-9 p-0"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default Vacatures;
