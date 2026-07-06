import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search, FileText, LayoutGrid, CheckCircle2,
  X, ArrowRight, SlidersHorizontal, MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoginForm } from '@/components/login-form';

// ─── Translations ─────────────────────────────────────────────

const T = {
  en: {
    flagCode: 'gb', label: 'EN',
    eyebrow: 'Job search · CV builder · Applications',
    headline1: 'Find the right job.',
    headline2: 'Faster.',
    subtext: 'Search opportunities, build your CV, and manage applications in one place.',
    cta: 'Get Started For Free',
    ctaShort: 'Get Started',
    login: 'Login',
    navProduct: 'Product',
    navFeatures: 'Features',
    navContact: 'Contact',
    featuresLabel: 'Features',
    featuresHeading: 'One place for your entire job search.',
    ctaH1: 'Start now.',
    ctaH2: 'No complexity.',
    ctaSub: 'Your next opportunity is already waiting.',
    footerRights: 'All rights reserved.',
    privacy: 'Privacy', terms: 'Terms', contact: 'Contact',
    features: [
      { title: 'Smart Filters & Map Search', body: 'Filter vacancies by role, salary, location, and type. Visualize job demand across cities on the interactive map.' },
      { title: 'CV Builder — Auto & Manual', body: 'Guided step-by-step mode builds your CV from scratch. Switch to manual for full control at any point.' },
      { title: 'Multiple CV Templates', body: 'Choose from Minimal, Modern, and Compact layouts. Preview instantly, download as PDF.' },
      { title: 'Application Submission Support', body: "Save vacancies, track what you've applied to, and submit through a clean, friction-free flow." },
    ],
  },
  nl: {
    flagCode: 'nl', label: 'NL',
    eyebrow: 'Vacatures · CV builder · Sollicitaties',
    headline1: 'Vind de juiste baan.',
    headline2: 'Sneller.',
    subtext: 'Zoek vacatures, bouw je CV en beheer sollicitaties op één plek.',
    cta: 'Begin gratis',
    ctaShort: 'Begin',
    login: 'Inloggen',
    navProduct: 'Product',
    navFeatures: 'Functies',
    navContact: 'Contact',
    featuresLabel: 'Functies',
    featuresHeading: 'Één plek voor jouw hele zoektocht.',
    ctaH1: 'Begin nu.',
    ctaH2: 'Geen gedoe.',
    ctaSub: 'Je volgende kans wacht al op je.',
    footerRights: 'Alle rechten voorbehouden.',
    privacy: 'Privacy', terms: 'Voorwaarden', contact: 'Contact',
    features: [
      { title: 'Slimme filters & kaart', body: 'Filter vacatures op rol, salaris, locatie en type. Bekijk de vraag naar werk in steden op de interactieve kaart.' },
      { title: 'CV Builder — auto & handmatig', body: 'Stap-voor-stap modus bouwt je CV vanaf nul. Schakel op elk moment over naar handmatige modus.' },
      { title: 'Meerdere CV-templates', body: 'Kies uit Minimaal, Modern en Compact. Direct voorbeeld, download als PDF.' },
      { title: 'Ondersteuning bij sollicitaties', body: 'Sla vacatures op, volg sollicitaties en verstuur via een eenvoudige, overzichtelijke flow.' },
    ],
  },
  ua: {
    flagCode: 'ua', label: 'UA',
    eyebrow: 'Пошук роботи · CV Builder · Заявки',
    headline1: 'Знайди потрібну роботу.',
    headline2: 'Швидше.',
    subtext: 'Шукай вакансії, будуй CV та керуй заявками в одному місці.',
    cta: 'Почати безкоштовно',
    ctaShort: 'Почати',
    login: 'Увійти',
    navProduct: 'Продукт',
    navFeatures: 'Можливості',
    navContact: 'Контакт',
    featuresLabel: 'Можливості',
    featuresHeading: 'Одне місце для всього пошуку роботи.',
    ctaH1: 'Почни зараз.',
    ctaH2: 'Без складнощів.',
    ctaSub: 'Твоя наступна можливість вже чекає.',
    footerRights: 'Усі права захищені.',
    privacy: 'Конфіденційність', terms: 'Умови', contact: 'Контакт',
    features: [
      { title: 'Розумні фільтри та карта', body: 'Фільтруй вакансії за роллю, зарплатою, містом і типом. Дивись попит на роботу на інтерактивній карті.' },
      { title: 'CV Builder — авто та вручну', body: 'Покроковий режим створить CV з нуля. Переключись на ручний режим у будь-який момент.' },
      { title: 'Кілька шаблонів CV', body: 'Вибирай з Мінімального, Сучасного та Компактного. Попередній перегляд і завантаження у PDF.' },
      { title: 'Підтримка подачі заявок', body: 'Зберігай вакансії, відстежуй заявки та надсилай через зручний інтерфейс.' },
    ],
  },
};

// ─── Mock data ────────────────────────────────────────────────

const MOCK_JOBS = [
  { initial: 'B', bg: 'bg-blue-50',  fg: 'text-blue-700', role: 'Backend Developer', company: 'Booking.com', location: 'Amsterdam', salary: '€ 5k–7k/mo', active: true },
  { initial: 'D', bg: 'bg-zinc-100', fg: 'text-zinc-600', role: 'Product Designer',  company: 'Deliveroo',   location: 'London',    salary: '£ 55–70k/yr' },
  { initial: 'S', bg: 'bg-zinc-100', fg: 'text-zinc-600', role: 'Data Analyst',      company: 'ING Bank',    location: 'Brussels',  salary: '€ 3–4.5k/mo' },
];

// ─── Landing ──────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate();
  const [lang, setLang] = useState('en');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('signup');

  const t = T[lang];

  const openModal = (mode = 'signup') => {
    setModalMode(mode);
    setModalOpen(true);
  };

  const handleAuthSuccess = () => {
    setModalOpen(false);
    navigate('/app', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">

        {/* Language switcher bar */}
        <div className="border-b border-border/40 bg-background/60">
          <div className="max-w-5xl mx-auto px-6 h-8 flex items-center justify-end gap-0.5">
            {Object.entries(T).map(([code, val]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                  lang === code
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                <img
                  src={`https://flagcdn.com/w40/${val.flagCode}.png`}
                  srcSet={`https://flagcdn.com/w80/${val.flagCode}.png 2x`}
                  alt={val.label}
                  className="w-5 h-3.5 object-cover rounded-sm"
                />
                <span>{val.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main nav row */}
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-foreground flex items-center justify-center shrink-0">
              <span className="text-background text-[11px] font-black leading-none">J</span>
            </div>
            <span className="font-semibold text-[15px] tracking-tight">JobFinder</span>
          </div>

          {/* Center nav */}
          <nav className="hidden md:flex items-center gap-7">
            <button
              onClick={() => document.getElementById('product')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {t.navProduct}
            </button>
            <button
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {t.navFeatures}
            </button>
            <Link
              to="/contact"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              {t.navContact}
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openModal('login')}
              className="h-8 px-3 text-sm text-muted-foreground hover:text-foreground rounded-xl transition-colors duration-200"
            >
              {t.login}
            </Button>
            <Button
              size="sm"
              onClick={() => openModal('signup')}
              className="h-8 px-4 text-sm bg-foreground text-background hover:bg-foreground/90 rounded-xl transition-all duration-200"
            >
              {t.ctaShort}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section
        id="product"
        className="pt-44 pb-20 px-6 bg-gradient-to-b from-background to-gray-50/70"
      >
        <div className="max-w-5xl mx-auto">

          {/* Eyebrow */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 border border-border rounded-full px-3.5 py-1 text-xs text-muted-foreground font-medium bg-background/80">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              {t.eyebrow}
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-center text-5xl md:text-7xl font-bold tracking-[-0.02em] leading-[1.1] mb-5">
            {t.headline1}
            <br />
            <span className="text-muted-foreground/70">{t.headline2}</span>
          </h1>

          {/* Subtext */}
          <p className="text-center text-[17px] text-muted-foreground max-w-[380px] mx-auto leading-relaxed mb-10">
            {t.subtext}
          </p>

          {/* CTA */}
          <div className="flex justify-center mb-16">
            <Button
              onClick={() => openModal('signup')}
              className="h-auto px-6 py-3 text-sm font-medium bg-foreground text-background hover:bg-foreground/90 rounded-2xl gap-2 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200"
            >
              {t.cta}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Dashboard mock */}
          <DashboardMock />
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 border-t border-border bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {t.featuresLabel}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.02em] leading-tight max-w-sm">
              {t.featuresHeading}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border border border-border rounded-2xl overflow-hidden">
            {t.features.map((f, i) => (
              <FeatureCard key={i} icon={[Search, FileText, LayoutGrid, CheckCircle2][i]} title={f.title} body={f.body} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="py-28 px-6 border-t border-border bg-gradient-to-b from-neutral-900 to-neutral-950">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-end justify-between gap-10">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold tracking-[-0.02em] text-white leading-[1.1]">
              {t.ctaH1}
              <br />
              {t.ctaH2}
            </h2>
            <p className="text-white/40 text-base mt-4 leading-relaxed">
              {t.ctaSub}
            </p>
          </div>
          <Button
            onClick={() => openModal('signup')}
            className="bg-white text-black hover:bg-gray-100 h-auto px-7 py-3 text-sm font-medium rounded-2xl gap-2 shrink-0 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200"
          >
            {t.cta}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-border bg-background">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-5 h-5 rounded bg-foreground/10 flex items-center justify-center">
              <span className="text-foreground/60 text-[9px] font-black leading-none">J</span>
            </div>
            <span>© {new Date().getFullYear()} JobFinder. {t.footerRights}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors duration-200">{t.privacy}</a>
            <a href="#" className="hover:text-foreground transition-colors duration-200">{t.terms}</a>
            <Link to="/contact" className="hover:text-foreground transition-colors duration-200">{t.contact}</Link>
          </div>
        </div>
      </footer>

      {/* ── Auth modal ─────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-[400px] bg-background rounded-2xl border border-border shadow-2xl">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-200 z-10"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="p-7 pt-9">
              <LoginForm initialMode={modalMode} onClose={handleAuthSuccess} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard mock ───────────────────────────────────────────

function DashboardMock() {
  return (
    <div className="max-w-4xl mx-auto rounded-2xl border border-gray-100 shadow-[0_20px_80px_-20px_rgba(0,0,0,0.15)] overflow-hidden select-none pointer-events-none">

      {/* Browser chrome */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2.5 h-2.5 rounded-full bg-gray-200" />
          ))}
        </div>
        <div className="flex-1 max-w-[180px] mx-auto h-5 bg-white border border-gray-100 rounded-md flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground">jobfinder.app</span>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="grid grid-cols-5 divide-x divide-gray-100 bg-background">

        {/* ── Left: Vacancy list ── */}
        <div className="col-span-3 flex flex-col">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold">Vacancies</span>
            <div className="flex items-center gap-1">
              <div className="h-6 px-2 flex items-center gap-1 border border-gray-100 rounded-lg text-[10px] text-muted-foreground bg-gray-50">
                <Search className="w-2.5 h-2.5 shrink-0" />
                <span>Search...</span>
              </div>
              <div className="h-6 w-6 flex items-center justify-center border border-gray-100 rounded-lg text-muted-foreground bg-gray-50">
                <SlidersHorizontal className="w-2.5 h-2.5" />
              </div>
            </div>
          </div>

          <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-1.5 overflow-hidden">
            {['All', 'Netherlands', 'Belgium', 'Full-time'].map((tag, i) => (
              <span
                key={tag}
                className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  i === 0 ? 'bg-foreground text-background' : 'text-muted-foreground border border-gray-100'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="flex-1 px-3 py-3 space-y-1">
            {MOCK_JOBS.map((job, i) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border ${
                  job.active ? 'border-blue-100 bg-blue-50/60' : 'border-transparent'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${job.bg} ${job.fg}`}>
                  {job.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold leading-tight truncate">{job.role}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                    {job.company}
                    <span className="mx-0.5">·</span>
                    <MapPin className="w-2 h-2 shrink-0" />
                    {job.location}
                  </p>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground shrink-0">{job.salary}</span>
              </div>
            ))}
          </div>

          <div className="px-4 py-2 border-t border-gray-100">
            <span className="text-[10px] text-muted-foreground">128 vacancies · NL & BE</span>
          </div>
        </div>

        {/* ── Right: CV preview ── */}
        <div className="col-span-2 flex flex-col">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[13px] font-semibold">Your CV</span>
            <span className="text-[10px] text-blue-600 font-medium">Edit →</span>
          </div>

          <div className="flex-1 p-4 space-y-3">
            <div className="pb-2.5 border-b border-gray-100">
              <p className="text-[13px] font-bold tracking-tight">Alex Johnson</p>
              <p className="text-[11px] text-blue-600 font-medium mt-0.5">Backend Developer</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Amsterdam · alex@example.com</p>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Skills</p>
              <div className="flex flex-wrap gap-1">
                {['React', 'Node.js', 'PostgreSQL', 'TypeScript'].map(s => (
                  <span key={s} className="text-[9px] bg-gray-100 text-zinc-600 px-1.5 py-0.5 rounded-md">{s}</span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Experience</p>
              <div className="space-y-1.5">
                <div>
                  <p className="text-[10px] font-semibold leading-tight">
                    Senior Dev <span className="font-normal text-muted-foreground">at Booking.com</span>
                  </p>
                  <p className="text-[9px] text-muted-foreground">2022 – present</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold leading-tight">
                    Developer <span className="font-normal text-muted-foreground">at TechStartup</span>
                  </p>
                  <p className="text-[9px] text-muted-foreground">2020 – 2022</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-1.5">
            {['Minimal', 'Modern', 'Compact'].map((t, i) => (
              <span
                key={t}
                className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                  i === 0 ? 'bg-blue-600 text-white' : 'text-muted-foreground border border-gray-100'
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────

function FeatureCard({ icon: Icon, title, body }) {
  return (
    <div className="bg-background p-7 space-y-4 hover:bg-gray-50/80 transition-colors duration-200">
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
        <Icon className="w-4 h-4 text-foreground" />
      </div>
      <div>
        <h3 className="font-semibold text-base tracking-tight mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
