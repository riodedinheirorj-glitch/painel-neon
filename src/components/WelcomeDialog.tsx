import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift, Sparkles } from "lucide-react";

interface WelcomeDialogProps {
  open: boolean;
  onClose: () => void;
  credits: number;
}

export function WelcomeDialog({ open, onClose, credits }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <Gift className="h-16 w-16 text-primary animate-bounce" />
              <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-2 -right-2 animate-pulse" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            Bem-vindo ao RotaSmart! 🎉
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-4 space-y-3">
            <p className="text-lg font-semibold text-primary">
              Você ganhou {credits} créditos grátis!
            </p>
            <p>
              Comece agora a otimizar suas rotas de entrega e economize tempo e combustível.
            </p>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-4">
          <Button onClick={onClose} className="w-full sm:w-auto px-8">
            Começar agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
