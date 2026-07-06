import { cn } from "@/lib/utils";

export default function CVSkillsBlock({ data, selected, onSelect, style }) {
  return (
    <div
      className={cn("editable-block px-6 py-3 cursor-pointer", selected && "selected")}
      onClick={() => onSelect('skills')}
    >
      <h2
        className="text-[11px] font-bold uppercase tracking-widest mb-2"
        style={{ color: style?.accentColor }}
      >
        Skills
      </h2>
      <div className="border-t border-foreground/10" />

      <div className="space-y-1.5 mt-3">
        {data.categories.map((cat, idx) => (
          <div key={idx} className="flex items-start gap-2 text-[11px]">
            <span className="font-semibold shrink-0 min-w-[70px]">{cat.label}:</span>
            <span className="text-foreground/75 leading-relaxed">
              {cat.skills.join(' · ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
