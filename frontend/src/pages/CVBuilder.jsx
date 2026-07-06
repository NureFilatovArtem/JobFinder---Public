import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { resumeAPI } from '@/api/resume';
import { profileAPI } from '@/api/profile';
import { useAuth } from '@/context/AuthContext';
import {
  DEFAULT_SECTIONS,
  DEFAULT_STYLE,
  resumeDataToSections,
  sectionsToResumeData,
} from '@/lib/cvDefaults';

import { Layers, Eye, Settings2 as SettingsIcon } from 'lucide-react';
import CVTopBar from '@/components/cv-builder/CVTopBar';
import AutoMode from '@/components/cv-builder/AutoMode';
import SectionsSidebar from '@/components/cv-builder/SectionsSidebar';
import CVCanvas from '@/components/cv-builder/CVCanvas';
import PropertiesPanel from '@/components/cv-builder/PropertiesPanel';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const CVBuilder = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [mode, setMode] = useState('auto');
  const [sections, setSections] = useState(JSON.parse(JSON.stringify(DEFAULT_SECTIONS)));
  const [style, setStyle] = useState(() => {
    try {
      const saved = localStorage.getItem('cv_builder_style');
      return saved ? { ...DEFAULT_STYLE, ...JSON.parse(saved) } : { ...DEFAULT_STYLE };
    } catch { return { ...DEFAULT_STYLE }; }
  });
  const [languages, setLanguages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [mobilePanel, setMobilePanel] = useState('canvas');
  const autoSaveTimerRef = useRef(null);

  // ── Unified selection state ───────────────────────────────────
  // selection: { sectionId, objKey, fieldHint, ts } | null
  //   objKey = null  → section-level (sidebar click, shows full section editor)
  //   objKey = 'photo' | 'name' | 'contact' | 'summary' | 'item_0' | 'cat_0' | ...
  const [selection, setSelection] = useState(null);

  // Sidebar section click → section-level editor
  const handleSelect = useCallback((sectionId) => {
    setSelection(sectionId ? { sectionId, objKey: null, fieldHint: null, ts: Date.now() } : null);
  }, []);

  // Canvas object click → focused object editor
  const handleObjectSelect = useCallback((sectionId, objKey, fieldHint = null) => {
    setSelection({ sectionId, objKey, fieldHint, ts: Date.now() });
  }, []);

  const handleDeselect = useCallback(() => {
    setSelection(prev => {
      if (!prev) return null;
      if (prev.objKey !== null && prev.objKey !== undefined) {
        // Step back: object → section level
        return { sectionId: prev.sectionId, objKey: null, fieldHint: null, ts: Date.now() };
      }
      // Step back: section → style
      return null;
    });
  }, []);

  // ── Undo / Redo ──────────────────────────────────────────────
  const historyRef = useRef({ past: [], future: [] });
  const [historyAvail, setHistoryAvail] = useState({ canUndo: false, canRedo: false });

  const withHistory = useCallback((updater) => {
    setSections(current => {
      const h = historyRef.current;
      h.past.push(JSON.parse(JSON.stringify(current)));
      if (h.past.length > 40) h.past.shift();
      h.future = [];
      setHistoryAvail({ canUndo: true, canRedo: false });
      return typeof updater === 'function' ? updater(current) : updater;
    });
  }, []);

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.past.length) return;
    setSections(current => {
      const previous = h.past.pop();
      h.future.push(JSON.parse(JSON.stringify(current)));
      setHistoryAvail({ canUndo: h.past.length > 0, canRedo: true });
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h.future.length) return;
    setSections(current => {
      const next = h.future.pop();
      h.past.push(JSON.parse(JSON.stringify(current)));
      setHistoryAvail({ canUndo: true, canRedo: h.future.length > 0 });
      return next;
    });
  }, []);

  useEffect(() => {
    if (mode !== 'editor') return;
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, undo, redo]);

  // ── Data loading ─────────────────────────────────────────────
  useEffect(() => { loadResumeData(); }, []);

  useEffect(() => {
    try { localStorage.setItem('cv_builder_style', JSON.stringify(style)); } catch {}
  }, [style]);

  useEffect(() => {
    if (mode !== 'editor' || loading) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const resumeData = sectionsToResumeData(sections, languages);
      resumeAPI.update(resumeData).catch(() => {});
    }, 3000);
    return () => clearTimeout(autoSaveTimerRef.current);
  }, [sections, languages, mode, loading]);

  const loadResumeData = async () => {
    try {
      setLoading(true);
      const [resumeResult, profileResult] = await Promise.allSettled([resumeAPI.get(), profileAPI.get()]);
      const resume = resumeResult.status === 'fulfilled' ? resumeResult.value?.resume : null;
      const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
      if (profile) setProfileData(profile);
      if (resume) {
        setSections(resumeDataToSections(resume, profile));
        if (resume.languages?.length) setLanguages(resume.languages);
        if (resume.show_photo !== undefined) setStyle(prev => ({ ...prev, showPhoto: !!resume.show_photo }));
        setMode('editor');
      } else if (profile) {
        const def = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));
        def[0].data.fullName = profile.name || '';
        setSections(def);
      }
    } catch (err) {
      console.error('Error loading resume data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromProfile = async () => {
    try {
      const [rd, pd] = await Promise.allSettled([resumeAPI.get(), profileAPI.get()]);
      const resume = rd.status === 'fulfilled' ? rd.value?.resume : null;
      const profile = pd.status === 'fulfilled' ? pd.value : null;
      if (resume || profile) {
        setSections(resumeDataToSections(resume, profile));
        if (resume?.languages?.length) setLanguages(resume.languages);
        toast.success('Profile data imported!');
      } else {
        toast.error('No profile or resume data found.');
      }
    } catch { toast.error('Failed to import profile data'); }
  };

  const handleAutoGenerate = useCallback(({ sections: s, languages: l = [], style: ns }) => {
    setSections(s);
    setLanguages(l);
    if (ns) setStyle(prev => ({ ...prev, ...ns }));
    setMode('editor');
    toast.success('CV generated! You can now edit it.');
  }, []);

  // Text edits — no history (per-keystroke; browser undo handles within inputs)
  const handleEdit = useCallback((typeOrId, data) => {
    setSections(prev => prev.map(s => {
      if (s.type === 'text' && s.id === typeOrId) return { ...s, data };
      if (s.type !== 'text' && s.type === typeOrId) return { ...s, data };
      return s;
    }));
  }, []);

  // Structural ops — all push to undo history
  const handleReorder = useCallback((newSections) => {
    withHistory(() => newSections);
  }, [withHistory]);

  const handleToggleVisibility = useCallback((id) => {
    withHistory(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  }, [withHistory]);

  const handleAddSection = useCallback((type, defaultData) => {
    const newSection = { id: `${type}_${Date.now()}`, type, visible: true, data: { ...defaultData } };
    withHistory(prev => [...prev, newSection]);
    setSelection({ sectionId: newSection.id, objKey: null, fieldHint: null, ts: Date.now() });
  }, [withHistory]);

  const handleRemoveSection = useCallback((id) => {
    withHistory(prev => prev.filter(s => s.id !== id));
    setSelection(prev => prev?.sectionId === id ? null : prev);
  }, [withHistory]);

  const handleSave = async () => {
    try {
      setSaving(true);
      clearTimeout(autoSaveTimerRef.current);
      await resumeAPI.update(sectionsToResumeData(sections, languages));
      toast.success('CV saved!');
    } catch { toast.error('Failed to save CV.'); }
    finally { setSaving(false); }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const canvasEl = document.querySelector('.cv-canvas');
      if (!canvasEl) throw new Error('CV canvas not found.');
      const clone = canvasEl.cloneNode(true);
      clone.querySelectorAll('[style]').forEach(el => { el.style.outline = 'none'; el.style.cursor = 'default'; });
      clone.querySelectorAll('.cv-obj, .cv-obj-selected').forEach(el => {
        el.classList.remove('cv-obj', 'cv-obj-selected');
      });
      const fontLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .filter(l => l.href.includes('fonts.googleapis.com')).map(l => l.href);
      const headerData = sections.find(s => s.type === 'header')?.data;
      const fileName = headerData?.fullName
        ? `cv-${headerData.fullName.replace(/\s+/g, '-').toLowerCase()}` : 'cv';
      const response = await fetch(`${API_URL}/api/resume/export-html-pdf`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ html: clone.outerHTML, fontLinks, fileName }),
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.error || 'Export failed'); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${fileName}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch (err) {
      toast.error(err.message || 'Failed to export CV.');
    } finally { setExporting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading CV Builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -m-4 lg:-m-8">
      <CVTopBar
        mode={mode} onModeChange={setMode}
        onSave={handleSave} onExport={handleExport}
        onImportFromProfile={handleImportFromProfile}
        saving={saving} exporting={exporting}
        canUndo={historyAvail.canUndo} canRedo={historyAvail.canRedo}
        onUndo={undo} onRedo={redo}
      />

      {mode === 'auto' ? (
        <AutoMode onGenerate={handleAutoGenerate} initialData={profileData} />
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Desktop: 3-panel side-by-side */}
          <div className="hidden md:flex flex-1 min-h-0">
            <SectionsSidebar
              sections={sections}
              selection={selection}
              onSelect={handleSelect}
              onReorder={handleReorder}
              onToggleVisibility={handleToggleVisibility}
              onAddSection={handleAddSection}
              onRemoveSection={handleRemoveSection}
              onEdit={handleEdit}
              style={style}
              onStyleChange={setStyle}
            />
            <CVCanvas
              sections={sections}
              selection={selection}
              onSelectObj={handleObjectSelect}
              onEdit={handleEdit}
              style={style}
              languages={languages}
            />
            <PropertiesPanel
              style={style}
              onStyleChange={setStyle}
            />
          </div>

          {/* Mobile: one panel at a time */}
          <div className="flex flex-col flex-1 min-h-0 md:hidden">
            {mobilePanel === 'sections' && (
              <SectionsSidebar
                sections={sections}
                selection={selection}
                onSelect={(id) => { handleSelect(id); setMobilePanel('sections'); }}
                onReorder={handleReorder}
                onToggleVisibility={handleToggleVisibility}
                onAddSection={(type, data) => { handleAddSection(type, data); }}
                onRemoveSection={handleRemoveSection}
                onEdit={handleEdit}
                style={style}
                onStyleChange={setStyle}
              />
            )}
            {mobilePanel === 'canvas' && (
              <CVCanvas
                sections={sections}
                selection={selection}
                onSelectObj={(id, key, hint) => { handleObjectSelect(id, key, hint); if (id) setMobilePanel('sections'); }}
                onEdit={handleEdit}
                style={style}
                languages={languages}
              />
            )}
            {mobilePanel === 'properties' && (
              <PropertiesPanel
                style={style}
                onStyleChange={setStyle}
              />
            )}
          </div>

          {/* Mobile bottom tab bar */}
          <div className="md:hidden shrink-0 h-14 border-t border-border bg-card flex items-stretch">
            {[
              { key: 'sections', Icon: Layers,      label: 'Sections' },
              { key: 'canvas',   Icon: Eye,          label: 'Preview'  },
              { key: 'properties', Icon: SettingsIcon, label: 'Edit'   },
            ].map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => setMobilePanel(key)}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${mobilePanel === key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px]">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CVBuilder;
