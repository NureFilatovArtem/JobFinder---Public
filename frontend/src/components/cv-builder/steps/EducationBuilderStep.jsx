import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, GraduationCap, Building2, Calendar, Award } from "lucide-react";

const DEGREE_OPTIONS = [
  { label: "High School Diploma", value: "High School Diploma" },
  { label: "Associate Degree", value: "Associate Degree" },
  { label: "Bachelor's Degree (BSc / BA)", value: "Bachelor's Degree" },
  { label: "Master's Degree (MSc / MA)", value: "Master's Degree" },
  { label: "PhD / Doctorate", value: "PhD" },
  { label: "MBA", value: "MBA" },
  { label: "Professional Certificate", value: "Professional Certificate" },
  { label: "Vocational / Trade School", value: "Vocational Diploma" },
  { label: "Other", value: "" },
];

function EducationCard({ entry, index, onUpdate, onDelete }) {
  const selectDegree = (value) => {
    onUpdate({ ...entry, degree: value });
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
          <div className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
            {index + 1}
          </div>
          <span className="text-sm font-semibold text-foreground">
            {entry.institution || entry.degree
              ? `${entry.degree || "Degree"}${entry.institution ? ` — ${entry.institution}` : ""}`
              : `Education #${index + 1}`}
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
        {/* Degree quick-select */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" /> Degree / Qualification
          </label>
          <div className="flex flex-wrap gap-2">
            {DEGREE_OPTIONS.map((opt) => {
              const isSelected = entry.degree === opt.value && opt.value !== "";
              return (
                <motion.button
                  key={opt.label}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => selectDegree(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    isSelected
                      ? "bg-amber-600 text-white border-amber-600"
                      : "bg-secondary text-secondary-foreground border-transparent hover:border-amber-600/30 hover:bg-amber-50"
                  }`}
                >
                  {opt.label}
                </motion.button>
              );
            })}
          </div>
          {/* Custom degree input (shown when "Other" is selected or free-form) */}
          {!DEGREE_OPTIONS.some((o) => o.value === entry.degree && o.value !== "") && (
            <Input
              placeholder="e.g. Postgraduate Diploma in Data Science"
              value={entry.degree || ""}
              onChange={(e) => onUpdate({ ...entry, degree: e.target.value })}
              className="h-10 mt-1"
            />
          )}
        </div>

        {/* Institution + Field */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Institution
            </label>
            <Input
              placeholder="e.g. University of Amsterdam"
              value={entry.institution || ""}
              onChange={(e) => onUpdate({ ...entry, institution: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" /> Field of Study
            </label>
            <Input
              placeholder="e.g. Computer Science"
              value={entry.field || ""}
              onChange={(e) => onUpdate({ ...entry, field: e.target.value })}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Start date
            </label>
            <Input
              placeholder="e.g. Sep 2018"
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
              placeholder="e.g. Jun 2022"
              value={entry.endDate || ""}
              onChange={(e) => onUpdate({ ...entry, endDate: e.target.value })}
              className="h-10"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function EducationBuilderStep({ data, onUpdate }) {
  const educations = data.educations || [];

  const addEducation = () => {
    onUpdate({
      educations: [
        ...educations,
        { institution: "", degree: "", field: "", startDate: "", endDate: "" },
      ],
    });
  };

  const updateEducation = (index, entry) => {
    const updated = [...educations];
    updated[index] = entry;
    onUpdate({ educations: updated });
  };

  const deleteEducation = (index) => {
    onUpdate({ educations: educations.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest">Step 5</p>
        <h2 className="text-3xl font-bold tracking-tight">Your education</h2>
        <p className="text-muted-foreground text-base">Add your degrees, diplomas, or certifications</p>
      </div>

      <AnimatePresence mode="popLayout">
        {educations.map((entry, index) => (
          <EducationCard
            key={index}
            entry={entry}
            index={index}
            onUpdate={(e) => updateEducation(index, e)}
            onDelete={() => deleteEducation(index)}
          />
        ))}
      </AnimatePresence>

      {educations.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 text-muted-foreground bg-card rounded-2xl border border-dashed"
        >
          <GraduationCap className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No education added yet</p>
          <p className="text-xs mt-1">Click below to add your first entry</p>
        </motion.div>
      )}

      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          onClick={addEducation}
          variant="outline"
          className="w-full h-14 border-dashed gap-2 text-muted-foreground hover:text-amber-600 hover:border-amber-600/40 hover:bg-amber-50 rounded-2xl"
        >
          <Plus className="w-5 h-5" />
          Add Education
        </Button>
      </motion.div>
    </div>
  );
}
