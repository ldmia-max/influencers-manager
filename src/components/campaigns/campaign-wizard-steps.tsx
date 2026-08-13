"use client";

import { cn } from "@/lib/utils";
import { WIZARD_STEPS, type WizardStep } from "@/models/campaign";

interface CampaignWizardStepsProps {
  currentStep: WizardStep;
  onStepClick: (step: WizardStep) => void;
}

export function CampaignWizardSteps({
  currentStep,
  onStepClick,
}: CampaignWizardStepsProps) {
  return (
    <div className="bg-white border rounded-lg px-6 py-3">
      <div className="flex items-center justify-between relative">
        {/* Track background */}
        <div className="absolute top-3 left-0 w-full h-0.5 bg-gray-200" />
        {/* Track progress */}
        <div
          className="absolute top-3 left-0 h-0.5 bg-primary transition-all duration-300"
          style={{ width: `${((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100}%` }}
        />

        {WIZARD_STEPS.map(({ step, label }) => (
          <div
            key={step}
            className="relative z-10 flex flex-col items-center gap-1.5 cursor-pointer"
            onClick={() => {
              if (step < currentStep) onStepClick(step as WizardStep);
            }}
          >
            <div
              className={cn(
                "size-6 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                currentStep >= step
                  ? "bg-primary text-white shadow-sm shadow-primary/30"
                  : "bg-gray-200 text-gray-500"
              )}
            >
              {step}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                currentStep >= step ? "text-primary" : "text-gray-400"
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
