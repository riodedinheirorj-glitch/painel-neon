import { Upload, Settings, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
}

const steps = [
  { id: 1, name: "Upload", icon: Upload },
  { id: 2, name: "Processamento", icon: Settings },
  { id: 3, name: "Resultados", icon: Download },
];

const StepIndicator = ({ currentStep }: StepIndicatorProps) => {
  return (
    <div className="w-full max-w-3xl mx-auto mb-6 sm:mb-8 px-4">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300",
                    isActive && "bg-gradient-to-br from-primary via-secondary to-accent shadow-lg shadow-primary/50 scale-110 animate-glow-pulse",
                    isComplete && "bg-gradient-to-br from-accent to-secondary shadow-md shadow-accent/30",
                    !isActive && !isComplete && "bg-muted/50 backdrop-blur-sm border border-border"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 sm:w-6 sm:h-6 transition-colors",
                      (isActive || isComplete) && "text-background",
                      !isActive && !isComplete && "text-muted-foreground"
                    )}
                  />
                </div>
                <span
                  className={cn(
                    "mt-1 sm:mt-2 text-xs sm:text-sm font-medium transition-colors hidden sm:block",
                    isActive && "text-primary",
                    isComplete && "text-accent",
                    !isActive && !isComplete && "text-muted-foreground"
                  )}
                >
                  {step.name}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="flex-1 h-1 mx-1 sm:mx-2 mb-4 sm:mb-6 rounded-full overflow-hidden bg-muted/30">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      currentStep > step.id ? "bg-gradient-to-r from-accent to-secondary w-full shadow-glow" : "w-0"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
