import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Settings2, Type, Palette, LayoutTemplate } from "lucide-react";
import { HEADING_FONTS, BODY_FONTS } from "@/lib/cvDefaults";

const ACCENT_COLORS = [
  '#2563eb', '#1d4ed8', '#0f766e', '#059669',
  '#7c3aed', '#9333ea', '#b91c1c', '#c2410c', '#111827',
];

const TEMPLATES = [
  { key: 'minimal', label: 'Minimal', desc: 'Single column' },
  { key: 'modern',  label: 'Modern',  desc: '2-col sidebar'  },
  { key: 'compact', label: 'Compact', desc: 'Dark sidebar'   },
];

export default function PropertiesPanel({ style, onStyleChange }) {
  const upd = (key, val) => onStyleChange({ ...style, [key]: val });

  return (
    <div className="w-64 border-l border-border bg-card flex flex-col shrink-0">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-2 min-h-[42px]">
        <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold text-foreground/80">Style</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 cv-canvas-scroll space-y-5">

        {/* Template */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
            <LayoutTemplate className="h-3 w-3" /> Template
          </Label>
          <div className="grid grid-cols-3 gap-1.5">
            {TEMPLATES.map(({ key, label, desc }) => (
              <button key={key} onClick={() => upd('template', key)}
                className={`p-2 rounded-lg border text-left transition-all duration-150 ${(style.template || 'minimal') === key ? 'border-foreground bg-foreground/5 shadow-sm' : 'border-border hover:border-foreground/40'}`}>
                <div className="text-[11px] font-semibold leading-tight">{label}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* CV Language */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 block">Section Labels</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {[['en', 'English', 'gb'], ['nl', 'Nederlands', 'nl']].map(([key, label, flagCode]) => (
              <button key={key} onClick={() => upd('cvLang', key)}
                className={`h-8 text-[11px] rounded-md border transition-colors duration-150 flex items-center justify-center gap-1.5 ${(style.cvLang || 'en') === key ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground/40'}`}>
                <img src={`https://flagcdn.com/w40/${flagCode}.png`} srcSet={`https://flagcdn.com/w80/${flagCode}.png 2x`} alt={label} className="w-4 h-3 object-cover rounded-sm" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Typography */}
        <div className="space-y-3">
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <Type className="h-3 w-3" /> Typography
          </Label>
          <div>
            <Label className="text-[10px] text-muted-foreground">Heading Font</Label>
            <Select value={style.headingFont || 'inter'} onValueChange={v => upd('headingFont', v)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(HEADING_FONTS).map(([k, { label }]) => <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">Body Font</Label>
            <Select value={style.bodyFont || 'inter'} onValueChange={v => upd('bodyFont', v)}>
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(BODY_FONTS).map(([k, { label }]) => <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-[10px] text-muted-foreground">Font Size</Label>
              <span className="text-[10px] tabular-nums text-muted-foreground">{style.fontSize ?? 10}px</span>
            </div>
            <input type="range" min="8" max="20" step="0.5" value={style.fontSize ?? 10}
              onChange={e => upd('fontSize', parseFloat(e.target.value))}
              className="w-full accent-foreground cursor-pointer" style={{ height: '4px' }} />
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-muted-foreground/60">8px</span>
              <span className="text-[9px] text-muted-foreground/60">20px</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Accent color */}
        <div>
          <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
            <Palette className="h-3 w-3" /> Accent Color
          </Label>
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map(color => (
              <button key={color} className="h-6 w-6 rounded-full border-2 transition-all hover:scale-110"
                style={{ backgroundColor: color, borderColor: (style.accentColor || '#2563eb') === color ? color : 'transparent', boxShadow: (style.accentColor || '#2563eb') === color ? `0 0 0 2px white, 0 0 0 3.5px ${color}` : 'none' }}
                onClick={() => upd('accentColor', color)} />
            ))}
          </div>
        </div>

        {/* Spacing */}
        <div>
          <Label className="text-[11px] text-muted-foreground mb-2 block">Spacing</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {['compact', 'normal', 'relaxed'].map(s => (
              <button key={s} onClick={() => upd('spacing', s)}
                className={`h-7 text-[10px] rounded-md border capitalize transition-colors duration-150 ${(style.spacing || 'normal') === s ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground/40'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Page Padding */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-[10px] text-muted-foreground">Page Padding</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">{style.pagePadding ?? 38}px</span>
          </div>
          <input type="range" min="16" max="60" step="2" value={style.pagePadding ?? 38}
            onChange={e => upd('pagePadding', parseInt(e.target.value))}
            className="w-full accent-foreground cursor-pointer" style={{ height: '4px' }} />
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-muted-foreground/60">Tight</span>
            <span className="text-[9px] text-muted-foreground/60">Spacious</span>
          </div>
        </div>

        <Separator />

        {/* Multi-page */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-[11px] text-muted-foreground">Allow second page</Label>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">Content will overflow naturally. Not recommended — recruiters prefer 1-page CVs.</p>
            </div>
            <button
              onClick={() => upd('multiPage', !style.multiPage)}
              className={`relative ml-3 w-8 h-4 rounded-full shrink-0 transition-colors duration-200 ${style.multiPage ? 'bg-foreground' : 'bg-muted-foreground/30'}`}
            >
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-all duration-200 ${style.multiPage ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
