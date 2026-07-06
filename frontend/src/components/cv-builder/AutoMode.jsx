import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ProgressStepper from "./ProgressStepper";
import NavigationControls from "./NavigationControls";
import LivePreview from "./LivePreview";
import RoleStep from "./steps/RoleStep";
import ExperienceLevelStep from "./steps/ExperienceLevelStep";
import SkillsStep from "./steps/SkillsStep";
import EducationBuilderStep from "./steps/EducationBuilderStep";
import ExperienceBuilderStep from "./steps/ExperienceBuilderStep";
import SummaryStep from "./steps/SummaryStep";
import LanguagesStep from "./steps/LanguagesStep";
import PreviewStep from "./steps/PreviewStep";
import { wizardDataToSections, WIZARD_TEMPLATE_STYLE } from "@/lib/cvDefaults";

const TOTAL_STEPS = 8;

const stepVariants = {
  enter: (direction) => ({ x: direction > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (direction) => ({ x: direction > 0 ? -60 : 60, opacity: 0 }),
};

// Which steps require input before Continue is enabled
function getCanProceed(step, cvData) {
  switch (step) {
    case 0: return cvData.role !== "" && (cvData.role !== "other" || cvData.customRole.trim() !== "");
    case 1: return cvData.experienceLevel !== "";
    case 2: return cvData.skills.length > 0;
    default: return true;
  }
}

export default function AutoMode({ onGenerate, initialData }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [cvData, setCvData] = useState({
    role: "",
    customRole: "",
    experienceLevel: "",
    skills: [],
    educations: [],
    experiences: [],
    traits: [],
    summary: "",
    languages: [],
    template: "minimal",
    photoUrl: "",
    showPhoto: false,
  });

  const updateData = (updates) => setCvData((prev) => ({ ...prev, ...updates }));

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  // Called on final step — map wizard data → sections format → hand off to CVBuilder
  const handleFinish = () => {
    const sections      = wizardDataToSections(cvData, initialData);
    const templateStyle = WIZARD_TEMPLATE_STYLE[cvData.template] || WIZARD_TEMPLATE_STYLE.minimal;
    const style         = { ...templateStyle, showPhoto: cvData.showPhoto || false };
    onGenerate({ sections, languages: cvData.languages, style });
  };

  const renderStep = () => {
    switch (step) {
      case 0: return <RoleStep              data={cvData} onUpdate={updateData} />;
      case 1: return <ExperienceLevelStep   data={cvData} onUpdate={updateData} />;
      case 2: return <SkillsStep            data={cvData} onUpdate={updateData} />;
      case 3: return <EducationBuilderStep  data={cvData} onUpdate={updateData} />;
      case 4: return <ExperienceBuilderStep data={cvData} onUpdate={updateData} />;
      case 5: return <SummaryStep           data={cvData} onUpdate={updateData} />;
      case 6: return <LanguagesStep         data={cvData} onUpdate={updateData} />;
      case 7: return <PreviewStep           data={cvData} onUpdate={updateData} initialData={initialData} />;
      default: return null;
    }
  };

  const isPreviewStep = step === TOTAL_STEPS - 1;
  const canProceed = getCanProceed(step, cvData);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Progress indicator */}
      <div className="border-b bg-card/80 backdrop-blur-xl shrink-0">
        <div className="max-w-7xl mx-auto">
          <ProgressStepper currentStep={step} />
        </div>
      </div>

      {/* Content + live preview */}
      <div className="flex-1 flex min-h-0">
        {/* Step content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 md:p-10 max-w-4xl mx-auto">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.3 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Live preview sidebar — hidden on the final preview step */}
        {!isPreviewStep && (
          <div className="hidden lg:block w-80 xl:w-96 shrink-0 p-4 pt-6 pr-6 pb-6">
            <div className="sticky top-0 h-[calc(100vh-16rem)]">
              <LivePreview data={cvData} initialData={initialData} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <NavigationControls
        currentStep={step}
        totalSteps={TOTAL_STEPS}
        onBack={goBack}
        onNext={goNext}
        onFinish={handleFinish}
        canProceed={canProceed}
      />
    </div>
  );
}
