import { cn } from "@/lib/utils";

export default function CVEducationBlock({ data, selected, onSelect, onEdit, style }) {
  const handleFieldBlur = (itemIdx, field, value) => {
    const newItems = [...data.items];
    newItems[itemIdx] = { ...newItems[itemIdx], [field]: value };
    onEdit('education', { ...data, items: newItems });
  };

  return (
    <div
      className={cn("editable-block px-6 py-3 cursor-pointer", selected && "selected")}
      onClick={() => onSelect('education')}
    >
      <h2
        className="text-[11px] font-bold uppercase tracking-widest mb-2"
        style={{ color: style?.accentColor }}
      >
        Education
      </h2>
      <div className="border-t border-foreground/10" />

      <div className="space-y-3 mt-3">
        {data.items.map((item, idx) => (
          <div key={item.id}>
            <div className="flex items-baseline justify-between">
              <div>
                <span
                  contentEditable
                  suppressContentEditableWarning
                  className="text-[12px] font-semibold outline-none"
                  onBlur={(e) => handleFieldBlur(idx, 'degree', e.target.textContent)}
                >
                  {item.degree}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                {item.startDate} — {item.endDate}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              <span
                contentEditable
                suppressContentEditableWarning
                className="outline-none"
                onBlur={(e) => handleFieldBlur(idx, 'institution', e.target.textContent)}
              >
                {item.institution}
              </span>
              {item.location && <span> · {item.location}</span>}
            </p>
            {item.gpa && (
              <p className="text-[10px] text-muted-foreground mt-0.5">GPA: {item.gpa}</p>
            )}
            {item.highlights && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.highlights}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
