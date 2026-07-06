import { motion } from "framer-motion";
import { Check, Briefcase, BarChart2, Zap, GraduationCap, Building2, FileText, Globe, Eye } from "lucide-react";

const STEPS = [
  { label: "Role",        icon: Briefcase      },
  { label: "Experience",  icon: BarChart2      },
  { label: "Skills",      icon: Zap            },
  { label: "Education",   icon: GraduationCap  },
  { label: "Work History", icon: Building2     },
  { label: "Summary",     icon: FileText       },
  { label: "Languages",   icon: Globe          },
  { label: "Preview",     icon: Eye            },
];

export default function ProgressStepper({ currentStep }) {
  return (
    <div className="w-full px-4 py-4">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent   = index === currentStep;
          const Icon = step.icon;

          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                    backgroundColor: isCompleted
                      ? "hsl(217, 91%, 54%)"
                      : isCurrent
                      ? "hsl(214, 100%, 95%)"
                      : "hsl(220, 14%, 94%)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-shadow ${
                    isCurrent  ? "shadow-lg shadow-blue-600/25 ring-2 ring-blue-600/30" : ""
                  } ${isCompleted ? "text-white" : ""}`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Icon className={`w-3.5 h-3.5 ${isCurrent ? "text-blue-600" : "text-muted-foreground"}`} />
                  )}
                </motion.div>
                <span className={`text-[10px] font-medium hidden sm:block ${
                  isCurrent   ? "text-blue-600"
                  : isCompleted ? "text-foreground"
                  : "text-muted-foreground"
                }`}>
                  {step.label}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mb-4 rounded-full overflow-hidden bg-muted">
                  <motion.div
                    initial={false}
                    animate={{ width: isCompleted ? "100%" : "0%" }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className="h-full bg-blue-600 rounded-full"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
