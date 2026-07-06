import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

// Static FAQ — grouped Q&A. ApplicationHub's "How tracking works" modal links
// here (/app/faq). Each section has an id so deep links like #tracking work.
const SECTIONS = [
  {
    id: 'applicationhub',
    title: 'ApplicationHub',
    items: [
      {
        q: 'What is ApplicationHub?',
        a: 'ApplicationHub is where every job you marked "Interested" or "Gesolliciteerd" (Applied) lands. From there you can track each application through its stages, write and send application emails, and keep notes — all in one place.',
      },
      {
        q: 'How does a vacancy get into ApplicationHub?',
        a: 'On any job card (the main list or the swipe cards), click "Save" / "Interested" or "Mark as applied". That vacancy immediately appears in ApplicationHub. Companies you have blocked are never shown here.',
      },
      {
        q: 'What do the application statuses mean?',
        a: 'Saved → you are considering it. Applied → you sent your application. Interview → you are in the interview process. Offer → you received an offer. Rejected → the application did not move forward. You can move an application between statuses at any time.',
      },
    ],
  },
  {
    id: 'gmail',
    title: 'Connecting Gmail',
    items: [
      {
        q: 'Why connect Gmail?',
        a: 'Connecting Gmail lets you send application emails directly from ApplicationHub, sent through your own Gmail account so they look exactly like a normal email from you.',
      },
      {
        q: 'Is my Gmail password shared with JobFinder?',
        a: 'No. Connection uses Google OAuth — you log in on Google\'s own page and approve specific permissions. JobFinder never sees your password. The access tokens we store are encrypted (AES-256-GCM).',
      },
      {
        q: 'Can I connect more than one Gmail account?',
        a: 'Yes. You can connect several accounts and pick which one sends each email. One is marked as your default.',
      },
      {
        q: 'How do I disconnect?',
        a: 'Remove the account from the "Send from" area in ApplicationHub. You can also revoke access anytime at myaccount.google.com → Security → Third-party access.',
      },
      {
        q: 'Why did my email land in the spam folder?',
        a: 'Emails are sent through your real Gmail account with proper formatting, which is the best case for deliverability. Still, two things can cause spam: (1) emailing yourself — Gmail often self-flags that, so test by sending to a different person; (2) first-ever contact between two addresses — mark it "Not spam" once and Gmail learns.',
      },
    ],
  },
  {
    id: 'tracking',
    title: 'Tracking modes & privacy',
    items: [
      {
        q: 'What are the tracking modes?',
        a: 'When you connect Gmail you choose how much access to grant. Manual: send only, no inbox reading. Lightweight tracking: reads only the threads you sent from ApplicationHub (headers only — who replied and when, never the content) to detect replies. Full tracking: also reads the reply text and uses AI to categorise it (interview / rejection / offer) so the status is set precisely.',
      },
      {
        q: 'Does Lightweight mode scan my whole inbox?',
        a: 'No. It only ever looks at the specific email threads you sent from ApplicationHub, identified by the thread IDs we stored when you sent them. Nothing else in your mailbox is accessed, and it reads headers only — not message bodies.',
      },
      {
        q: 'What happens when someone replies?',
        a: 'In Lightweight mode, when a reply appears in a tracked thread the application is automatically moved to "Interview" and you get a notification — if it was actually a rejection, just correct the status by hand. In Full mode the AI reads the reply and sets the status precisely on its own: an interview invite moves it to "Interview", a rejection to "Rejected", an offer to "Offer".',
      },
      {
        q: 'Can I change my tracking mode later?',
        a: 'Yes. Reconnect the Gmail account and pick a different mode — Google will ask you to approve the new permission level.',
      },
    ],
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <span className="text-sm font-medium text-foreground">{q}</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 -mt-1">
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-1">
        <HelpCircle className="h-6 w-6 text-foreground" />
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Frequently asked questions</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        How ApplicationHub, Gmail integration and reply tracking work.
      </p>

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {section.title}
            </h2>
            <div className="space-y-2">
              {section.items.map((item) => (
                <FAQItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
