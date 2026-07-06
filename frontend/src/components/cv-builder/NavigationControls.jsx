import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";

export default function NavigationControls({ currentStep, totalSteps, onBack, onNext, onFinish, canProceed = true }) {
  const isFirst = currentStep === 0;
  const isLast  = currentStep === totalSteps - 1;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky bottom-0 z-10 bg-card/80 backdrop-blur-xl border-t border-border px-6 py-3"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={isFirst}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>

        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentStep
                  ? "w-6 bg-blue-600"
                  : i < currentStep
                  ? "w-1.5 bg-blue-600/40"
                  : "w-1.5 bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        {isLast ? (
          <Button onClick={onFinish} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Sparkles className="w-4 h-4" />
            Open in Editor
          </Button>
        ) : (
          <Button
            onClick={onNext}
            disabled={!canProceed}
            className="gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
