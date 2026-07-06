import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ContactPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    // Simulate send — replace with real endpoint when ready
    await new Promise(r => setTimeout(r, 900));
    setSending(false);
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity duration-200">
            <div className="w-6 h-6 rounded-md bg-foreground flex items-center justify-center shrink-0">
              <span className="text-background text-[11px] font-black leading-none">J</span>
            </div>
            <span className="font-semibold text-[15px] tracking-tight">JobFinder</span>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to home
          </Link>
        </div>
      </header>

      {/* ── Contact form ───────────────────────────────────── */}
      <main className="pt-36 pb-24 px-6">
        <div className="max-w-lg mx-auto">

          {/* Heading */}
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Contact
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-[-0.02em] leading-[1.1] mb-4">
              Get in touch.
            </h1>
            <p className="text-[16px] text-muted-foreground leading-relaxed">
              Have a question or feedback? Drop us a message and we'll get back to you shortly.
            </p>
          </div>

          {sent ? (
            /* ── Success state ── */
            <div className="rounded-2xl border border-border bg-gray-50/60 p-10 flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-background" />
              </div>
              <div>
                <p className="font-semibold text-base mb-1">Message sent</p>
                <p className="text-sm text-muted-foreground">We'll reply to <span className="font-medium text-foreground">{email}</span> as soon as possible.</p>
              </div>
              <Button
                variant="outline"
                className="mt-2 rounded-xl"
                onClick={() => { setSent(false); setEmail(''); setMessage(''); }}
              >
                Send another
              </Button>
            </div>
          ) : (
            /* ── Form ── */
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="contact-email" className="text-sm font-medium">
                  Your email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow duration-200"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label htmlFor="contact-message" className="text-sm font-medium">
                  Message
                </label>
                <textarea
                  id="contact-message"
                  placeholder="What's on your mind?"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none transition-shadow duration-200"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={sending}
                className="w-full h-11 rounded-2xl bg-foreground text-background hover:bg-foreground/90 text-sm font-medium gap-2 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 disabled:opacity-60 disabled:scale-100"
              >
                {sending ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? 'Sending…' : 'Send message'}
              </Button>
            </form>
          )}

        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-center">
          <span className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} JobFinder. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
