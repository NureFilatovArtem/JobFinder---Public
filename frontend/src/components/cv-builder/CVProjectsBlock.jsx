import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

export default function CVProjectsBlock({ data, selected, onSelect, onEdit, style }) {
  const handleFieldBlur = (itemIdx, field, value) => {
    const newItems = [...data.items];
    newItems[itemIdx] = { ...newItems[itemIdx], [field]: value };
    onEdit('projects', { ...data, items: newItems });
  };

  return (
    <div
      className={cn("editable-block px-6 py-3 cursor-pointer", selected && "selected")}
      onClick={() => onSelect('projects')}
    >
      <h2
        className="text-[11px] font-bold uppercase tracking-widest mb-2"
        style={{ color: style?.accentColor }}
      >
        Projects
      </h2>
      <div className="border-t border-foreground/10" />

      <div className="space-y-2.5 mt-3">
        {data.items.map((item, idx) => (
          <div key={item.id}>
            <div className="flex items-center gap-2">
              <span
                contentEditable
                suppressContentEditableWarning
                className="text-[12px] font-semibold outline-none"
                onBlur={(e) => handleFieldBlur(idx, 'name', e.target.textContent)}
              >
                {item.name}
              </span>
              {item.link && (
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              )}
            </div>
            <p
              contentEditable
              suppressContentEditableWarning
              className="text-[11px] text-foreground/75 leading-relaxed mt-0.5 outline-none"
              onBlur={(e) => handleFieldBlur(idx, 'description', e.target.textContent)}
            >
              {item.description}
            </p>
            {item.technologies?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.technologies.map((tech, tIdx) => (
                  <span
                    key={tIdx}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
