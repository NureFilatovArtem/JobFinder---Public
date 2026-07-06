import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { applicationsAPI } from '@/api/applications';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ChevronDown, MapPin, Calendar, Mail, Copy, Send, Sparkles,
  RotateCcw, FileText, Briefcase, CheckCircle2, XCircle,
  Clock, TrendingUp, Inbox, Loader2, Shield, HelpCircle
} from 'lucide-react';

// ─── Analytics Dashboard ────────────────────────────────────────────────────

function AnalyticsDashboard({ analytics, t }) {
  if (!analytics) return null;

  const stats = [
    { label: t('applicationsHub.analytics.total'), value: analytics.total, icon: Inbox },
    { label: t('applicationsHub.analytics.applied'), value: analytics.applied, icon: Send },
    { label: t('applicationsHub.analytics.inProgress'), value: analytics.interviewing, icon: Clock },
    { label: t('applicationsHub.analytics.offers'), value: analytics.offered, icon: CheckCircle2 },
    { label: t('applicationsHub.analytics.responseRate'), value: `${analytics.response_rate}%`, icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Status Pipeline ─────────────────────────────────────────────────────────

const PIPELINE_STEPS = ['saved', 'applied', 'interviewing', 'offered'];

function StatusPipeline({ currentStatus, onStatusChange, t }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PIPELINE_STEPS.map((step) => {
          const isActive = currentStatus === step || (!currentStatus && step === 'saved');
          return (
            <button
              key={step}
              onClick={() => onStatusChange(step)}
              className={`px-3 py-1 text-xs rounded-full font-medium border transition-all ${
                isActive
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground'
              }`}
            >
              {t(`applicationsHub.status.${step}`)}
            </button>
          );
        })}
      </div>
      {currentStatus !== 'rejected' && (
        <button
          onClick={() => onStatusChange('rejected')}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
        >
          {t('applicationsHub.card.markRejected')}
        </button>
      )}
      {currentStatus === 'rejected' && (
        <Badge variant="destructive" className="text-xs">
          {t('applicationsHub.status.rejected')}
        </Badge>
      )}
    </div>
  );
}

// ─── Hub Status Badge ─────────────────────────────────────────────────────────

function HubStatusBadge({ status, t }) {
  const statusConfig = {
    saved: 'bg-muted text-muted-foreground',
    applied: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    interviewing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    offered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };
  const key = status || 'saved';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusConfig[key] || statusConfig.saved}`}>
      {t(`applicationsHub.status.${key}`)}
    </span>
  );
}

// ─── Job Details ──────────────────────────────────────────────────────────────

function JobDetails({ app, t }) {
  const [open, setOpen] = useState(false);
  const skills = Array.isArray(app.required_skills) ? app.required_skills : [];
  const hasContent = app.description || skills.length > 0 || app.contract_type || app.job_type;
  if (!hasContent) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-muted/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />
          {t('applicationsHub.card.jobDetails')}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-3 pb-3 space-y-3">
              {(app.contract_type || app.job_type) && (
                <div className="flex flex-wrap gap-1.5">
                  {app.contract_type && (
                    <Badge variant="secondary" className="text-xs">{app.contract_type}</Badge>
                  )}
                  {app.job_type && (
                    <Badge variant="secondary" className="text-xs">{app.job_type}</Badge>
                  )}
                </div>
              )}
              {skills.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t('applicationsHub.card.requiredSkills')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {skills.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {app.description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t('applicationsHub.card.description')}
                  </p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed pr-1">
                    {app.description}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Gmail tracking modes ─────────────────────────────────────────────────────

const TRACKING_OPTIONS = [
  {
    mode: 'manual',
    label: 'Manual',
    desc: 'Send emails only — no inbox access. You update application statuses yourself.',
  },
  {
    mode: 'lightweight',
    label: 'Lightweight tracking',
    desc: 'Reads only the threads you send from here (headers only, no content) to detect replies and advance status automatically.',
  },
  {
    mode: 'full',
    label: 'Full tracking',
    desc: 'AI reads reply contents and categorises them (interview / rejection / offer), setting the status precisely. Grants full Gmail read access.',
  },
];

function trackingModeLabel(mode) {
  if (mode === 'lightweight') return 'Lightweight tracking';
  if (mode === 'full') return 'Full tracking';
  return 'Manual (no tracking)';
}

// Lets the user pick a tracking mode before starting the Google OAuth flow.
function GmailConnectControl({ label, onConnect }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('lightweight');

  if (!open) {
    return (
      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setOpen(true)}>
        <Mail className="h-3 w-3" />
        {label}
      </Button>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 w-full">
      <p className="text-xs font-semibold text-foreground">Choose how much access to grant</p>
      {TRACKING_OPTIONS.map((opt) => (
        <label
          key={opt.mode}
          className={`flex gap-2 items-start p-2 rounded border text-xs transition-colors ${
            opt.disabled
              ? 'opacity-50 cursor-not-allowed border-border'
              : mode === opt.mode
              ? 'border-foreground bg-background cursor-pointer'
              : 'border-border hover:border-foreground cursor-pointer'
          }`}
        >
          <input
            type="radio"
            name="trackingMode"
            disabled={opt.disabled}
            checked={mode === opt.mode}
            onChange={() => !opt.disabled && setMode(opt.mode)}
            className="mt-0.5 accent-current"
          />
          <span>
            <span className="font-medium text-foreground">{opt.label}</span>
            <span className="block text-muted-foreground leading-snug">{opt.desc}</span>
          </span>
        </label>
      ))}
      <div className="flex gap-2 pt-0.5">
        <Button
          size="sm"
          className="h-7 text-xs flex-1 gap-1"
          onClick={() => { onConnect(mode); setOpen(false); }}
        >
          <Mail className="h-3 w-3" />
          Connect with Google
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Tracking Modes Explainer Modal ───────────────────────────────────────────

const MODE_DETAILS = [
  {
    icon: FileText,
    title: 'Mode 1 — Manual',
    badge: null,
    points: [
      'ApplicationHub sends emails only. It never reads your inbox.',
      'You move each application through its statuses yourself.',
      'Minimal permissions — best if you prefer full control.',
    ],
  },
  {
    icon: Shield,
    title: 'Mode 2 — Lightweight tracking',
    badge: 'Recommended',
    points: [
      'Reads only the threads you sent from ApplicationHub — identified by stored thread IDs.',
      'Headers only (who replied and when) — never the message content.',
      'When a reply lands in a tracked thread, the application moves to "Interview" automatically and you are notified.',
      'Your wider inbox is never scanned.',
    ],
  },
  {
    icon: Sparkles,
    title: 'Mode 3 — Full tracking',
    badge: null,
    points: [
      'Everything Lightweight does, plus AI reads the reply text and categorises it (interview / rejection / offer).',
      'The application status is set precisely from the category — e.g. a rejection email moves it straight to "Rejected".',
      'Requires full Gmail read access; reply text is sent to the AI for classification.',
    ],
  },
];

function TrackingModesModal({ open, onClose }) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <h2 className="text-lg font-bold text-foreground">Gmail tracking modes</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          When you connect Gmail you choose how much access ApplicationHub gets.
          You can change it later by reconnecting the account.
        </p>

        <div className="space-y-3">
          {MODE_DETAILS.map((mode) => {
            const Icon = mode.icon;
            return (
              <div key={mode.title} className="rounded-lg border border-border p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className="h-4 w-4 text-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">{mode.title}</h3>
                  {mode.badge && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {mode.badge}
                    </span>
                  )}
                </div>
                <ul className="space-y-1">
                  {mode.points.map((p, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5 leading-relaxed">
                      <span className="text-foreground">·</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-3">
          <Link
            to="/app/faq#tracking"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Read the full FAQ
          </Link>
          <Button size="sm" className="h-8 text-xs" onClick={onClose}>
            Got it
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Email Composer ───────────────────────────────────────────────────────────

function EmailComposer({ vacancyId, gmailStatus, onShowModes, t }) {
  const [language, setLanguage] = useState('en');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [generating, setGenerating] = useState(null); // email_type string while loading
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [rewritePrompt, setRewritePrompt] = useState('');
  const [rewriting, setRewriting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [emails, setEmails] = useState([]);
  const [savedEmailId, setSavedEmailId] = useState(null);
  const [emailsLoaded, setEmailsLoaded] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  const accounts = gmailStatus?.accounts || [];
  const hasAccounts = accounts.length > 0;
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  // Load email history
  useEffect(() => {
    applicationsAPI.getEmails(vacancyId).then((data) => {
      setEmails(data || []);
      setEmailsLoaded(true);
    }).catch(() => {
      setEmailsLoaded(true);
    });
  }, [vacancyId]);

  // Pick the sending account: keep the current choice if still valid, else default.
  useEffect(() => {
    if (!hasAccounts) {
      setSelectedAccountId(null);
      return;
    }
    setSelectedAccountId((prev) => {
      if (prev && accounts.some((a) => a.id === prev)) return prev;
      const def = accounts.find((a) => a.is_default) || accounts[0];
      return def.id;
    });
  }, [accounts, hasAccounts]);

  const handleGenerate = useCallback(async (emailType) => {
    setGenerating(emailType);
    try {
      const result = await applicationsAPI.generateEmail(vacancyId, {
        email_type: emailType,
        language,
        custom_context: customContext.trim() || undefined,
      });
      setSubject(result.subject || '');
      setBody(result.body || '');
      setSavedEmailId(null); // reset draft association
    } catch (err) {
      toast.error('Failed to generate email. Please try again.');
    } finally {
      setGenerating(null);
    }
  }, [vacancyId, language, customContext]);

  const handleRewrite = useCallback(async () => {
    if (!rewritePrompt.trim()) return;
    setRewriting(true);
    try {
      const result = await applicationsAPI.generateEmail(vacancyId, {
        email_type: 'motivation',
        language,
        rewrite_prompt: rewritePrompt,
        current_body: body,
        custom_context: customContext.trim() || undefined,
      });
      setBody(result.body || body);
      if (result.subject) setSubject(result.subject);
      setRewritePrompt('');
      setRewriteOpen(false);
      setSavedEmailId(null);
    } catch (err) {
      toast.error('Failed to rewrite email.');
    } finally {
      setRewriting(false);
    }
  }, [vacancyId, language, body, rewritePrompt, customContext]);

  const handleCopy = useCallback(() => {
    const text = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  }, [subject, body]);

  const handleSaveDraft = useCallback(async () => {
    setSaving(true);
    try {
      if (savedEmailId) {
        const updated = await applicationsAPI.updateEmail(vacancyId, savedEmailId, {
          recipient, subject, body,
        });
        setEmails(prev => prev.map(e => e.id === savedEmailId ? updated : e));
        toast.success('Draft updated');
      } else {
        const saved = await applicationsAPI.saveEmail(vacancyId, {
          email_type: 'custom',
          recipient,
          subject,
          body,
          language,
        });
        setEmails(prev => [saved, ...prev]);
        setSavedEmailId(saved.id);
        toast.success('Draft saved');
      }
    } catch (err) {
      toast.error('Failed to save draft');
    } finally {
      setSaving(false);
    }
  }, [vacancyId, savedEmailId, recipient, subject, body, language]);

  const handleConnectAccount = useCallback(async (mode = 'manual') => {
    try {
      const { auth_url } = await applicationsAPI.getGmailConnectUrl(mode);
      window.open(auth_url, '_blank');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to get Gmail connect URL');
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!hasAccounts) {
      toast.error('Connect a Gmail account first');
      return;
    }
    if (!selectedAccountId) {
      toast.error('Select an account to send from');
      return;
    }
    setSending(true);
    try {
      // A draft must exist before it can be sent — auto-save if needed.
      let emailId = savedEmailId;
      if (!emailId) {
        const saved = await applicationsAPI.saveEmail(vacancyId, {
          email_type: 'custom',
          recipient,
          subject,
          body,
          language,
        });
        setEmails(prev => [saved, ...prev]);
        setSavedEmailId(saved.id);
        emailId = saved.id;
      }
      const result = await applicationsAPI.sendEmail(vacancyId, emailId, selectedAccountId);
      if (result.success) {
        toast.success('Email sent via Gmail');
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_sent: true } : e));
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to send email');
    } finally {
      setSending(false);
    }
  }, [hasAccounts, selectedAccountId, savedEmailId, vacancyId, recipient, subject, body, language]);

  const generateButtons = [
    { type: 'motivation', label: t('applicationsHub.card.generate.motivation') },
    { type: 'intro', label: t('applicationsHub.card.generate.intro') },
    { type: 'follow_up', label: t('applicationsHub.card.generate.followUp') },
    { type: 'thank_you', label: t('applicationsHub.card.generate.thankYou') },
  ];

  return (
    <div className="space-y-3">
      {/* Header + language */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5" />
          {t('applicationsHub.card.emailComposer')}
        </h4>
        <div className="flex border border-border rounded overflow-hidden">
          {['en', 'nl'].map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-2 py-0.5 text-xs font-medium transition-colors ${
                language === lang
                  ? 'bg-foreground text-background'
                  : 'bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Custom context for AI generation */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">
          {t('applicationsHub.card.customContextLabel')}
        </label>
        <Textarea
          value={customContext}
          onChange={(e) => setCustomContext(e.target.value)}
          placeholder={t('applicationsHub.card.customContextPlaceholder')}
          className="min-h-[56px] text-xs resize-y"
        />
      </div>

      {/* Quick generate buttons */}
      <div className="flex flex-wrap gap-1.5">
        {generateButtons.map(({ type, label }) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2.5 gap-1"
            disabled={generating !== null}
            onClick={() => handleGenerate(type)}
          >
            {generating === type ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {generating === type ? t('applicationsHub.card.generating') : label}
          </Button>
        ))}
      </div>

      {/* Compose form */}
      <div className="space-y-2">
        <Input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder={t('applicationsHub.card.recipient') + ' (recipient@company.com)'}
          className="h-8 text-xs"
        />
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('applicationsHub.card.subject')}
          className="h-8 text-xs"
        />
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('applicationsHub.card.body')}
          className="min-h-[180px] text-xs resize-y font-mono leading-relaxed"
        />
      </div>

      {/* AI Rewrite (only when body not empty) */}
      {body && (
        <div>
          {!rewriteOpen ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setRewriteOpen(true)}
            >
              <RotateCcw className="h-3 w-3" />
              {t('applicationsHub.card.rewriteWithAI')}
            </Button>
          ) : (
            <div className="flex gap-2 items-center">
              <Input
                value={rewritePrompt}
                onChange={(e) => setRewritePrompt(e.target.value)}
                placeholder={t('applicationsHub.card.rewritePlaceholder')}
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleRewrite()}
                autoFocus
              />
              <Button
                size="sm"
                className="h-7 text-xs px-2.5"
                disabled={rewriting || !rewritePrompt.trim()}
                onClick={handleRewrite}
              >
                {rewriting ? <Loader2 className="h-3 w-3 animate-spin" /> : t('applicationsHub.card.applyRewrite')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => { setRewriteOpen(false); setRewritePrompt(''); }}
              >
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Sending account */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t('applicationsHub.card.sendFrom')}
          </label>
          <button
            type="button"
            onClick={onShowModes}
            className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            How tracking works
          </button>
        </div>
        {hasAccounts ? (
          <div className="space-y-1.5">
            <select
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              className="h-8 text-xs rounded-md border border-border bg-background px-2 w-full text-foreground"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}{a.is_default ? ` (${t('applicationsHub.card.defaultAccount')})` : ''}
                </option>
              ))}
            </select>
            {selectedAccount && (
              <p className="text-[11px] text-muted-foreground">
                Mode:{' '}
                <span className="font-medium text-foreground">
                  {trackingModeLabel(selectedAccount.tracking_mode)}
                </span>
              </p>
            )}
            <GmailConnectControl label="Add another account" onConnect={handleConnectAccount} />
          </div>
        ) : (
          <GmailConnectControl label="Connect Gmail" onConnect={handleConnectAccount} />
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleCopy}
          disabled={!body}
        >
          <Copy className="h-3 w-3" />
          {t('applicationsHub.card.copyEmail')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleSaveDraft}
          disabled={saving || !body}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
          {t('applicationsHub.card.saveDraft')}
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleSend}
          disabled={sending || !hasAccounts || !body || !recipient}
        >
          {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          {t('applicationsHub.card.sendViaGmail')}
        </Button>
      </div>

      {/* Email history */}
      {emailsLoaded && emails.length > 0 && (
        <div className="pt-1">
          <Separator className="mb-2" />
          <p className="text-xs text-muted-foreground mb-1.5 font-medium">{t('applicationsHub.card.emailHistory')}</p>
          <div className="flex flex-wrap gap-1.5">
            {emails.map((em) => (
              <button
                key={em.id}
                onClick={() => {
                  setRecipient(em.recipient || '');
                  setSubject(em.subject || '');
                  setBody(em.body || '');
                  setSavedEmailId(em.id);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              >
                {em.is_sent && <CheckCircle2 className="h-2.5 w-2.5 text-green-600" />}
                {em.subject ? em.subject.substring(0, 25) + (em.subject.length > 25 ? '...' : '') : '(no subject)'}
                {em.reply_count > 0 && (
                  <span className="text-green-600 font-medium" title={`${em.reply_count} reply(ies)`}>
                    · {em.reply_count} ↩
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Application Card ─────────────────────────────────────────────────────────

function ApplicationCard({ app, isExpanded, onToggle, gmailStatus, onShowModes, t }) {
  const [hubStatus, setHubStatus] = useState(app.hub_status || null);
  const [notes, setNotes] = useState(app.notes || '');
  const notesRef = useRef(null);

  const vacancyId = app.vacancy_id;
  const title = app.title || 'Untitled position';
  const company = app.company_name || 'Unknown company';
  const location = app.location;
  const savedDate = app.created_at ? new Date(app.created_at).toLocaleDateString() : null;

  const handleStatusChange = useCallback(async (newStatus) => {
    setHubStatus(newStatus);
    try {
      await applicationsAPI.update(vacancyId, { hub_status: newStatus });
    } catch {
      toast.error('Failed to update status');
    }
  }, [vacancyId]);

  const handleNotesSave = useCallback(async () => {
    try {
      await applicationsAPI.update(vacancyId, { notes });
    } catch {
      toast.error('Failed to save notes');
    }
  }, [vacancyId, notes]);

  const companyInitial = company.charAt(0).toUpperCase();

  return (
    <Card className="border border-border bg-card overflow-hidden">
      {/* Header row - always visible */}
      <button
        className="w-full text-left"
        onClick={onToggle}
      >
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center gap-3">
            {/* Company initial avatar */}
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-sm font-bold text-muted-foreground">
              {companyInitial}
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground">{company}</span>
                <span className="text-sm text-muted-foreground truncate">{title}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                {location && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" />
                    {location}
                  </span>
                )}
                {savedDate && (
                  <span className="flex items-center gap-0.5">
                    <Calendar className="h-3 w-3" />
                    {t('applicationsHub.card.savedOn')} {savedDate}
                  </span>
                )}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {app.reply_count > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  title={app.last_reply_at ? `Last reply ${new Date(app.last_reply_at).toLocaleDateString()}` : 'Reply received'}
                >
                  <Mail className="h-3 w-3" />
                  Reply
                </span>
              )}
              <HubStatusBadge status={hubStatus} t={t} />
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              />
            </div>
          </div>
        </CardHeader>
      </button>

      {/* Expanded section */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <CardContent className="px-4 pb-4 pt-0">
              <Separator className="mb-4" />

              {/* Job listing details */}
              <JobDetails app={app} t={t} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column: status + notes */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">{t('applicationsHub.card.statusLabel')}</p>
                    <StatusPipeline
                      currentStatus={hubStatus}
                      onStatusChange={handleStatusChange}
                      t={t}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">
                      {t('applicationsHub.card.notes')}
                    </p>
                    <Textarea
                      ref={notesRef}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      onBlur={handleNotesSave}
                      placeholder={t('applicationsHub.card.notesPlaceholder')}
                      className="min-h-[100px] text-xs resize-y"
                    />
                  </div>
                  {app.source_url && (
                    <a
                      href={app.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    >
                      <Briefcase className="h-3 w-3" />
                      {t('applicationsHub.card.viewVacancy')}
                    </a>
                  )}
                </div>

                {/* Right column: email composer */}
                <div>
                  <EmailComposer
                    vacancyId={vacancyId}
                    gmailStatus={gmailStatus}
                    onShowModes={onShowModes}
                    t={t}
                  />
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

const FILTER_KEYS = ['all', 'saved', 'applied', 'interviewing', 'offered', 'rejected'];

function FilterTabs({ activeFilter, onChange, counts, t }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {FILTER_KEYS.map((key) => {
        const isActive = activeFilter === key;
        const count = key === 'all' ? counts.all : (counts[key] || 0);
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`px-3 py-1 text-xs rounded-full font-medium border transition-all ${
              isActive
                ? 'bg-foreground text-background border-foreground'
                : 'bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground'
            }`}
          >
            {t(`applicationsHub.filters.${key}`)}
            {count > 0 && (
              <span className={`ml-1.5 text-[10px] ${isActive ? 'opacity-70' : 'opacity-60'}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ t }) {
  return (
    <div className="text-center py-16">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{t('applicationsHub.empty')}</h3>
      <p className="text-sm text-muted-foreground">{t('applicationsHub.emptyHint')}</p>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <Card className="border border-border bg-card">
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 bg-muted animate-pulse rounded w-2/5" />
            <div className="h-3 bg-muted animate-pulse rounded w-3/5" />
          </div>
          <div className="h-5 w-16 bg-muted animate-pulse rounded" />
        </div>
      </CardHeader>
    </Card>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function ApplicationsHub() {
  const { t } = useTranslation();
  const [applications, setApplications] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [gmailStatus, setGmailStatus] = useState({ connected: false, accounts: [] });
  const [modesModalOpen, setModesModalOpen] = useState(false);

  const refreshGmailStatus = useCallback(async () => {
    try {
      const status = await applicationsAPI.getGmailStatus();
      setGmailStatus(status);
    } catch {
      setGmailStatus({ connected: false, accounts: [] });
    }
  }, []);

  // Handle gmail=connected / gmail=error query param on return from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailParam = params.get('gmail');
    if (gmailParam === 'connected') {
      toast.success('Gmail connected successfully!');
      refreshGmailStatus();
    } else if (gmailParam === 'error') {
      const reason = params.get('reason');
      const messages = {
        access_denied: 'Gmail connection cancelled.',
        missing_code: 'Gmail connection failed — no authorization code returned.',
        server_misconfigured: 'Gmail is not configured on the server. Contact the administrator.',
        no_email: 'Could not read your Gmail address from Google. Please try again.',
      };
      toast.error(messages[reason] || `Gmail connection failed${reason ? `: ${reason}` : ''}.`);
    }
    if (gmailParam) {
      // Clean up URL so a refresh doesn't re-trigger the toast
      const url = new URL(window.location.href);
      url.searchParams.delete('gmail');
      url.searchParams.delete('reason');
      window.history.replaceState({}, '', url.toString());
    }
  }, [refreshGmailStatus]);

  // Refresh Gmail status when the tab regains focus (OAuth completes in a popup).
  useEffect(() => {
    const onFocus = () => refreshGmailStatus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshGmailStatus]);

  // Load data on mount — each request is independent so one failure
  // (e.g. Gmail or analytics) doesn't blank the whole page.
  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const [appsRes, analyticsRes, gmailRes] = await Promise.allSettled([
      applicationsAPI.getAll(),
      applicationsAPI.getAnalytics(),
      applicationsAPI.getGmailStatus(),
    ]);

    if (appsRes.status === 'fulfilled') {
      setApplications(appsRes.value || []);
    } else {
      setLoadError(true);
      toast.error('Failed to load applications');
    }
    if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value);
    setGmailStatus(
      gmailRes.status === 'fulfilled' ? gmailRes.value : { connected: false, accounts: [] }
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mode 2 (lightweight tracking): once on mount, scan tracked threads for new
  // replies. Backend no-ops for accounts in manual mode. If anything changed,
  // notify the user and reload so updated statuses + reply badges show.
  useEffect(() => {
    let cancelled = false;
    applicationsAPI
      .checkReplies()
      .then((res) => {
        if (cancelled || !res || res.new_replies <= 0) return;
        toast.success(
          `📩 ${res.new_replies} new ${res.new_replies === 1 ? 'reply' : 'replies'} detected`
        );
        loadData();
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [loadData]);

  // Filter applications
  const filteredApps = applications.filter((app) => {
    if (filter === 'all') return true;
    const status = app.hub_status || 'saved';
    return status === filter;
  });

  // Count per filter
  const counts = {
    all: applications.length,
    saved: applications.filter(a => !a.hub_status || a.hub_status === 'saved').length,
    applied: applications.filter(a => a.hub_status === 'applied').length,
    interviewing: applications.filter(a => a.hub_status === 'interviewing').length,
    offered: applications.filter(a => a.hub_status === 'offered').length,
    rejected: applications.filter(a => a.hub_status === 'rejected').length,
  };

  const handleToggleExpand = useCallback((vacancyId) => {
    setExpandedId(prev => prev === vacancyId ? null : vacancyId);
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('applicationsHub.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('applicationsHub.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 pt-1">
          <button
            onClick={() => setModesModalOpen(true)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <Shield className="h-3.5 w-3.5" />
            Tracking modes
          </button>
          <Link
            to="/app/faq#applicationhub"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            FAQ
          </Link>
        </div>
      </div>

      {/* Analytics dashboard */}
      <AnalyticsDashboard analytics={analytics} t={t} />

      {/* Filter tabs */}
      <FilterTabs
        activeFilter={filter}
        onChange={setFilter}
        counts={counts}
        t={t}
      />

      {/* Applications list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : loadError ? (
        <div className="text-center py-16">
          <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-sm font-medium text-foreground mb-1">
            {t('applicationsHub.loadError') || 'Could not load your applications'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('applicationsHub.loadErrorHint') || 'Something went wrong. Please try again.'}
          </p>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-1">
            <RotateCcw className="h-3.5 w-3.5" />
            {t('common.retry') || 'Retry'}
          </Button>
        </div>
      ) : filteredApps.length === 0 ? (
        <EmptyState t={t} />
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {filteredApps.map((app) => (
              <motion.div
                key={app.vacancy_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <ApplicationCard
                  app={app}
                  isExpanded={expandedId === app.vacancy_id}
                  onToggle={() => handleToggleExpand(app.vacancy_id)}
                  gmailStatus={gmailStatus}
                  onShowModes={() => setModesModalOpen(true)}
                  t={t}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <TrackingModesModal open={modesModalOpen} onClose={() => setModesModalOpen(false)} />
    </div>
  );
}
