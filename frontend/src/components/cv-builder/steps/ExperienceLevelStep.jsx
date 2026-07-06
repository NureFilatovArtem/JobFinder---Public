import { motion } from "framer-motion";
import { Sprout, Rocket, Star, Crown } from "lucide-react";

const LEVELS = [
  {
    id: "0-1",
    label: "0–1 years",
    subtitle: "Just starting out",
    description: "Internships, bootcamps, personal projects — your journey begins.",
    icon: Sprout,
    color: "from-emerald-500/10 to-teal-500/10",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50",
  },
  {
    id: "1-3",
    label: "1–3 years",
    subtitle: "Building momentum",
    description: "Real-world experience, growing skills, and a clear direction.",
    icon: Rocket,
    color: "from-blue-500/10 to-sky-500/10",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50",
  },
  {
    id: "3-5",
    label: "3–5 years",
    subtitle: "Experienced",
    description: "Proven track record, team contributions, and solid expertise.",
    icon: Star,
    color: "from-violet-500/10 to-purple-500/10",
    iconColor: "text-violet-500",
    iconBg: "bg-violet-50",
  },
  {
    id: "5+",
    label: "5+ years",
    subtitle: "Senior level",
    description: "Leadership, mentoring, architecting — you set the standard.",
    icon: Crown,
    color: "from-amber-500/10 to-orange-500/10",
    iconColor: "text-amber-500",
    iconBg: "bg-amber-50",
  },
];

export default function ExperienceLevelStep({ data, onUpdate }) {
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="text-center space-y-2">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">Step 2</p>
        <h2 className="text-3xl font-bold tracking-tight">How experienced are you?</h2>
        <p className="text-muted-foreground text-base">This helps us tailor your CV layout and tone</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {LEVELS.map((level, index) => {
          const Icon = level.icon;
          const isSelected = data.experienceLevel === level.id;

          return (
            <motion.button
              key={level.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, type: "spring", stiffness: 300, damping: 28 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onUpdate({ experienceLevel: level.id })}
              className={`relative p-6 rounded-2xl border-2 text-left transition-all duration-200 group overflow-hidden ${
                isSelected
                  ? "border-blue-600 bg-blue-50 shadow-lg shadow-blue-600/10"
                  : "border-border bg-card hover:border-blue-600/50 hover:shadow-md"
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${level.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative space-y-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isSelected ? "bg-blue-600" : level.iconBg}`}>
                  <Icon className={`w-6 h-6 ${isSelected ? "text-white" : level.iconColor}`} />
                </div>
                <div>
                  <p className={`font-bold text-lg leading-tight ${isSelected ? "text-blue-600" : "text-foreground"}`}>
                    {level.label}
                  </p>
                  <p className={`text-sm font-medium mt-0.5 ${isSelected ? "text-blue-600/70" : "text-muted-foreground"}`}>
                    {level.subtitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{level.description}</p>
                </div>
              </div>
              {isSelected && (
                <motion.div
                  layoutId="expIndicator"
                  className="absolute top-4 right-4 w-3 h-3 rounded-full bg-blue-600 ring-2 ring-blue-600/30"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
