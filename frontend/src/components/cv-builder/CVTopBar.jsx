import { Button } from "@/components/ui/button";
import { Download, Save, FileText, Loader2, Import, Sparkles, PenLine, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CVTopBar({
  mode,
  onModeChange,
  onSave,
  onExport,
  onImportFromProfile,
  saving,
  exporting,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) {
  return (
    <div className="h-13 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm tracking-tight">CV Builder</span>
        </div>

        {/* Mode Toggle */}
        <div className="h-5 w-px bg-border mx-1" />
        <div className="flex bg-muted rounded-lg p-0.5">
          <button
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
              mode === 'auto'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onModeChange('auto')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto Mode
          </button>
          <button
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5",
              mode === 'editor'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onModeChange('editor')}
          >
            <PenLine className="h-3.5 w-3.5" />
            Editor
          </button>
        </div>

        {mode === 'editor' && (
          <>
            <div className="h-5 w-px bg-border mx-1" />

            {/* Undo / Redo */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="h-5 w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={onImportFromProfile}
              title="Import data from your profile resume"
            >
              <Import className="h-3.5 w-3.5" />
              Import from Profile
            </Button>
          </>
        )}
      </div>

      {mode === 'editor' && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={onExport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {exporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      )}
    </div>
  );
}
