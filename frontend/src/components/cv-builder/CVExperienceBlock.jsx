import { cn } from "@/lib/utils";

export default function CVExperienceBlock({ data, selected, onSelect, onEdit, style }) {
  const handleBulletBlur = (itemIdx, bulletIdx, value) => {
    const newItems = [...data.items];
    newItems[itemIdx] = {
      ...newItems[itemIdx],
      bullets: newItems[itemIdx].bullets.map((b, i) => (i === bulletIdx ? value : b)),
    };
    onEdit('experience', { ...data, items: newItems });
  };

  const handleFieldBlur = (itemIdx, field, value) => {
    const newItems = [...data.items];
    newItems[itemIdx] = { ...newItems[itemIdx], [field]: value };
    onEdit('experience', { ...data, items: newItems });
  };

  return (
    <div
      className={cn("editable-block px-6 py-3 cursor-pointer", selected && "selected")}
      onClick={() => onSelect('experience')}
    >
      <h2
        className="text-[11px] font-bold uppercase tracking-widest mb-2"
        style={{ color: style?.accentColor }}
      >
        Experience
      </h2>
      <div className="border-t border-foreground/10" />

      <div className="space-y-3 mt-3">
        {data.items.map((item, idx) => (
          <div key={item.id} className="group">
            <div className="flex items-baseline justify-between">
              <div>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  className="text-[12px] font-semibold outline-none"
                  onBlur={(e) => handleFieldBlur(idx, 'role', e.target.textContent)}
                >
                  {item.role}
                </span>
                <span className="text-[11px] text-muted-foreground"> at </span>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  className="text-[11px] font-medium outline-none"
                  onBlur={(e) => handleFieldBlur(idx, 'company', e.target.textContent)}
                >
                  {item.company}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                {item.startDate} — {item.endDate}
              </span>
            </div>
            {item.location && (
              <p className="text-[10px] text-muted-foreground">{item.location}</p>
            )}
            <ul className="mt-1.5 space-y-0.5">
              {item.bullets.map((bullet, bIdx) => (
                <li key={bIdx} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    className="outline-none flex-1"
                    onBlur={(e) => handleBulletBlur(idx, bIdx, e.target.textContent)}
                  >
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
