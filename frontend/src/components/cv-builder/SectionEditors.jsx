import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Trash2, Image, Upload, Loader2, Sparkles,
} from "lucide-react";
import { sectionsToResumeData } from "@/lib/cvDefaults";
import { resumeAPI } from "@/api/resume";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ─── Auto-focus helper ─────────────────────────────────────────
export function useAutoFocus(fieldKey, ts, refs) {
  useEffect(() => {
    if (!fieldKey) return;
    const el = refs.current[fieldKey];
    if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  }, [ts]);
}

// ─── Shared field row ──────────────────────────────────────────
export function Field({ label, children }) {
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
export function FieldGrid({ children }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>;
}

// Normalize + pack skills
export function resolveSkillObj(s) {
  if (typeof s === 'string') return { name: s, desc: '' };
  return { name: s?.name || '', desc: s?.desc || '' };
}
export function packSkill(s) {
  return s.desc?.trim() ? { name: s.name, desc: s.desc } : s.name;
}

// ── Header: all fields in one combined editor ──────────────────
export function HeaderEditor({ data, onEdit, style, onStyleChange }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const update = (field, value) => onEdit('header', { ...data, [field]: value });
  const styleUpd = (key, val) => onStyleChange({ ...style, [key]: val });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const result = await resumeAPI.uploadPhoto(file);
      const fullUrl = result.photo_url?.startsWith('http') ? result.photo_url : `${API_URL}${result.photo_url}`;
      update('photoUrl', fullUrl);
      toast.success('Photo uploaded!');
    } catch { toast.error('Photo upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div className="space-y-3">
      {/* Photo */}
      <div className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-lg border border-border/50">
        {data.photoUrl ? (
          <img src={data.photoUrl} alt="" className="w-12 h-12 rounded object-cover border border-border shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded bg-muted border-2 border-dashed border-border flex items-center justify-center shrink-0">
            <Image className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
        <div className="flex flex-col gap-1.5 flex-1">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
            {uploading ? 'Uploading…' : data.photoUrl ? 'Change' : 'Upload Photo'}
          </Button>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Show photo</span>
            <button
              onClick={() => styleUpd('showPhoto', !style.showPhoto)}
              className={`relative w-7 h-3.5 rounded-full transition-colors ${style.showPhoto ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
            >
              <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-all ${style.showPhoto ? 'left-[14px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>

      <Field label="Full Name">
        <Input value={data.fullName || ''} onChange={e => update('fullName', e.target.value)} className="h-8 text-xs" />
      </Field>
      <Field label="Job Title">
        <Input value={data.title || ''} onChange={e => update('title', e.target.value)} className="h-8 text-xs" placeholder="e.g. Senior Software Engineer" />
      </Field>

      <Separator />

      <div className="space-y-3">
        {[['email','Email'],['phone','Phone'],['location','Location'],['linkedin','LinkedIn'],['website','Website']].map(([k,l]) => (
          <Field key={k} label={l}>
            <Input value={data[k] || ''} onChange={e => update(k, e.target.value)} className="h-8 text-xs" />
          </Field>
        ))}
      </div>

      <Separator />

      <Field label="Professional Summary">
        <Textarea value={data.summary || ''} onChange={e => update('summary', e.target.value)} className="text-xs min-h-[100px] resize-none" placeholder="A concise summary of your background…" />
      </Field>
    </div>
  );
}

// ── Experience editor — shows all items with accordion ─────────
export function ExperienceEditor({ data, onEdit, autoExpandIdx }) {
  const [expandedIdx, setExpandedIdx] = useState(autoExpandIdx ?? 0);

  useEffect(() => {
    if (autoExpandIdx != null) setExpandedIdx(autoExpandIdx);
  }, [autoExpandIdx]);

  const addJob = () => {
    const newItem = { id: `exp${Date.now()}`, company: 'Company', role: 'Role', location: '', startDate: '', endDate: 'Present', bullets: [''] };
    const newItems = [...(data.items || []), newItem];
    onEdit('experience', { ...data, items: newItems });
    setExpandedIdx(newItems.length - 1);
  };

  const removeJob = (idx) => {
    onEdit('experience', { ...data, items: data.items.filter((_, i) => i !== idx) });
    setExpandedIdx(prev => prev >= idx ? Math.max(0, prev - 1) : prev);
  };

  const updateField = (idx, field, value) => {
    const items = [...data.items];
    items[idx] = { ...items[idx], [field]: value };
    onEdit('experience', { ...data, items });
  };

  const updateBullets = (idx, newBullets) => {
    const items = [...data.items];
    items[idx] = { ...items[idx], bullets: newBullets };
    onEdit('experience', { ...data, items });
  };

  const addBullet = (itemIdx, afterBulletIdx) => {
    const bullets = [...(data.items[itemIdx].bullets || [])];
    bullets.splice(afterBulletIdx + 1, 0, '');
    updateBullets(itemIdx, bullets);
  };

  return (
    <div className="space-y-2">
      {(data.items || []).map((item, idx) => (
        <div key={item.id || idx} className="rounded-lg border border-border/60 overflow-hidden">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
            onClick={() => setExpandedIdx(expandedIdx === idx ? -1 : idx)}
          >
            <span className="text-[10px] text-muted-foreground/50 transition-transform duration-150" style={{ transform: expandedIdx === idx ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate">{item.role || 'New Job'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{item.company}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); removeJob(idx); }} className="p-1 rounded hover:bg-destructive/10 shrink-0">
              <Trash2 className="h-3 w-3 text-destructive/60" />
            </button>
          </button>

          {expandedIdx === idx && (
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/40 bg-background/50">
              <Field label="Role / Job Title">
                <Input value={item.role || ''} onChange={e => updateField(idx, 'role', e.target.value)} className="h-7 text-[11px]" />
              </Field>
              <Field label="Company">
                <Input value={item.company || ''} onChange={e => updateField(idx, 'company', e.target.value)} className="h-7 text-[11px]" />
              </Field>
              <FieldGrid>
                <Field label="Start"><Input value={item.startDate || ''} onChange={e => updateField(idx, 'startDate', e.target.value)} className="h-7 text-[10px]" placeholder="2022" /></Field>
                <Field label="End"><Input value={item.endDate || ''} onChange={e => updateField(idx, 'endDate', e.target.value)} className="h-7 text-[10px]" placeholder="Present" /></Field>
              </FieldGrid>
              <Field label="Location (optional)">
                <Input value={item.location || ''} onChange={e => updateField(idx, 'location', e.target.value)} className="h-7 text-[11px]" />
              </Field>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-[11px] text-muted-foreground">Achievements</Label>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => addBullet(idx, (item.bullets?.length ?? 0) - 1)}>
                    <Plus className="h-3 w-3 mr-0.5" /> Add
                  </Button>
                </div>
                {(item.bullets || []).map((b, bi) => (
                  <div key={bi} className="flex gap-1 mb-1">
                    <Input
                      value={b}
                      onChange={e => {
                        const nb = [...(item.bullets || [])];
                        nb[bi] = e.target.value;
                        updateBullets(idx, nb);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); addBullet(idx, bi); }
                        if (e.key === 'Backspace' && b === '' && (item.bullets?.length ?? 0) > 1) { e.preventDefault(); updateBullets(idx, item.bullets.filter((_,i) => i !== bi)); }
                      }}
                      className="h-7 text-[10px] flex-1"
                      placeholder="Achievement…"
                    />
                    <Button variant="ghost" size="sm" className="h-7 w-6 p-0" onClick={() => updateBullets(idx, item.bullets.filter((_,i) => i !== bi))}>
                      <Trash2 className="h-3 w-3 text-muted-foreground/60" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addJob}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Job
      </Button>
    </div>
  );
}

// ── Education editor ───────────────────────────────────────────
export function EducationEditor({ data, onEdit, autoExpandIdx }) {
  const [expandedIdx, setExpandedIdx] = useState(autoExpandIdx ?? 0);

  useEffect(() => {
    if (autoExpandIdx != null) setExpandedIdx(autoExpandIdx);
  }, [autoExpandIdx]);

  const addDegree = () => {
    const newItem = { id: `edu${Date.now()}`, degree: 'Degree', institution: 'Institution', location: '', startDate: '', endDate: '', gpa: '' };
    const newItems = [...(data.items || []), newItem];
    onEdit('education', { ...data, items: newItems });
    setExpandedIdx(newItems.length - 1);
  };

  const removeItem = (idx) => {
    onEdit('education', { ...data, items: data.items.filter((_, i) => i !== idx) });
    setExpandedIdx(prev => prev >= idx ? Math.max(0, prev - 1) : prev);
  };

  const updateField = (idx, field, value) => {
    const items = [...data.items];
    items[idx] = { ...items[idx], [field]: value };
    onEdit('education', { ...data, items });
  };

  return (
    <div className="space-y-2">
      {(data.items || []).map((item, idx) => (
        <div key={item.id || idx} className="rounded-lg border border-border/60 overflow-hidden">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
            onClick={() => setExpandedIdx(expandedIdx === idx ? -1 : idx)}
          >
            <span className="text-[10px] text-muted-foreground/50 transition-transform duration-150" style={{ transform: expandedIdx === idx ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate">{item.degree || 'New Degree'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{item.institution}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); removeItem(idx); }} className="p-1 rounded hover:bg-destructive/10 shrink-0">
              <Trash2 className="h-3 w-3 text-destructive/60" />
            </button>
          </button>

          {expandedIdx === idx && (
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/40 bg-background/50">
              <Field label="Degree / Certificate">
                <Input value={item.degree || ''} onChange={e => updateField(idx, 'degree', e.target.value)} className="h-7 text-[11px]" />
              </Field>
              <Field label="Institution">
                <Input value={item.institution || ''} onChange={e => updateField(idx, 'institution', e.target.value)} className="h-7 text-[11px]" />
              </Field>
              <FieldGrid>
                <Field label="Start"><Input value={item.startDate || ''} onChange={e => updateField(idx, 'startDate', e.target.value)} className="h-7 text-[10px]" /></Field>
                <Field label="End"><Input value={item.endDate || ''} onChange={e => updateField(idx, 'endDate', e.target.value)} className="h-7 text-[10px]" /></Field>
              </FieldGrid>
              <FieldGrid>
                <Field label="Location"><Input value={item.location || ''} onChange={e => updateField(idx, 'location', e.target.value)} className="h-7 text-[10px]" /></Field>
                <Field label="GPA"><Input value={item.gpa || ''} onChange={e => updateField(idx, 'gpa', e.target.value)} className="h-7 text-[10px]" /></Field>
              </FieldGrid>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addDegree}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Degree
      </Button>
    </div>
  );
}

// ── Skills editor ──────────────────────────────────────────────
export function SkillsEditor({ data, onEdit, sections }) {
  const [generating, setGenerating] = useState(false);
  const setCategories = (cats) => onEdit('skills', { ...data, categories: cats });

  const handleGenerateDescriptions = async () => {
    const allSkills = data.categories.flatMap(cat => cat.skills.map(resolveSkillObj));
    if (allSkills.length === 0) { toast.error('Add some skills first.'); return; }
    const resumeData = sectionsToResumeData(sections || []);
    try {
      setGenerating(true);
      const result = await resumeAPI.generateSkillDescriptions(
        allSkills.map(s => s.name),
        resumeData.work_experience,
        resumeData.projects,
      );
      if (!result?.skills?.length) throw new Error('Empty response');
      const descMap = {};
      result.skills.forEach(s => { if (s.name) descMap[s.name.toLowerCase()] = s.desc || ''; });
      const newCats = data.categories.map(cat => ({
        ...cat,
        skills: cat.skills.map(rawSk => {
          const sk = resolveSkillObj(rawSk);
          const desc = descMap[sk.name.toLowerCase()] ?? sk.desc;
          return packSkill({ name: sk.name, desc });
        }),
      }));
      setCategories(newCats);
      toast.success('Skill descriptions generated!');
    } catch (err) {
      toast.error(err.message || 'AI generation failed');
    } finally { setGenerating(false); }
  };

  const updateCatLabel = (catIdx, value) => {
    const cats = [...data.categories];
    cats[catIdx] = { ...cats[catIdx], label: value };
    setCategories(cats);
  };

  const updateSkill = (catIdx, skIdx, field, value) => {
    const cats = [...data.categories];
    const skills = cats[catIdx].skills.map(resolveSkillObj);
    skills[skIdx] = { ...skills[skIdx], [field]: value };
    cats[catIdx] = { ...cats[catIdx], skills: skills.map(packSkill) };
    setCategories(cats);
  };

  const addSkill = (catIdx) => {
    const cats = [...data.categories];
    cats[catIdx] = { ...cats[catIdx], skills: [...cats[catIdx].skills, ''] };
    setCategories(cats);
  };

  const removeSkill = (catIdx, skIdx) => {
    const cats = [...data.categories];
    cats[catIdx] = { ...cats[catIdx], skills: cats[catIdx].skills.filter((_, i) => i !== skIdx) };
    setCategories(cats);
  };

  const addCategory = () => setCategories([...data.categories, { label: 'Category', skills: [] }]);
  const removeCategory = (idx) => setCategories(data.categories.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {data.categories.map((cat, catIdx) => (
        <div key={catIdx} className="space-y-2 p-2.5 bg-muted/40 rounded-lg border border-border/50">
          <div className="flex items-center gap-2">
            <Input value={cat.label} onChange={e => updateCatLabel(catIdx, e.target.value)} className="h-7 text-[11px] font-medium flex-1" placeholder="Category name" />
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 shrink-0" onClick={() => removeCategory(catIdx)}>
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
          {cat.skills.map((rawSk, skIdx) => {
            const sk = resolveSkillObj(rawSk);
            return (
              <div key={skIdx} className="space-y-1 pl-2 border-l-2 border-border/60">
                <div className="flex items-center gap-1.5">
                  <Input value={sk.name} onChange={e => updateSkill(catIdx, skIdx, 'name', e.target.value)} className="h-7 text-[11px] flex-1" placeholder="Skill name" />
                  <Button variant="ghost" size="sm" className="h-7 w-6 p-0 shrink-0" onClick={() => removeSkill(catIdx, skIdx)}>
                    <Trash2 className="h-3 w-3 text-muted-foreground/60" />
                  </Button>
                </div>
                <Textarea
                  value={sk.desc}
                  onChange={e => updateSkill(catIdx, skIdx, 'desc', e.target.value)}
                  className="text-[10px] min-h-[44px] resize-none leading-snug"
                  placeholder="How did you use it? (optional)"
                />
              </div>
            );
          })}
          <Button variant="ghost" size="sm" className="h-7 w-full text-[11px] text-muted-foreground border border-dashed border-border/60" onClick={() => addSkill(catIdx)}>
            <Plus className="h-3 w-3 mr-1" /> Add Skill
          </Button>
        </div>
      ))}
      <Button size="sm" className="w-full h-8 text-xs gap-1.5 bg-violet-600 hover:bg-violet-700 text-white" onClick={handleGenerateDescriptions} disabled={generating}>
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {generating ? 'Generating…' : 'Generate with AI'}
      </Button>
      <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addCategory}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Category
      </Button>
      <p className="text-[10px] text-muted-foreground/50">Tip: AI uses your work experience to write skill context automatically.</p>
    </div>
  );
}

// ── Projects editor ────────────────────────────────────────────
export function ProjectsEditor({ data, onEdit, autoExpandIdx }) {
  const [expandedIdx, setExpandedIdx] = useState(autoExpandIdx ?? 0);

  useEffect(() => {
    if (autoExpandIdx != null) setExpandedIdx(autoExpandIdx);
  }, [autoExpandIdx]);

  const addProject = () => {
    const newItem = { id: `proj${Date.now()}`, name: 'Project Name', description: '', technologies: [], link: '' };
    const newItems = [...(data.items || []), newItem];
    onEdit('projects', { ...data, items: newItems });
    setExpandedIdx(newItems.length - 1);
  };

  const removeItem = (idx) => {
    onEdit('projects', { ...data, items: data.items.filter((_, i) => i !== idx) });
    setExpandedIdx(prev => prev >= idx ? Math.max(0, prev - 1) : prev);
  };

  const updateField = (idx, field, value) => {
    const items = [...data.items];
    items[idx] = { ...items[idx], [field]: value };
    onEdit('projects', { ...data, items });
  };

  return (
    <div className="space-y-2">
      {(data.items || []).map((item, idx) => (
        <div key={item.id || idx} className="rounded-lg border border-border/60 overflow-hidden">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
            onClick={() => setExpandedIdx(expandedIdx === idx ? -1 : idx)}
          >
            <span className="text-[10px] text-muted-foreground/50 transition-transform duration-150" style={{ transform: expandedIdx === idx ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium truncate">{item.name || 'New Project'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{(item.technologies || []).join(', ')}</p>
            </div>
            <button onClick={e => { e.stopPropagation(); removeItem(idx); }} className="p-1 rounded hover:bg-destructive/10 shrink-0">
              <Trash2 className="h-3 w-3 text-destructive/60" />
            </button>
          </button>

          {expandedIdx === idx && (
            <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/40 bg-background/50">
              <Field label="Project Name">
                <Input value={item.name || ''} onChange={e => updateField(idx, 'name', e.target.value)} className="h-7 text-[11px]" />
              </Field>
              <Field label="Description">
                <Textarea value={item.description || ''} onChange={e => updateField(idx, 'description', e.target.value)} className="text-[11px] min-h-[70px] resize-none" />
              </Field>
              <Field label="Technologies (comma-separated)">
                <Input value={(item.technologies || []).join(', ')} onChange={e => updateField(idx, 'technologies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="h-7 text-[11px]" placeholder="React, Node.js…" />
              </Field>
              <Field label="Link (optional)">
                <Input value={item.link || ''} onChange={e => updateField(idx, 'link', e.target.value)} className="h-7 text-[11px]" placeholder="https://…" />
              </Field>
            </div>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addProject}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Add Project
      </Button>
    </div>
  );
}

// ── Text section editor ────────────────────────────────────────
export function TextEditor({ data, sectionId, onEdit }) {
  const update = (field, value) => onEdit(sectionId, { ...data, [field]: value });
  return (
    <div className="space-y-3">
      <Field label="Section Title">
        <Input value={data.title || ''} onChange={e => update('title', e.target.value)} className="h-8 text-xs" placeholder="e.g. Certifications, Awards…" />
      </Field>
      <Field label="Content">
        <Textarea value={data.content || ''} onChange={e => update('content', e.target.value)} className="text-xs min-h-[140px] resize-none" />
      </Field>
    </div>
  );
}

// ── Main router: picks the right editor based on section type ──
export function SectionEditor({ section, sections, onEdit, selection, style, onStyleChange }) {
  if (!section) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <p className="text-[11px] text-muted-foreground">Click a section to edit</p>
      </div>
    );
  }

  const { type, data, id } = section;
  const itemIdx = selection?.objKey?.startsWith('item_') ? parseInt(selection.objKey.split('_')[1]) : undefined;

  if (type === 'header') return <HeaderEditor data={data} onEdit={onEdit} style={style} onStyleChange={onStyleChange} />;
  if (type === 'experience') return <ExperienceEditor data={data} onEdit={onEdit} autoExpandIdx={itemIdx} />;
  if (type === 'education') return <EducationEditor data={data} onEdit={onEdit} autoExpandIdx={itemIdx} />;
  if (type === 'skills') return <SkillsEditor data={data} onEdit={onEdit} sections={sections} />;
  if (type === 'projects') return <ProjectsEditor data={data} onEdit={onEdit} autoExpandIdx={itemIdx} />;
  if (type === 'text') return <TextEditor data={data} sectionId={id} onEdit={onEdit} />;

  return <p className="text-xs text-muted-foreground">No editor for this section type.</p>;
}
