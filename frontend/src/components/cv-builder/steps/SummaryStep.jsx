import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

const TRAITS = [
  { label: "Detail-oriented", emoji: "🎯" },
  { label: "Creative",        emoji: "💡" },
  { label: "Analytical",      emoji: "📊" },
  { label: "Team player",     emoji: "🤝" },
  { label: "Self-starter",    emoji: "⚡" },
  { label: "Results-driven",  emoji: "🏆" },
  { label: "Adaptable",       emoji: "🔄" },
  { label: "Strategic thinker",emoji: "♟️" },
  { label: "Passionate",      emoji: "🔥" },
  { label: "Fast learner",    emoji: "🚀" },
  { label: "Reliable",        emoji: "🛡️" },
  { label: "Innovative",      emoji: "✨" },
];

export default function SummaryStep({ data, onUpdate }) {
  const traits = data.traits || [];
  const [customTrait, setCustomTrait] = useState("");

  const toggleTrait = (trait) => {
    const updated = traits.includes(trait)
      ? traits.filter((t) => t !== trait)
      : traits.length < 4
      ? [...traits, trait]
      : traits;
    onUpdate({ traits: updated });
  };

  const addCustomTrait = () => {
    const trimmed = customTrait.trim();
    if (trimmed && !traits.includes(trimmed) && traits.length < 4) {
      onUpdate({ traits: [...traits, trimmed] });
      setCustomTrait("");
    }
  };

  // Derive summary from traits — update parent only when the source fields change
  const role = data.role === "other" ? data.customRole : data.role;
  useEffect(() => {
    if (traits.length === 0) return;
    const summary =
      `A ${traits.map((t) => t.toLowerCase()).join(", ")} professional` +
      (role ? ` in ${role}` : "") +
      (data.experienceLevel ? ` with ${data.experienceLevel} years of experience` : "") +
      `. Skilled in ${(data.skills || []).slice(0, 3).join(", ") || "various areas"} and passionate about delivering impactful results.`;
    onUpdate({ summary });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traits.join(","), role, data.experienceLevel]);

  const generatedSummary = data.summary || "";

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest">Step 6</p>
        <h2 className="text-3xl font-bold tracking-tight">Describe yourself</h2>
        <p className="text-muted-foreground text-base">
          Pick 2–4 traits that define you ·{" "}
          <span className="text-blue-600 font-semibold">{traits.length}/4 selected</span>
        </p>
      </div>

      {/* Trait grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {TRAITS.map((trait, index) => {
          const isSelected = traits.includes(trait.label);
          const isDisabled = !isSelected && traits.length >= 4;
          return (
            <motion.button
              key={trait.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              whileHover={!isDisabled ? { scale: 1.03 } : {}}
              whileTap={!isDisabled ? { scale: 0.97 } : {}}
              onClick={() => toggleTrait(trait.label)}
              disabled={isDisabled}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all duration-150 ${
                isSelected
                  ? "border-blue-600 bg-blue-50 shadow-md shadow-blue-600/10"
                  : "border-border bg-card hover:border-blue-600/50 hover:shadow-sm"
              } ${isDisabled ? "opacity-30 cursor-not-allowed" : ""}`}
            >
              <span className="text-xl">{trait.emoji}</span>
              <span className={`text-sm font-medium leading-tight ${isSelected ? "text-blue-600" : "text-foreground"}`}>
                {trait.label}
              </span>
              {isSelected && (
                <motion.div
                  layoutId={`trait-dot-${trait.label}`}
                  className="ml-auto w-2 h-2 rounded-full bg-blue-600 shrink-0"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Custom trait */}
      <div className="flex gap-2 max-w-sm mx-auto">
        <Input
          placeholder="Add your own trait..."
          value={customTrait}
          onChange={(e) => setCustomTrait(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustomTrait()}
          className="h-11"
          disabled={traits.length >= 4}
        />
        <Button
          onClick={addCustomTrait}
          variant="outline"
          className="h-11 px-4 shrink-0"
          disabled={!customTrait.trim() || traits.length >= 4}
        >
          Add
        </Button>
      </div>

      {/* Generated summary preview */}
      <AnimatePresence>
        {generatedSummary && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-card rounded-2xl border shadow-sm overflow-hidden"
          >
            <div className="flex items-center gap-2 px-5 py-3 bg-blue-50 border-b text-xs font-bold text-blue-600 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Generated Summary
            </div>
            <div className="p-5">
              <p className="text-sm leading-relaxed text-foreground/80">{generatedSummary}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
