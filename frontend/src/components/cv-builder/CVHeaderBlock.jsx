import { cn } from "@/lib/utils";
import { Mail, Phone, MapPin, Globe, Linkedin } from "lucide-react";

export default function CVHeaderBlock({ data, selected, onSelect, onEdit, style }) {
  const handleFieldClick = (e) => {
    e.stopPropagation();
    onSelect('header');
  };

  const handleBlur = (field, value) => {
    onEdit('header', { ...data, [field]: value });
  };

  return (
    <div
      className={cn("editable-block p-6 pb-4 cursor-pointer", selected && "selected")}
      onClick={() => onSelect('header')}
    >
      <h1
        contentEditable
        suppressContentEditableWarning
        className="text-2xl font-bold tracking-tight outline-none"
        style={{ color: style?.accentColor || '#1a1a2e' }}
        onBlur={(e) => handleBlur('fullName', e.target.textContent)}
        onClick={(e) => handleFieldClick(e)}
      >
        {data.fullName || 'Your Name'}
      </h1>
      <p
        contentEditable
        suppressContentEditableWarning
        className="text-sm text-muted-foreground mt-0.5 outline-none font-medium"
        onBlur={(e) => handleBlur('title', e.target.textContent)}
      >
        {data.title || 'Professional Title'}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[10px] text-muted-foreground">
        {data.email && (
          <span className="flex items-center gap-1">
            <Mail className="h-3 w-3" /> {data.email}
          </span>
        )}
        {data.phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" /> {data.phone}
          </span>
        )}
        {data.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {data.location}
          </span>
        )}
        {data.linkedin && (
          <span className="flex items-center gap-1">
            <Linkedin className="h-3 w-3" /> {data.linkedin}
          </span>
        )}
        {data.website && (
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3" /> {data.website}
          </span>
        )}
      </div>

      {data.summary && (
        <p
          contentEditable
          suppressContentEditableWarning
          className="text-[11px] leading-relaxed mt-3 text-foreground/80 outline-none"
          onBlur={(e) => handleBlur('summary', e.target.textContent)}
        >
          {data.summary}
        </p>
      )}
    </div>
  );
}
