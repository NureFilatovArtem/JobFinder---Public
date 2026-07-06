import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, CheckCircle2, Building2, Briefcase, Calendar } from "lucide-react";

const ACHIEVEMENT_SUGGESTIONS = [
  "Led a team of engineers",
  "Launched a product feature",
  "Increased revenue by X%",
  "Reduced load time by X%",
  "Managed cross-functional team",
  "Automated a manual process",
  "Trained & onboarded new hires",
  "Built from scratch",
  "Improved customer retention",
  "Shipped to production",
];

function ExperienceCard({ entry, index, onUpdate, onDelete }) {
  const toggleAchievement = (achievement) => {
    const achievements = entry.achievements || [];
    const updated = achievements.includes(achievement)
      ? achievements.filter((a) => a !== achievement)
      : [...achievements, achievement];
    onUpdate({ ...entry, achievements: updated });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card rounded-2xl border shadow-sm overflow-hidden"
    >
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            {index + 1}
          </div>
          <span className="text-sm font-semibold text-foreground">
            {entry.company || entry.role
              ? `${entry.role || "Role"}${entry.company ? ` at ${entry.company}` : ""}`
              : `Experience #${index + 1}`}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive h-7 w-7"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="p-5 space-y-5">
        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Company
            </label>
            <Input
              placeholder="e.g. Google"
              value={entry.company || ""}
              onChange={(e) => onUpdate({ ...entry, company: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Role / Title
            </label>
            <Input
              placeholder="e.g. Senior Engineer"
              value={entry.role || ""}
              onChange={(e) => onUpdate({ ...entry, role: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Start date
            </label>
            <Input
              placeholder="e.g. Jan 2022"
              value={entry.startDate || ""}
              onChange={(e) => onUpdate({ ...entry, startDate: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> End date
            </label>
            <Input
              placeholder="e.g. Present"
              value={entry.endDate || ""}
              onChange={(e) => onUpdate({ ...entry, endDate: e.target.value })}
              className="h-10"
            />
          </div>
        </div>

        {/* Achievements quick-add */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick-add achievements
            </p>
            {(entry.achievements || []).length > 0 && (
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {(entry.achievements || []).length} added
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ACHIEVEMENT_SUGGESTIONS.map((a) => {
              const isSelected = (entry.achievements || []).includes(a);
              return (
                <motion.button
                  key={a}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => toggleAchievement(a)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-secondary text-secondary-foreground border-transparent hover:border-blue-600/30 hover:bg-blue-50"
                  }`}
                >
                  {isSelected && <CheckCircle2 className="w-3 h-3" />}
                  {a}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ExperienceBuilderStep({ data, onUpdate }) {
  const experiences = data.experiences || [];

  const addExperience = () => {
    onUpdate({
      experiences: [
        ...experiences,
        { company: "", role: "", startDate: "", endDate: "", achievements: [] },
      ],
    });
  };

  const updateExperience = (index, entry) => {
    const updated = [...experiences];
    updated[index] = entry;
    onUpdate({ experiences: updated });
  };

  const deleteExperience = (index) => {
    onUpdate({ experiences: experiences.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Step 5</p>
        <h2 className="text-3xl font-bold tracking-tight">Your work history</h2>
        <p className="text-muted-foreground text-base">Add your most relevant roles — keep it focused</p>
      </div>

      <AnimatePresence mode="popLayout">
        {experiences.map((entry, index) => (
          <ExperienceCard
            key={index}
            entry={entry}
            index={index}
            onUpdate={(e) => updateExperience(index, e)}
            onDelete={() => deleteExperience(index)}
          />
        ))}
      </AnimatePresence>

      {experiences.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-dashed"
        >
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No experience added yet</p>
          <p className="text-xs mt-1">Click below to add your first role</p>
        </motion.div>
      )}

      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          onClick={addExperience}
          variant="outline"
          className="w-full h-14 border-dashed gap-2 text-muted-foreground hover:text-blue-600 hover:border-blue-600/40 hover:bg-blue-50 rounded-2xl"
        >
          <Plus className="w-5 h-5" />
          Add Experience
        </Button>
      </motion.div>
    </div>
  );
}
