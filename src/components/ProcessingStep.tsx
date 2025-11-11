import { Loader2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ProcessingStepProps {
  progress: number;
  status: string;
  isComplete: boolean;
}

const ProcessingStep = ({ progress, status, isComplete }: ProcessingStepProps) => {
  return (
    <Card className="rounded-lg text-card-foreground p-4 sm:p-8 border-2 border-primary/30 bg-card/50 backdrop-blur-sm shadow-lg shadow-primary/10 animate-fade-in">
      <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 text-center px-4">
        {!isComplete ? (
          <>
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-lg shadow-primary/50 animate-glow-pulse">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-background animate-spin" />
            </div>
            
            <div className="space-y-2 w-full max-w-md">
              <h3 className="text-xl sm:text-2xl font-semibold text-foreground animate-shimmer bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Processando Dados
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground">
                {status}
              </p>
            </div>

            <div className="w-full max-w-md space-y-2">
              <Progress value={progress} className="h-2 bg-muted/30 border border-primary/20" />
              <p className="text-sm text-muted-foreground">
                {progress}% concluído
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent via-secondary to-primary flex items-center justify-center shadow-lg shadow-accent/50 animate-float">
              <CheckCircle2 className="w-10 h-10 text-background" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                Processamento Concluído!
              </h3>
              <p className="text-muted-foreground">
                Seus dados foram normalizados e agrupados com sucesso
              </p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
};

export default ProcessingStep;