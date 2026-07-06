import { useState, useEffect } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  GripVertical, Eye, EyeOff, User, Briefcase, GraduationCap,
  Zap, FolderOpen, Plus, Type, Trash2, Layers, Pencil,
} from "lucide-react";
import { SECTION_LABELS } from "@/lib/cvDefaults";
import { SectionEditor } from "./SectionEditors";

const ICONS = {
  header: User,
  experience: Briefcase,
  education: GraduationCap,
  skills: Zap,
  projects: FolderOpen,
  text: Type,
};

const ADDABLE_SECTIONS = [
  { type: 'experience', label: 'Experience',    icon: Briefcase,     defaultData: { items: [] } },
  { type: 'education',  label: 'Education',     icon: GraduationCap, defaultData: { items: [] } },
  { type: 'skills',     label: 'Skills',        icon: Zap,           defaultData: { categories: [] } },
  { type: 'projects',   label: 'Projects',      icon: FolderOpen,    defaultData: { items: [] } },
  { type: 'text',       label: 'Text Section',  icon: Type,          defaultData: { title: 'Custom Section', content: '' } },
];

function SectionItem({ section, selectedId, onSelect, onReorder, onToggleVisibility, onRemoveSection }) {
  const dragControls = useDragControls();
  const isCustom = section.type === 'text';
  const Icon = ICONS[section.type] || Type;
  const label = section.type === 'text'
    ? (section.data?.title || 'Text Section')
    : (SECTION_LABELS[section.type] || section.type);

  return (
    <Reorder.Item
      value={section}
      dragListener={false}
      dragControls={dragControls}
      className={cn(
        "group flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-all text-sm list-none",
        selectedId === section.id
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted text-foreground",
        !section.visible && "opacity-50"
      )}
      onClick={() => onSelect(section.id)}
    >
      <button
        className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0 touch-none"
        onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-[11px] font-medium truncate">{label}</span>

      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisibility(section.id); }}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-background"
        aria-label={section.visible ? 'Hide section' : 'Show section'}
      >
        {section.visible
          ? <Eye className="h-3 w-3 text-muted-foreground" />
          : <EyeOff className="h-3 w-3 text-muted-foreground" />
        }
      </button>

      {isCustom && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveSection(section.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/10"
          aria-label="Remove section"
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </button>
      )}
    </Reorder.Item>
  );
}

export default function SectionsSidebar({
  sections,
  selection,
  onSelect,
  onReorder,
  onToggleVisibility,
  onAddSection,
  onRemoveSection,
  onEdit,
  style,
  onStyleChange,
}) {
  const [activeTab, setActiveTab] = useState('sections');
  const [showAddMenu, setShowAddMenu] = useState(false);

  const selectedSectionId = selection?.sectionId ?? null;
  const selectedSection = sections.find(s => s.id === selectedSectionId) ?? null;

  // Auto-switch to Edit tab when a selection is made (from canvas click or sidebar click)
  useEffect(() => {
    if (selectedSectionId) setActiveTab('edit');
  }, [selectedSectionId]);

  const handleSectionClick = (id) => {
    onSelect(id);
    setActiveTab('edit');
  };

  return (
    <div className="w-72 border-r border-border bg-card flex flex-col shrink-0">
      {/* Tab header */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setActiveTab('sections')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-colors",
            activeTab === 'sections'
              ? "text-foreground border-b-2 border-foreground -mb-px"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Layers className="h-3.5 w-3.5" /> Sections
        </button>
        <button
          onClick={() => setActiveTab('edit')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-colors",
            activeTab === 'edit'
              ? "text-foreground border-b-2 border-foreground -mb-px"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
          {selectedSection && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-medium leading-none">
              {selectedSection.type === 'text' ? selectedSection.data?.title : (SECTION_LABELS[selectedSection.type] || '')}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'sections' ? (
        <>
          <Reorder.Group
            axis="y"
            values={sections}
            onReorder={onReorder}
            className="flex-1 overflow-y-auto p-2 space-y-0.5 cv-canvas-scroll"
            style={{ listStyle: 'none', padding: '0.5rem', margin: 0 }}
          >
            {sections.map((section) => (
              <SectionItem
                key={section.id}
                section={section}
                selectedId={selectedSectionId}
                onSelect={handleSectionClick}
                onReorder={onReorder}
                onToggleVisibility={onToggleVisibility}
                onRemoveSection={onRemoveSection}
              />
            ))}
          </Reorder.Group>

          {/* Add Section */}
          <div className="p-2 border-t border-border shrink-0">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs gap-1.5 justify-start"
                onClick={() => setShowAddMenu(!showAddMenu)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Section
              </Button>

              {showAddMenu && (
                <div className="absolute bottom-full left-0 w-full mb-1 bg-popover border border-border rounded-lg shadow-lg py-1 z-10">
                  {ADDABLE_SECTIONS.map((item, i) => (
                    <button
                      key={i}
                      className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent transition-colors text-left"
                      onClick={() => {
                        onAddSection(item.type, item.defaultData);
                        setShowAddMenu(false);
                      }}
                    >
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 cv-canvas-scroll space-y-3">
          {selectedSection ? (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('sections')}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Sections
                </button>
                <span className="text-muted-foreground/40 text-[10px]">/</span>
                <span className="text-[11px] font-medium text-foreground">
                  {selectedSection.type === 'text' ? selectedSection.data?.title : (SECTION_LABELS[selectedSection.type] || '')}
                </span>
              </div>
              <SectionEditor
                section={selectedSection}
                sections={sections}
                onEdit={onEdit}
                selection={selection}
                style={style}
                onStyleChange={onStyleChange}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
              <Pencil className="h-8 w-8 text-muted-foreground/20" />
              <p className="text-[11px] text-muted-foreground">Select a section to edit</p>
              <button
                onClick={() => setActiveTab('sections')}
                className="text-[11px] text-primary hover:underline"
              >
                Browse sections →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
