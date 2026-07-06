import { useEffect, useRef, useState } from "react";
import { HEADING_FONTS, BODY_FONTS } from "@/lib/cvDefaults";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const LABELS = {
  en: { experience: 'Experience', education: 'Education', skills: 'Skills', projects: 'Projects', languages: 'Languages', contact: 'Contact', profile: 'Profile' },
  nl: { experience: 'Werkervaring', education: 'Opleiding', skills: 'Vaardigheden', projects: 'Projecten', languages: 'Talen', contact: 'Contactgegevens', profile: 'Profiel' },
};

function useGoogleFonts(style) {
  useEffect(() => {
    const urls = new Set();
    const hf = HEADING_FONTS[style?.headingFont];
    const bf = BODY_FONTS[style?.bodyFont];
    if (hf?.url) urls.add(hf.url);
    if (bf?.url) urls.add(bf.url);
    urls.forEach(url => {
      const id = `gf-${url.replace(/[^a-z0-9]/gi, '').slice(-30)}`;
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id; link.rel = 'stylesheet'; link.href = url;
        document.head.appendChild(link);
      }
    });
  }, [style?.headingFont, style?.bodyFont]);
}

const SP = {
  compact: { sectionGap: 14, itemGap: 9,  body: 9,    line: 1.45, nameSize: 22, titleSize: 10.5 },
  normal:  { sectionGap: 22, itemGap: 13, body: 10,   line: 1.55, nameSize: 26, titleSize: 12   },
  relaxed: { sectionGap: 30, itemGap: 18, body: 11.5, line: 1.65, nameSize: 30, titleSize: 13.5 },
};

function computeSP(style, def = 'normal') {
  const base = SP[style?.spacing || def];
  const fs = style?.fontSize;
  if (!fs) return base;
  const scale = fs / base.body;
  return { ...base, body: fs, nameSize: +(base.nameSize * scale).toFixed(1), titleSize: +(base.titleSize * scale).toFixed(1) };
}

function sd(sections, type) { return sections.find(s => s.type === type && s.visible)?.data || null; }
function textSects(sections) { return sections.filter(s => s.type === 'text' && s.visible); }
function levelWidth(level) { return ({ A1: '15%', A2: '28%', B1: '45%', B2: '62%', C1: '80%', C2: '95%', Native: '100%' })[level] || '50%'; }
function resolveUrl(url) { return !url ? null : url.startsWith('http') ? url : `${API_URL}${url}`; }
// Normalize skill entry to { name, desc }
function resolveSkill(s) { return typeof s === 'string' ? { name: s, desc: '' } : { name: s?.name || '', desc: s?.desc || '' }; }
// True if any skill in the category has a non-empty desc
function catHasDesc(cat) { return (cat.skills || []).some(s => resolveSkill(s).desc?.trim()); }

// ─── Object selection wrapper ──────────────────────────────────
// Each independently-selectable visual block in the CV.
// Shows dashed ring on hover, solid blue ring when selected.

function Obj({ id, objKey, selection, onSelectObj, children, tag: Tag = 'div', style: s = {}, fieldHint = null }) {
  const isSelected = selection?.sectionId === id && selection?.objKey === objKey;
  return (
    <Tag
      onClick={(e) => { e.stopPropagation(); onSelectObj(id, objKey, fieldHint); }}
      className={`cv-obj${isSelected ? ' cv-obj-selected' : ''}`}
      style={s}
    >
      {children}
    </Tag>
  );
}

// Section-heading divider — not selectable, just labels
function MinLabel({ label, accent, hf, fs }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
      <div style={{ width: 3, height: 13, background: accent, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontFamily: hf, fontSize: fs * 0.75, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#1a1a1a' }}>{label}</span>
      <div style={{ flex: 1, height: 0.75, background: '#e0e0e0' }} />
    </div>
  );
}

// ─── MINIMAL template ──────────────────────────────────────────

function MinimalTemplate({ sections, style, selection, onSelectObj, hf, bf, languages, cvLang }) {
  const sp     = computeSP(style, 'normal');
  const pp     = style?.pagePadding ?? 38;
  const accent = style?.accentColor || '#2563eb';
  const L      = LABELS[cvLang || 'en'];
  const header = sd(sections, 'header');
  const exp    = sd(sections, 'experience');
  const edu    = sd(sections, 'education');
  const skills = sd(sections, 'skills');
  const proj   = sd(sections, 'projects');
  const texts  = textSects(sections);

  const showPhoto = style?.showPhoto && header?.photoUrl;
  const photoSrc  = resolveUrl(header?.photoUrl);
  const pxSize    = { small: 58, medium: 74, large: 92 }[style?.photoSize || 'medium'];
  const contactRow = [header?.email, header?.phone, header?.location, header?.linkedin, header?.website].filter(Boolean);

  return (
    <div style={{ padding: `${pp}px ${Math.round(pp * 1.21)}px`, fontSize: sp.body, lineHeight: sp.line, color: '#1a1a1a', fontFamily: bf }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: sp.sectionGap }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: showPhoto ? 18 : 0 }}>

          {/* Photo object */}
          {showPhoto && photoSrc && (
            <Obj id="header" objKey="photo" selection={selection} onSelectObj={onSelectObj}
              style={{ flexShrink: 0 }}>
              <img src={photoSrc} alt="" style={{ width: pxSize, height: pxSize, borderRadius: 6, objectFit: 'cover', display: 'block', border: '1px solid #e0e0e0' }} />
            </Obj>
          )}

          <div style={{ flex: 1 }}>
            {/* Name + Title object */}
            <Obj id="header" objKey="name" selection={selection} onSelectObj={onSelectObj}>
              <div style={{ fontFamily: hf, fontSize: sp.nameSize, fontWeight: 800, letterSpacing: '-0.5px', color: '#0d0d0d', lineHeight: 1.05 }}>
                {header?.fullName || 'Your Name'}
              </div>
              {header?.title && (
                <div style={{ fontSize: sp.titleSize, color: accent, fontWeight: 600, marginTop: 4, fontFamily: hf }}>
                  {header.title}
                </div>
              )}
            </Obj>

            {/* Contact object */}
            {contactRow.length > 0 && (
              <Obj id="header" objKey="contact" selection={selection} onSelectObj={onSelectObj}
                style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', alignItems: 'center', fontSize: sp.body * 0.85, color: '#666' }}>
                {contactRow.map((item, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    {i > 0 && <span style={{ margin: '0 7px', color: '#ccc' }}>·</span>}
                    {item}
                  </span>
                ))}
              </Obj>
            )}
          </div>
        </div>

        {/* Summary object */}
        {header?.summary && (
          <Obj id="header" objKey="summary" selection={selection} onSelectObj={onSelectObj}
            tag="p" style={{ marginTop: 12, fontSize: sp.body, color: '#444', lineHeight: sp.line + 0.1, borderLeft: `3px solid ${accent}40`, paddingLeft: 10, margin: `12px 0 0` }}>
            {header.summary}
          </Obj>
        )}
      </div>

      <div style={{ borderTop: '1.5px solid #e8e8e8', marginBottom: sp.sectionGap }} />

      {/* ── Experience ── */}
      {exp?.items?.length > 0 && (
        <div style={{ marginBottom: sp.sectionGap }}>
          <MinLabel label={L.experience} accent={accent} hf={hf} fs={sp.body} />
          {exp.items.map((item, i) => (
            <Obj key={item.id || i} id="experience" objKey={`item_${i}`} selection={selection} onSelectObj={onSelectObj}
              style={{ marginBottom: sp.itemGap }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: hf, fontWeight: 700, fontSize: sp.body + 1, color: '#111' }}>{item.company}</span>
                <span style={{ fontSize: sp.body * 0.75, color: '#999', flexShrink: 0, background: '#f5f5f5', padding: '1.5px 6px', borderRadius: 3 }}>
                  {item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}
                </span>
              </div>
              <div style={{ fontSize: sp.body, color: accent, fontWeight: 500, marginTop: 2, fontStyle: 'italic' }}>{item.role}</div>
              {item.location && <div style={{ fontSize: sp.body * 0.8, color: '#aaa', marginTop: 1 }}>{item.location}</div>}
              {item.bullets?.filter(Boolean).map((b, bi) => (
                <div key={bi} style={{ fontSize: sp.body - 0.5, color: '#444', paddingLeft: 13, marginTop: 3, position: 'relative', lineHeight: sp.line }}>
                  <span style={{ position: 'absolute', left: 3, color: accent, fontSize: sp.body * 0.8 }}>▸</span>{b}
                </div>
              ))}
            </Obj>
          ))}
        </div>
      )}

      {/* ── Education ── */}
      {edu?.items?.length > 0 && (
        <div style={{ marginBottom: sp.sectionGap }}>
          <MinLabel label={L.education} accent={accent} hf={hf} fs={sp.body} />
          {edu.items.map((item, i) => (
            <Obj key={item.id || i} id="education" objKey={`item_${i}`} selection={selection} onSelectObj={onSelectObj}
              style={{ marginBottom: sp.itemGap }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: hf, fontWeight: 700, fontSize: sp.body, color: '#111' }}>{item.degree}</span>
                <span style={{ fontSize: sp.body * 0.75, color: '#999', flexShrink: 0 }}>{item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}</span>
              </div>
              <div style={{ fontSize: sp.body - 0.5, color: '#555', marginTop: 2 }}>{item.institution}</div>
              {item.gpa && <div style={{ fontSize: sp.body * 0.75, color: '#999', marginTop: 1 }}>GPA: {item.gpa}</div>}
            </Obj>
          ))}
        </div>
      )}

      {/* ── Skills ── */}
      {skills?.categories?.length > 0 && (
        <div style={{ marginBottom: sp.sectionGap }}>
          <MinLabel label={L.skills} accent={accent} hf={hf} fs={sp.body} />
          <Obj id="skills" objKey="all" selection={selection} onSelectObj={onSelectObj}>
            {skills.categories.map((cat, i) => {
              const withDesc = catHasDesc(cat);
              return (
                <div key={i} style={{ marginBottom: 6 }}>
                  {skills.categories.length > 1 && (
                    <div style={{ fontSize: sp.body * 0.85, fontWeight: 700, color: '#555', marginBottom: 4 }}>{cat.label}</div>
                  )}
                  {withDesc ? (
                    // Mixed rendering: each skill decides its own format
                    <div>
                      {/* Dot-separated inline for skills without description */}
                      {cat.skills.some(s => !resolveSkill(s).desc?.trim()) && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', lineHeight: 1.9, marginBottom: cat.skills.some(s => resolveSkill(s).desc?.trim()) ? 7 : 0 }}>
                          {cat.skills.filter(s => !resolveSkill(s).desc?.trim()).map((rawSk, si) => (
                            <span key={si} style={{ display: 'inline-flex', alignItems: 'center' }}>
                              {si > 0 && <span style={{ margin: '0 5px', color: `${accent}99`, fontSize: sp.body * 0.65 }}>◆</span>}
                              <span style={{ fontSize: sp.body * 0.9, color: '#3a3a3a', fontWeight: 450 }}>{resolveSkill(rawSk).name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Cards for skills with description */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {cat.skills.filter(s => resolveSkill(s).desc?.trim()).map((rawSk, si) => {
                          const sk = resolveSkill(rawSk);
                          return (
                            <div key={si} style={{ paddingLeft: 8, borderLeft: `2px solid ${accent}50` }}>
                              <div style={{ fontSize: sp.body, fontWeight: 700, color: '#111', lineHeight: 1.25 }}>{sk.name}</div>
                              <div style={{ fontSize: sp.body * 0.88, color: '#555', marginTop: 1.5, lineHeight: 1.45 }}>{sk.desc}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', lineHeight: 1.9 }}>
                      {cat.skills.map((rawSk, si) => (
                        <span key={si} style={{ display: 'inline-flex', alignItems: 'center' }}>
                          {si > 0 && <span style={{ margin: '0 5px', color: `${accent}99`, fontSize: sp.body * 0.65 }}>◆</span>}
                          <span style={{ fontSize: sp.body * 0.9, color: '#3a3a3a', fontWeight: 450 }}>{resolveSkill(rawSk).name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Obj>
        </div>
      )}

      {/* ── Projects ── */}
      {proj?.items?.length > 0 && (
        <div style={{ marginBottom: sp.sectionGap }}>
          <MinLabel label={L.projects} accent={accent} hf={hf} fs={sp.body} />
          {proj.items.map((item, i) => (
            <Obj key={item.id || i} id="projects" objKey={`item_${i}`} selection={selection} onSelectObj={onSelectObj}
              style={{ marginBottom: sp.itemGap }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: hf, fontWeight: 700, fontSize: sp.body, color: '#111' }}>{item.name}</span>
                {item.technologies?.length > 0 && <span style={{ fontSize: sp.body * 0.8, color: accent, fontWeight: 500 }}>({item.technologies.join(', ')})</span>}
              </div>
              {item.description && <div style={{ fontSize: sp.body - 0.5, color: '#555', marginTop: 2, lineHeight: sp.line }}>{item.description}</div>}
            </Obj>
          ))}
        </div>
      )}

      {/* ── Languages ── */}
      {languages?.length > 0 && (
        <div style={{ marginBottom: sp.sectionGap }}>
          <MinLabel label={L.languages} accent={accent} hf={hf} fs={sp.body} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 20px' }}>
            {languages.map((lang, i) => {
              const name = lang.language || lang.name || '';
              const level = lang.proficiency || lang.level || '';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: sp.body * 0.9, color: '#333', fontWeight: 500 }}>{name}</span>
                  {level && <span style={{ fontSize: sp.body * 0.8, color: '#999' }}>({level})</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Custom text sections ── */}
      {texts.map(section => (
        <Obj key={section.id} id={section.id} objKey="all" selection={selection} onSelectObj={onSelectObj}
          style={{ marginBottom: sp.sectionGap }}>
          {section.data?.title && <MinLabel label={section.data.title} accent={accent} hf={hf} fs={sp.body} />}
          <div style={{ fontSize: sp.body, color: '#444', whiteSpace: 'pre-line', lineHeight: sp.line }}>{section.data?.content}</div>
        </Obj>
      ))}
    </div>
  );
}

// ─── MODERN template ──────────────────────────────────────────

function SideLabel({ label, accent, hf, fs }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <span style={{ fontFamily: hf, fontSize: fs * 0.7, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent }}>{label}</span>
      <div style={{ height: 1.5, background: `${accent}30`, marginTop: 4 }} />
    </div>
  );
}
function MainLabel({ label, hf, fs }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
      <span style={{ fontFamily: hf, fontSize: fs * 0.8, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase', color: '#222' }}>{label}</span>
      <div style={{ flex: 1, height: 0.75, background: '#dedede' }} />
    </div>
  );
}

function ModernTemplate({ sections, style, selection, onSelectObj, hf, bf, languages, cvLang }) {
  const sp     = computeSP(style, 'normal');
  const pp     = style?.pagePadding ?? 38;
  const accent = style?.accentColor || '#2563eb';
  const L      = LABELS[cvLang || 'en'];
  const header = sd(sections, 'header');
  const exp    = sd(sections, 'experience');
  const edu    = sd(sections, 'education');
  const skills = sd(sections, 'skills');
  const proj   = sd(sections, 'projects');
  const texts  = textSects(sections);

  const showPhoto = style?.showPhoto && header?.photoUrl;
  const photoSrc  = resolveUrl(header?.photoUrl);
  const pxSize    = { small: 66, medium: 84, large: 104 }[style?.photoSize || 'medium'];

  return (
    <div style={{ display: 'flex', minHeight: '297mm', fontFamily: bf, fontSize: sp.body, lineHeight: sp.line, color: '#1a1a1a' }}>

      {/* ── Left sidebar ── */}
      <div style={{ width: '33%', background: `${accent}08`, borderRight: `1.5px solid ${accent}18`, padding: `${pp}px ${Math.round(pp * 0.47)}px`, flexShrink: 0 }}>

        {/* Photo */}
        {showPhoto && photoSrc && (
          <Obj id="header" objKey="photo" selection={selection} onSelectObj={onSelectObj}
            style={{ marginBottom: 12 }}>
            <img src={photoSrc} alt="" style={{ width: '100%', maxWidth: pxSize, height: pxSize, borderRadius: 6, objectFit: 'cover', display: 'block', border: `2px solid ${accent}28` }} />
          </Obj>
        )}

        {/* Name + Title */}
        <Obj id="header" objKey="name" selection={selection} onSelectObj={onSelectObj}
          style={{ marginBottom: sp.sectionGap }}>
          <div style={{ fontFamily: hf, fontSize: sp.nameSize, fontWeight: 800, letterSpacing: '-0.5px', color: '#0d0d0d', lineHeight: 1.05, marginBottom: 5 }}>
            {header?.fullName || 'Your Name'}
          </div>
          {header?.title && (
            <div style={{ fontSize: sp.titleSize, color: accent, fontWeight: 600, fontFamily: hf }}>
              {header.title}
            </div>
          )}
        </Obj>

        {/* Contact */}
        {(header?.email || header?.phone || header?.location || header?.linkedin || header?.website) && (
          <Obj id="header" objKey="contact" selection={selection} onSelectObj={onSelectObj}
            style={{ marginBottom: sp.sectionGap }}>
            <SideLabel label={L.contact} accent={accent} hf={hf} fs={sp.body} />
            {[['✉', header?.email], ['✆', header?.phone], ['⌖', header?.location], ['in', header?.linkedin], ['⊕', header?.website]]
              .filter(([, v]) => v).map(([icon, val], i) => (
                <div key={i} style={{ fontSize: sp.body * 0.85, color: '#444', marginBottom: 5, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: accent, fontSize: sp.body * 0.8, width: 10, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                  <span style={{ wordBreak: 'break-all', lineHeight: 1.4 }}>{val}</span>
                </div>
              ))}
          </Obj>
        )}

        {/* Education */}
        {edu?.items?.length > 0 && (
          <div style={{ marginBottom: sp.sectionGap }}>
            <SideLabel label={L.education} accent={accent} hf={hf} fs={sp.body} />
            {edu.items.map((item, i) => (
              <Obj key={item.id || i} id="education" objKey={`item_${i}`} selection={selection} onSelectObj={onSelectObj}
                style={{ marginBottom: sp.itemGap }}>
                <div style={{ fontFamily: hf, fontWeight: 700, fontSize: sp.body, color: '#111', lineHeight: 1.25 }}>{item.degree}</div>
                <div style={{ fontSize: sp.body * 0.85, color: '#555', marginTop: 2 }}>{item.institution}</div>
                <div style={{ fontSize: sp.body * 0.8, color: accent, marginTop: 2 }}>{item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}</div>
                {item.gpa && <div style={{ fontSize: sp.body * 0.75, color: '#999', marginTop: 1 }}>GPA: {item.gpa}</div>}
              </Obj>
            ))}
          </div>
        )}

        {/* Skills */}
        {skills?.categories?.length > 0 && (
          <div style={{ marginBottom: sp.sectionGap }}>
            <SideLabel label={L.skills} accent={accent} hf={hf} fs={sp.body} />
            <Obj id="skills" objKey="all" selection={selection} onSelectObj={onSelectObj}>
              {skills.categories.map((cat, i) => {
                const withDesc = catHasDesc(cat);
                return (
                  <div key={i} style={{ marginBottom: 5 }}>
                    {skills.categories.length > 1 && <div style={{ fontSize: sp.body * 0.8, color: '#666', marginBottom: 3, fontWeight: 600 }}>{cat.label}</div>}
                    {withDesc ? (
                      <div>
                        {cat.skills.some(s => !resolveSkill(s).desc?.trim()) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: cat.skills.some(s => resolveSkill(s).desc?.trim()) ? 6 : 0 }}>
                            {cat.skills.filter(s => !resolveSkill(s).desc?.trim()).map((rawSk, si) => (
                              <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, flexShrink: 0, opacity: 0.8 }} />
                                <span style={{ fontSize: sp.body * 0.85, color: '#333', lineHeight: 1.4 }}>{resolveSkill(rawSk).name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {cat.skills.filter(s => resolveSkill(s).desc?.trim()).map((rawSk, si) => {
                            const sk = resolveSkill(rawSk);
                            return (
                              <div key={si} style={{ paddingLeft: 7, borderLeft: `2px solid ${accent}50` }}>
                                <div style={{ fontSize: sp.body, fontWeight: 700, color: '#111', lineHeight: 1.25 }}>{sk.name}</div>
                                <div style={{ fontSize: sp.body * 0.88, color: '#555', marginTop: 1.5, lineHeight: 1.45 }}>{sk.desc}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {cat.skills.map((rawSk, si) => (
                          <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, flexShrink: 0, opacity: 0.8 }} />
                            <span style={{ fontSize: sp.body * 0.85, color: '#333', lineHeight: 1.4 }}>{resolveSkill(rawSk).name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Obj>
          </div>
        )}

        {/* Languages */}
        {languages?.length > 0 && (
          <div style={{ marginBottom: sp.sectionGap }}>
            <SideLabel label={L.languages} accent={accent} hf={hf} fs={sp.body} />
            {languages.map((lang, i) => {
              const name = lang.language || lang.name || '';
              const level = lang.proficiency || lang.level || '';
              return (
                <div key={i} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: sp.body * 0.9, color: '#222', fontWeight: 500 }}>{name}</span>
                    {level && <span style={{ fontSize: sp.body * 0.75, color: accent, fontWeight: 600 }}>{level}</span>}
                  </div>
                  {level && (
                    <div style={{ height: 3, background: `${accent}18`, borderRadius: 2, marginTop: 3 }}>
                      <div style={{ height: '100%', width: levelWidth(level), background: accent, borderRadius: 2 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right main ── */}
      <div style={{ flex: 1, padding: `${pp}px ${Math.round(pp * 0.74)}px`, background: '#fff' }}>

        {/* Summary */}
        {header?.summary && (
          <Obj id="header" objKey="summary" selection={selection} onSelectObj={onSelectObj}
            style={{ marginBottom: sp.sectionGap }}>
            <MainLabel label={L.profile} hf={hf} fs={sp.body} />
            <p style={{ fontSize: sp.body, color: '#444', lineHeight: sp.line + 0.1, margin: 0 }}>{header.summary}</p>
          </Obj>
        )}

        {/* Experience */}
        {exp?.items?.length > 0 && (
          <div style={{ marginBottom: sp.sectionGap }}>
            <MainLabel label={L.experience} hf={hf} fs={sp.body} />
            {exp.items.map((item, i) => (
              <Obj key={item.id || i} id="experience" objKey={`item_${i}`} selection={selection} onSelectObj={onSelectObj}
                style={{ marginBottom: sp.itemGap, paddingLeft: 10, borderLeft: `2px solid ${accent}28` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: hf, fontWeight: 700, fontSize: sp.body + 0.5, color: '#111' }}>{item.role}</span>
                  <span style={{ fontSize: sp.body * 0.75, color: '#999', flexShrink: 0 }}>{item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}</span>
                </div>
                <div style={{ fontSize: sp.body - 0.5, color: accent, fontWeight: 500, marginTop: 2, fontStyle: 'italic' }}>
                  {item.company}{item.location ? ` · ${item.location}` : ''}
                </div>
                {item.bullets?.filter(Boolean).map((b, bi) => (
                  <div key={bi} style={{ fontSize: sp.body - 0.5, color: '#444', paddingLeft: 10, marginTop: 3, position: 'relative', lineHeight: sp.line }}>
                    <span style={{ position: 'absolute', left: 2 }}>•</span>{b}
                  </div>
                ))}
              </Obj>
            ))}
          </div>
        )}

        {/* Projects */}
        {proj?.items?.length > 0 && (
          <div style={{ marginBottom: sp.sectionGap }}>
            <MainLabel label={L.projects} hf={hf} fs={sp.body} />
            {proj.items.map((item, i) => (
              <Obj key={item.id || i} id="projects" objKey={`item_${i}`} selection={selection} onSelectObj={onSelectObj}
                style={{ marginBottom: sp.itemGap, paddingLeft: 10, borderLeft: `2px solid ${accent}28` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: hf, fontWeight: 700, fontSize: sp.body, color: '#111' }}>{item.name}</span>
                  {item.technologies?.length > 0 && <span style={{ fontSize: sp.body * 0.8, color: accent }}>{item.technologies.join(', ')}</span>}
                </div>
                {item.description && <div style={{ fontSize: sp.body - 0.5, color: '#555', marginTop: 2, lineHeight: sp.line }}>{item.description}</div>}
              </Obj>
            ))}
          </div>
        )}

        {texts.map(section => (
          <Obj key={section.id} id={section.id} objKey="all" selection={selection} onSelectObj={onSelectObj}
            style={{ marginBottom: sp.sectionGap }}>
            {section.data?.title && <MainLabel label={section.data.title} hf={hf} fs={sp.body} />}
            <div style={{ fontSize: sp.body, color: '#444', whiteSpace: 'pre-line', lineHeight: sp.line }}>{section.data?.content}</div>
          </Obj>
        ))}
      </div>
    </div>
  );
}

// ─── COMPACT template ──────────────────────────────────────────

function CptSideLabel({ label, hf, fs }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontFamily: hf, fontSize: fs * 0.7, fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>{label}</div>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />
    </div>
  );
}
function CptMainLabel({ label, accent, hf, fs }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <span style={{ fontFamily: hf, fontSize: fs * 0.75, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent }}>{label}</span>
      <div style={{ height: 1.5, background: `${accent}25`, marginTop: 4 }} />
    </div>
  );
}

function CompactTemplate({ sections, style, selection, onSelectObj, hf, bf, languages, cvLang }) {
  const sp     = computeSP(style, 'compact');
  const pp     = style?.pagePadding ?? 38;
  const accent = style?.accentColor || '#2563eb';
  const L      = LABELS[cvLang || 'en'];
  const header = sd(sections, 'header');
  const exp    = sd(sections, 'experience');
  const edu    = sd(sections, 'education');
  const skills = sd(sections, 'skills');
  const proj   = sd(sections, 'projects');
  const texts  = textSects(sections);

  const showPhoto = style?.showPhoto && header?.photoUrl;
  const photoSrc  = resolveUrl(header?.photoUrl);
  const pxSize    = { small: 62, medium: 78, large: 96 }[style?.photoSize || 'medium'];
  const sideBg    = '#1e2532';

  return (
    <div style={{ display: 'flex', minHeight: '297mm', fontSize: sp.body, lineHeight: sp.line, fontFamily: bf }}>

      {/* ── Left sidebar ── */}
      <div style={{ width: '36%', background: sideBg, padding: `${Math.round(pp * 0.74)}px ${Math.round(pp * 0.42)}px`, color: '#fff', flexShrink: 0 }}>

        {showPhoto && photoSrc && (
          <Obj id="header" objKey="photo" selection={selection} onSelectObj={onSelectObj}
            style={{ marginBottom: 12 }}>
            <img src={photoSrc} alt="" style={{ width: pxSize, height: pxSize, borderRadius: 4, objectFit: 'cover', display: 'block', border: '2px solid rgba(255,255,255,0.15)' }} />
          </Obj>
        )}

        <Obj id="header" objKey="name" selection={selection} onSelectObj={onSelectObj}
          style={{ marginBottom: sp.sectionGap }}>
          <div style={{ fontFamily: hf, fontSize: sp.nameSize, fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.3px' }}>
            {header?.fullName || 'Your Name'}
          </div>
          {header?.title && (
            <div style={{ fontSize: sp.titleSize, color: 'rgba(255,255,255,0.55)', fontWeight: 400, marginTop: 4 }}>
              {header.title}
            </div>
          )}
        </Obj>

        <Obj id="header" objKey="contact" selection={selection} onSelectObj={onSelectObj}
          style={{ marginBottom: sp.sectionGap }}>
          <CptSideLabel label={L.contact} hf={hf} fs={sp.body} />
          {[['✉', header?.email], ['✆', header?.phone], ['⌖', header?.location], ['in', header?.linkedin], ['⊕', header?.website]]
            .filter(([, v]) => v).map(([icon, val], i) => (
              <div key={i} style={{ fontSize: sp.body * 0.85, color: 'rgba(255,255,255,0.6)', marginBottom: 5, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ color: accent, fontSize: sp.body * 0.8, width: 10, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                <span style={{ wordBreak: 'break-all', lineHeight: 1.4 }}>{val}</span>
              </div>
            ))}
        </Obj>

        {skills?.categories?.length > 0 && (
          <div style={{ marginBottom: sp.sectionGap }}>
            <CptSideLabel label={L.skills} hf={hf} fs={sp.body} />
            <Obj id="skills" objKey="all" selection={selection} onSelectObj={onSelectObj}>
              {skills.categories.map((cat, i) => {
                const withDesc = catHasDesc(cat);
                return (
                  <div key={i} style={{ marginBottom: 5 }}>
                    {skills.categories.length > 1 && <div style={{ fontSize: sp.body * 0.75, color: 'rgba(255,255,255,0.35)', marginBottom: 3, fontWeight: 600 }}>{cat.label}</div>}
                    {withDesc ? (
                      <div>
                        {cat.skills.some(s => !resolveSkill(s).desc?.trim()) && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: cat.skills.some(s => resolveSkill(s).desc?.trim()) ? 6 : 0 }}>
                            {cat.skills.filter(s => !resolveSkill(s).desc?.trim()).map((rawSk, si) => (
                              <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                                <span style={{ fontSize: sp.body * 0.85, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{resolveSkill(rawSk).name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {cat.skills.filter(s => resolveSkill(s).desc?.trim()).map((rawSk, si) => {
                            const sk = resolveSkill(rawSk);
                            return (
                              <div key={si} style={{ paddingLeft: 7, borderLeft: `2px solid rgba(255,255,255,0.25)` }}>
                                <div style={{ fontSize: sp.body, fontWeight: 700, color: 'rgba(255,255,255,0.95)', lineHeight: 1.25 }}>{sk.name}</div>
                                <div style={{ fontSize: sp.body * 0.88, color: 'rgba(255,255,255,0.55)', marginTop: 1.5, lineHeight: 1.45 }}>{sk.desc}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {cat.skills.map((rawSk, si) => (
                          <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                            <span style={{ fontSize: sp.body * 0.85, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{resolveSkill(rawSk).name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </Obj>
          </div>
        )}

        {languages?.length > 0 && (
          <div style={{ marginBottom: sp.sectionGap }}>
            <CptSideLabel label={L.languages} hf={hf} fs={sp.body} />
            {languages.map((lang, i) => {
              const name = lang.language || lang.name || '';
              const level = lang.proficiency || lang.level || '';
              return (
                <div key={i} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: sp.body * 0.9, color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{name}</span>
                    {level && <span style={{ fontSize: sp.body * 0.75, color: 'rgba(255,255,255,0.45)' }}>{level}</span>}
                  </div>
                  {level && (
                    <div style={{ height: 2.5, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginTop: 3 }}>
                      <div style={{ height: '100%', width: levelWidth(level), background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {edu?.items?.length > 0 && (
          <div style={{ marginBottom: sp.sectionGap }}>
            <CptSideLabel label={L.education} hf={hf} fs={sp.body} />
            {edu.items.map((item, i) => (
              <Obj key={item.id || i} id="education" objKey={`item_${i}`} selection={selection} onSelectObj={onSelectObj}
                style={{ marginBottom: sp.itemGap }}>
                <div style={{ fontFamily: hf, fontWeight: 700, fontSize: sp.body - 0.5, color: 'rgba(255,255,255,0.9)', lineHeight: 1.2 }}>{item.degree}</div>
                <div style={{ fontSize: sp.body * 0.8, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{item.institution}</div>
                <div style={{ fontSize: sp.body * 0.75, color: accent, marginTop: 1.5 }}>{item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}</div>
              </Obj>
            ))}
          </div>
        )}
      </div>

      {/* ── Right main ── */}
      <div style={{ flex: 1, padding: `${Math.round(pp * 0.74)}px ${Math.round(pp * 0.53)}px`, background: '#fff' }}>

        {header?.summary && (
          <Obj id="header" objKey="summary" selection={selection} onSelectObj={onSelectObj}
            style={{ marginBottom: sp.sectionGap }}>
            <CptMainLabel label={L.profile} accent={accent} hf={hf} fs={sp.body} />
            <p style={{ fontSize: sp.body, color: '#444', lineHeight: sp.line + 0.1, margin: 0 }}>{header.summary}</p>
          </Obj>
        )}

        {exp?.items?.length > 0 && (
          <div style={{ marginBottom: sp.sectionGap }}>
            <CptMainLabel label={L.experience} accent={accent} hf={hf} fs={sp.body} />
            {exp.items.map((item, i) => (
              <Obj key={item.id || i} id="experience" objKey={`item_${i}`} selection={selection} onSelectObj={onSelectObj}
                style={{ marginBottom: sp.itemGap }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: hf, fontWeight: 700, fontSize: sp.body, color: '#111' }}>{item.role}</span>
                  <span style={{ fontSize: sp.body * 0.75, color: '#999', flexShrink: 0 }}>{item.startDate}{item.endDate ? ` – ${item.endDate}` : ''}</span>
                </div>
                <div style={{ fontSize: sp.body - 1, color: '#666', marginTop: 1.5, fontStyle: 'italic' }}>
                  {item.company}{item.location ? `, ${item.location}` : ''}
                </div>
                {item.bullets?.filter(Boolean).map((b, bi) => (
                  <div key={bi} style={{ fontSize: sp.body - 1, color: '#444', paddingLeft: 10, marginTop: 2.5, position: 'relative', lineHeight: sp.line }}>
                    <span style={{ position: 'absolute', left: 2 }}>•</span>{b}
                  </div>
                ))}
              </Obj>
            ))}
          </div>
        )}

        {proj?.items?.length > 0 && (
          <div style={{ marginBottom: sp.sectionGap }}>
            <CptMainLabel label={L.projects} accent={accent} hf={hf} fs={sp.body} />
            {proj.items.map((item, i) => (
              <Obj key={item.id || i} id="projects" objKey={`item_${i}`} selection={selection} onSelectObj={onSelectObj}
                style={{ marginBottom: sp.itemGap }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: hf, fontWeight: 700, fontSize: sp.body, color: '#111' }}>{item.name}</span>
                  {item.technologies?.length > 0 && <span style={{ fontSize: sp.body * 0.75, color: accent }}>{item.technologies.join(' · ')}</span>}
                </div>
                {item.description && <div style={{ fontSize: sp.body - 1, color: '#444', marginTop: 2, lineHeight: sp.line }}>{item.description}</div>}
              </Obj>
            ))}
          </div>
        )}

        {texts.map(section => (
          <Obj key={section.id} id={section.id} objKey="all" selection={selection} onSelectObj={onSelectObj}
            style={{ marginBottom: sp.sectionGap }}>
            {section.data?.title && <CptMainLabel label={section.data.title} accent={accent} hf={hf} fs={sp.body} />}
            <div style={{ fontSize: sp.body, color: '#444', whiteSpace: 'pre-line', lineHeight: sp.line }}>{section.data?.content}</div>
          </Obj>
        ))}
      </div>
    </div>
  );
}

// ─── CVCanvas ─────────────────────────────────────────────────

// A4 height in CSS pixels at 96dpi — used for auto-fit detection
const A4_PX = 1123;

export default function CVCanvas({ sections, selection, onSelectObj, onEdit, style, languages = [] }) {
  useGoogleFonts(style);

  const hf      = HEADING_FONTS[style?.headingFont]?.css || '"Inter", sans-serif';
  const bf      = BODY_FONTS[style?.bodyFont]?.css       || '"Inter", sans-serif';
  const cvLang  = style?.cvLang || 'en';
  const multiPage = style?.multiPage || false;

  const contentRef = useRef(null);
  const [autoScale, setAutoScale] = useState(1);

  // Measure after every content/style change and recompute scale
  useEffect(() => {
    if (multiPage) { setAutoScale(1); return; }

    const measure = () => {
      if (!contentRef.current) return;
      const h = contentRef.current.scrollHeight;
      const newScale = h > A4_PX ? Math.max(0.55, A4_PX / h) : 1;
      setAutoScale(prev => Math.abs(prev - newScale) > 0.002 ? newScale : prev);
    };

    measure();
    // Re-measure after fonts finish loading (async)
    const t = setTimeout(measure, 400);
    return () => clearTimeout(t);
  }, [sections, style, languages, multiPage]);

  const tProps = { sections, style, selection, onSelectObj, hf, bf, languages, cvLang };
  const scaled = !multiPage && autoScale < 0.999;

  const scrollRef = useRef(null);
  const [hScale, setHScale] = useState(1);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const CV_W = 794;
    const update = () => setHScale(Math.min(1, (el.clientWidth - 40) / CV_W));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto bg-muted/40 p-5 flex justify-center cv-canvas-scroll"
      onClick={() => onSelectObj(null, null)}
    >
      <style>{`
        .cv-obj {
          cursor: pointer;
          border-radius: 3px;
          outline: 1.5px solid transparent;
          outline-offset: 3px;
        }
        .cv-obj:hover {
          outline: 1.5px dashed rgba(59,130,246,0.5);
          outline-offset: 3px;
        }
        .cv-obj.cv-obj-selected {
          outline: 2px solid #3b82f6 !important;
          outline-offset: 3px;
        }
      `}</style>

      <div
        className="flex flex-col items-center"
        style={hScale < 1 ? { zoom: hScale } : undefined}
        onClick={e => e.stopPropagation()}
      >

        {/* Paper shell — always 210 × 297 mm, clips overflow */}
        <div
          className="rounded-sm shadow-xl ring-1 ring-black/5 bg-white"
          style={{
            width: '210mm',
            height: multiPage ? undefined : '297mm',
            minHeight: multiPage ? '297mm' : undefined,
            overflow: multiPage ? 'visible' : 'hidden',
            position: 'relative',
          }}
        >
          {/* Scale wrapper — purely visual, not cloned for PDF export */}
          <div style={scaled ? { transform: `scale(${autoScale})`, transformOrigin: 'top left', width: `${100 / autoScale}%` } : undefined}>
            {/* cv-canvas — this element is cloned for PDF; no transform on it */}
            <div
              ref={contentRef}
              className="cv-canvas"
              style={{ fontFamily: bf, width: '210mm', minHeight: '297mm' }}
            >
              {style?.template === 'modern'  ? <ModernTemplate  {...tProps} /> :
               style?.template === 'compact' ? <CompactTemplate {...tProps} /> :
                                               <MinimalTemplate {...tProps} />}
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/50 mt-3 mb-6 select-none">
          A4 · 210 × 297 mm · Click any element to edit
          {scaled && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              Auto-fit {Math.round(autoScale * 100)}%
            </span>
          )}
          {multiPage && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              Multi-page
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
