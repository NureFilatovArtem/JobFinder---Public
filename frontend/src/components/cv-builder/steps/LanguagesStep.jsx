import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { X, Globe, Search } from "lucide-react";

const LANGUAGE_OPTIONS = [
  "Afrikaans","Albanian","Amharic","Arabic","Armenian","Azerbaijani",
  "Basque","Belarusian","Bengali","Bosnian","Bulgarian","Burmese",
  "Catalan","Chinese (Simplified)","Chinese (Traditional)","Croatian",
  "Czech","Danish","Dutch","English","Estonian","Filipino","Finnish",
  "French","Galician","Georgian","German","Greek","Gujarati",
  "Haitian Creole","Hausa","Hebrew","Hindi","Hungarian","Icelandic",
  "Igbo","Indonesian","Irish","Italian","Japanese","Javanese",
  "Kannada","Kazakh","Khmer","Korean","Kurdish","Kyrgyz","Lao",
  "Latvian","Lithuanian","Macedonian","Malagasy","Malay","Malayalam",
  "Maltese","Marathi","Mongolian","Nepali","Norwegian","Odia",
  "Pashto","Persian","Polish","Portuguese","Punjabi","Romanian",
  "Russian","Serbian","Sinhala","Slovak","Slovenian","Somali",
  "Spanish","Swahili","Swedish","Tagalog","Tajik","Tamil","Telugu",
  "Thai","Tibetan","Turkish","Turkmen","Ukrainian","Urdu","Uzbek",
  "Vietnamese","Welsh","Xhosa","Yoruba","Zulu",
];

const PROFICIENCY_LEVELS = [
  { id: "A1", label: "Beginner"    },
  { id: "A2", label: "Elementary"  },
  { id: "B1", label: "Intermediate"},
  { id: "B2", label: "Upper Int."  },
  { id: "C1", label: "Advanced"   },
  { id: "C2", label: "Fluent"     },
  { id: "Native", label: "Native" },
];

const PROFICIENCY_BAR = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6, Native: 6 };

// ─── Searchable language combobox ─────────────────────────────

function LanguageCombobox({ languages, onAdd }) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const containerRef        = useRef(null);
  const inputRef            = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const added = new Set(languages.map(l => l.language));

  const filtered = LANGUAGE_OPTIONS
    .filter(l => !added.has(l) && l.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20);

  const handleSelect = (lang) => {
    onAdd(lang);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (filtered.length > 0) {
        handleSelect(filtered[0]);
      } else if (query.trim() && !added.has(query.trim())) {
        handleSelect(query.trim());
      }
    }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative max-w-xs mx-auto">
      <div className="relative">
        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search language…"
          className="w-full h-12 pl-9 pr-9 rounded-xl border border-input bg-background text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 w-full mt-1.5 bg-popover border border-border rounded-xl shadow-lg overflow-hidden"
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                {query.trim() && !added.has(query.trim())
                  ? <span>Press Enter to add <strong>"{query}"</strong></span>
                  : 'No languages found'}
              </div>
            ) : (
              <ul className="max-h-52 overflow-y-auto py-1">
                {filtered.map(lang => (
                  <li key={lang}>
                    <button
                      className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                      onMouseDown={e => { e.preventDefault(); handleSelect(lang); }}
                    >
                      {highlight(lang, query)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-blue-100 text-blue-700 rounded-sm font-semibold">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Main step ────────────────────────────────────────────────

export default function LanguagesStep({ data, onUpdate }) {
  const languages = data.languages || [];

  const addLanguage = (lang) => {
    if (lang && !languages.find((l) => l.language === lang)) {
      onUpdate({ languages: [...languages, { language: lang, proficiency: "B1" }] });
    }
  };

  const updateProficiency = (index, proficiency) => {
    const updated = [...languages];
    updated[index] = { ...updated[index], proficiency };
    onUpdate({ languages: updated });
  };

  const removeLanguage = (index) => {
    onUpdate({ languages: languages.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Step 6</p>
        <h2 className="text-3xl font-bold tracking-tight">Languages you speak</h2>
        <p className="text-muted-foreground text-base">Add languages and set your proficiency level</p>
      </div>

      <LanguageCombobox languages={languages} onAdd={addLanguage} />

      {/* Language cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {languages.map((entry, index) => {
            const barLevel = PROFICIENCY_BAR[entry.proficiency] || 3;
            return (
              <motion.div
                key={entry.language}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="bg-card rounded-2xl border shadow-sm p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
                      <Globe className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold">{entry.language}</p>
                      <p className="text-xs text-muted-foreground">
                        {PROFICIENCY_LEVELS.find(l => l.id === entry.proficiency)?.label || "Intermediate"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLanguage(index)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* Proficiency bar */}
                <div className="flex gap-1">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all ${i < barLevel ? "bg-blue-600" : "bg-muted"}`}
                    />
                  ))}
                </div>

                {/* Level buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  {PROFICIENCY_LEVELS.map((level) => (
                    <motion.button
                      key={level.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => updateProficiency(index, level.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        entry.proficiency === level.id
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-secondary text-secondary-foreground border-transparent hover:border-blue-600/30"
                      }`}
                    >
                      {level.id}
                      <span className="ml-1 hidden sm:inline text-[10px] opacity-70">· {level.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {languages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 text-muted-foreground bg-card rounded-2xl border border-dashed"
          >
            <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No languages added yet</p>
            <p className="text-xs mt-1">Search above or type any language name</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
