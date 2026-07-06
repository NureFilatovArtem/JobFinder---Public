// ─── Font definitions ──────────────────────────────────────────

export const HEADING_FONTS = {
  inter:        { label: 'Inter',            css: '"Inter", sans-serif',                                         url: null },
  poppins:      { label: 'Poppins',          css: '"Poppins", sans-serif',                                       url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap' },
  montserrat:   { label: 'Montserrat',       css: '"Montserrat", sans-serif',                                    url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap' },
  playfair:     { label: 'Playfair Display', css: '"Playfair Display", serif',                                   url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap' },
  lora:         { label: 'Lora',             css: '"Lora", serif',                                               url: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&display=swap' },
  merriweather: { label: 'Merriweather',     css: '"Merriweather", serif',                                       url: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap' },
  oswald:       { label: 'Oswald',           css: '"Oswald", sans-serif',                                        url: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&display=swap' },
  raleway:      { label: 'Raleway',          css: '"Raleway", sans-serif',                                       url: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap' },
  nunito:       { label: 'Nunito',           css: '"Nunito", sans-serif',                                        url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap' },
  dmserif:      { label: 'DM Serif',         css: '"DM Serif Display", serif',                                   url: 'https://fonts.googleapis.com/css2?family=DM+Serif+Display&display=swap' },
};

export const BODY_FONTS = {
  inter:      { label: 'Inter',          css: '"Inter", sans-serif',                                             url: null },
  roboto:     { label: 'Roboto',         css: '"Roboto", sans-serif',                                            url: 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap' },
  opensans:   { label: 'Open Sans',      css: '"Open Sans", sans-serif',                                         url: 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600&display=swap' },
  lato:       { label: 'Lato',           css: '"Lato", sans-serif',                                              url: 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap' },
  sourcesans: { label: 'Source Sans 3',  css: '"Source Sans 3", sans-serif',                                     url: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&display=swap' },
  worksans:   { label: 'Work Sans',      css: '"Work Sans", sans-serif',                                         url: 'https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;600&display=swap' },
  nunito:     { label: 'Nunito',         css: '"Nunito", sans-serif',                                            url: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600&display=swap' },
  ubuntu:     { label: 'Ubuntu',         css: '"Ubuntu", sans-serif',                                            url: 'https://fonts.googleapis.com/css2?family=Ubuntu:wght@400;500&display=swap' },
  ptsans:     { label: 'PT Sans',        css: '"PT Sans", sans-serif',                                           url: 'https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap' },
  system:     { label: 'System Default', css: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',       url: null },
};

// ─── Static defaults ───────────────────────────────────────────

export const SECTION_LABELS = {
  header: 'Header',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
};

export const DEFAULT_STYLE = {
  template: 'minimal',
  headingFont: 'inter',
  bodyFont: 'inter',
  accentColor: '#2563eb',
  spacing: 'normal',
  showPhoto: false,
  photoSize: 'medium',
  font: 'sans',
  cvLang: 'en',
  fontSize: null,    // null = use spacing preset default
  pagePadding: null, // null = use template default (38px)
};

export const DEFAULT_SECTIONS = [
  {
    id: 'header',
    type: 'header',
    visible: true,
    data: {
      fullName: '', title: '', email: '', phone: '',
      location: '', linkedin: '', website: '', summary: '',
      photoUrl: '',
    },
  },
  { id: 'experience', type: 'experience', visible: true, data: { items: [] } },
  { id: 'education',  type: 'education',  visible: true, data: { items: [] } },
  { id: 'skills',     type: 'skills',     visible: true, data: { categories: [] } },
  { id: 'projects',   type: 'projects',   visible: true, data: { items: [] } },
];

// ─── resumeDataToSections ──────────────────────────────────────

const _API = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_API_URL || 'http://localhost:3000')
  : 'http://localhost:3000';

function resolvePhotoUrl(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${_API}${url}`;
}

export function resumeDataToSections(resume, profile) {
  const sections = JSON.parse(JSON.stringify(DEFAULT_SECTIONS));

  sections[0].data = {
    fullName:  resume?.full_name     || profile?.name     || '',
    title:     resume?.title         || '',
    email:     resume?.email         || profile?.email    || '',
    phone:     resume?.phone         || profile?.phone    || '',
    location:  resume?.location      || profile?.location || '',
    linkedin:  resume?.linkedin_url  || '',
    website:   resume?.portfolio_url || '',
    summary:   resume?.summary       || '',
    photoUrl:  resolvePhotoUrl(resume?.photo_url),
  };

  if (resume?.work_experience?.length) {
    sections[1].data.items = resume.work_experience.map((exp, idx) => ({
      id:        `exp${idx}`,
      company:   exp.company    || '',
      role:      exp.title      || '',
      location:  exp.location   || '',
      startDate: exp.start_date || '',
      endDate:   exp.end_date   || '',
      bullets:   exp.achievements?.length
        ? exp.achievements
        : exp.description
        ? [exp.description]
        : [],
    }));
  }

  if (resume?.education?.length) {
    sections[2].data.items = resume.education.map((edu, idx) => ({
      id:          `edu${idx}`,
      degree:      edu.degree ? `${edu.degree}${edu.field ? ' in ' + edu.field : ''}` : '',
      institution: edu.institution || '',
      location:    '',
      startDate:   edu.start_date  || '',
      endDate:     edu.end_date    || '',
      gpa:         edu.gpa         || '',
      highlights:  '',
    }));
  }

  if (resume?.skills?.length) {
    sections[3].data.categories = [{ label: 'Skills', skills: resume.skills }];
  } else if (profile?.skills) {
    const list = profile.skills.split(',').map(s => s.trim()).filter(Boolean);
    if (list.length) sections[3].data.categories = [{ label: 'Skills', skills: list }];
  }

  if (resume?.projects?.length) {
    sections[4].data.items = resume.projects.map((p, idx) => ({
      id:           `proj${idx}`,
      name:         p.name         || '',
      description:  p.description  || '',
      technologies: Array.isArray(p.technologies) ? p.technologies : [],
      link:         p.link         || '',
    }));
  }

  return sections;
}

// ─── sectionsToResumeData ──────────────────────────────────────

export function sectionsToResumeData(sections, languages = []) {
  const header     = sections.find(s => s.type === 'header')?.data     || {};
  const experience = sections.find(s => s.type === 'experience')?.data || {};
  const education  = sections.find(s => s.type === 'education')?.data  || {};
  const skills     = sections.find(s => s.type === 'skills')?.data     || {};
  const projects   = sections.find(s => s.type === 'projects')?.data   || {};

  return {
    full_name:     header.fullName  || '',
    title:         header.title     || '',
    email:         header.email     || '',
    phone:         header.phone     || '',
    location:      header.location  || '',
    linkedin_url:  header.linkedin  || '',
    portfolio_url: header.website   || '',
    summary:       header.summary   || '',
    work_experience: (experience.items || []).map(item => ({
      title:        item.role      || '',
      company:      item.company   || '',
      location:     item.location  || '',
      start_date:   item.startDate || '',
      end_date:     item.endDate   || '',
      description:  (item.bullets || []).filter(Boolean).join('\n'),
      achievements: (item.bullets || []).filter(Boolean),
    })),
    education: (education.items || []).map(item => ({
      institution: item.institution || '',
      degree:      item.degree      || '',
      field:       '',
      start_date:  item.startDate   || '',
      end_date:    item.endDate     || '',
      gpa:         item.gpa         || '',
    })),
    skills:   (skills.categories || []).flatMap(cat =>
      (cat.skills || []).map(s => (typeof s === 'string' ? s : s.name).trim()).filter(Boolean)
    ),
    projects: (projects.items || []).map(item => ({
      name:         item.name         || '',
      description:  item.description  || '',
      technologies: item.technologies || [],
      link:         item.link         || '',
    })),
    certifications: [],
    languages,
  };
}

// ─── Wizard helpers ────────────────────────────────────────────

export const WIZARD_ROLE_LABELS = {
  software:   'Software Engineer',
  marketing:  'Marketing Specialist',
  sales:      'Sales Manager',
  logistics:  'Logistics Coordinator',
  design:     'UX/UI Designer',
  healthcare: 'Healthcare Professional',
  education:  'Education Specialist',
  finance:    'Finance Analyst',
};

export const WIZARD_TEMPLATE_STYLE = {
  minimal: { template: 'minimal', headingFont: 'inter',   bodyFont: 'inter',  accentColor: '#2563eb', spacing: 'normal'  },
  modern:  { template: 'modern',  headingFont: 'poppins', bodyFont: 'roboto', accentColor: '#1d4ed8', spacing: 'normal'  },
  compact: { template: 'compact', headingFont: 'inter',   bodyFont: 'inter',  accentColor: '#2563eb', spacing: 'compact' },
  manual:  { template: 'minimal', headingFont: 'inter',   bodyFont: 'inter',  accentColor: '#2563eb', spacing: 'normal'  },
};

export function wizardDataToSections(wizardData, profileData) {
  const title =
    wizardData.role === 'other'
      ? (wizardData.customRole || '')
      : (WIZARD_ROLE_LABELS[wizardData.role] || wizardData.role || '');

  return [
    {
      id: 'header',
      type: 'header',
      visible: true,
      data: {
        fullName: profileData?.name     || '',
        title,
        email:    profileData?.email    || '',
        phone:    profileData?.phone    || '',
        location: profileData?.location || '',
        linkedin: '',
        website:  '',
        summary:  wizardData.summary  || '',
        photoUrl: wizardData.photoUrl || '',
      },
    },
    {
      id: 'experience',
      type: 'experience',
      visible: true,
      data: {
        items: (wizardData.experiences || []).map((exp, idx) => ({
          id:        `exp${idx}`,
          role:      exp.role      || '',
          company:   exp.company   || '',
          location:  '',
          startDate: exp.startDate || '',
          endDate:   exp.endDate   || '',
          bullets:   (exp.achievements || []).filter(Boolean),
        })),
      },
    },
    {
      id: 'education',
      type: 'education',
      visible: true,
      data: {
        items: (wizardData.educations || []).map((edu, idx) => ({
          id:          `edu${idx}`,
          degree:      edu.degree ? `${edu.degree}${edu.field ? ' in ' + edu.field : ''}` : (edu.field || ''),
          institution: edu.institution || '',
          location:    '',
          startDate:   edu.startDate || '',
          endDate:     edu.endDate   || '',
          gpa:         '',
          highlights:  '',
        })),
      },
    },
    {
      id: 'skills',
      type: 'skills',
      visible: true,
      data: {
        categories: wizardData.skills?.length
          ? [{ label: 'Skills', skills: wizardData.skills }]
          : [],
      },
    },
    { id: 'projects', type: 'projects', visible: true, data: { items: [] } },
  ];
}
