import { cn } from "@/lib/utils";

export default function CVTextBlock({ data, selected, onSelect, onEdit, style }) {
  const handleTitleBlur = (e) => {
    onEdit(data._sectionId, { ...data, title: e.target.textContent });
  };

  const handleContentBlur = (e) => {
    onEdit(data._sectionId, { ...data, content: e.target.textContent });
  };

  return (
    <div
      className={cn("editable-block px-6 py-3 cursor-pointer", selected && "selected")}
      onClick={() => onSelect(data._sectionId)}
    >
      <h2
        contentEditable
        suppressContentEditableWarning
        className="text-[11px] font-bold uppercase tracking-widest mb-2 outline-none"
        style={{ color: style?.accentColor }}
        onBlur={handleTitleBlur}
      >
        {data.title || 'Section Title'}
      </h2>
      <div className="border-t border-foreground/10" />

      <p
        contentEditable
        suppressContentEditableWarning
        className="text-[11px] leading-relaxed mt-3 text-foreground/80 outline-none whitespace-pre-wrap"
        onBlur={handleContentBlur}
      >
        {data.content || 'Click to add content...'}
      </p>
    </div>
  );
}
