import { useEffect, useState } from "react";
import { Coins, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreditsDisplayProps {
  credits: number;
}

export default function CreditsDisplay({ credits }: CreditsDisplayProps) {
  const [prevCredits, setPrevCredits] = useState(credits);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    if (credits > prevCredits) {
      // Créditos aumentaram - mostrar animação
      setIsAnimating(true);
      setShowSparkles(true);
      
      const timer1 = setTimeout(() => setIsAnimating(false), 600);
      const timer2 = setTimeout(() => setShowSparkles(false), 1500);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
    setPrevCredits(credits);
  }, [credits, prevCredits]);

  return (
    <div className="relative">
      {showSparkles && (
        <>
          <Sparkles className="absolute -top-2 -left-2 h-4 w-4 text-yellow-400 animate-ping" />
          <Sparkles className="absolute -top-2 -right-2 h-4 w-4 text-yellow-400 animate-ping" style={{ animationDelay: '0.1s' }} />
          <Sparkles className="absolute -bottom-2 -left-1 h-3 w-3 text-yellow-400 animate-ping" style={{ animationDelay: '0.2s' }} />
          <Sparkles className="absolute -bottom-2 -right-1 h-3 w-3 text-yellow-400 animate-ping" style={{ animationDelay: '0.15s' }} />
        </>
      )}
      
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-lg transition-all duration-300",
        isAnimating 
          ? "bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-yellow-400/50 scale-110 shadow-yellow-500/50" 
          : "bg-gradient-to-r from-primary/20 to-secondary/20 border-primary/30"
      )}>
        <Coins className={cn(
          "h-4 w-4 transition-all duration-300",
          isAnimating ? "text-yellow-400 scale-125 animate-spin" : "text-primary"
        )} />
        <span className="font-bold text-sm flex items-center gap-1">
          <span className={cn(
            "transition-all duration-300",
            isAnimating ? "text-yellow-400 scale-110" : credits === 0 ? "text-red-500" : "text-white"
          )}>
            {credits}
          </span>
          <span className="text-primary">Saldo</span>
        </span>
      </div>
    </div>
  );
}
