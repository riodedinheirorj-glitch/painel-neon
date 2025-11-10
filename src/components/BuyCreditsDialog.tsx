import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { createCreditPurchase } from "@/lib/supabase-helpers";
import { Coins, QrCode, Loader2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { generatePixQrCode, checkPaymentStatus } from "@/lib/abacate-pay";
import { supabase } from "@/integrations/supabase/client";

interface BuyCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const CREDIT_PACKAGES = [
  { credits: 10, price: 10, description: "Pacote Básico" },
  { credits: 20, price: 15, description: "Pacote Popular" },
  { credits: 30, price: 25, description: "Pacote Premium" },
];

// Zod schema para os novos campos de entrada
const pixDetailsSchema = z.object({
  name: z.string().trim().min(3, "Nome completo é obrigatório").max(100, "Nome muito longo"),
  phone: z.string().trim().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, "Telefone inválido (ex: (XX) XXXX-XXXX)").min(14, "Telefone inválido").max(15, "Telefone inválido"),
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  cpf: z.string().trim().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido (ex: 000.000.000-00)").min(14, "CPF inválido").max(14, "CPF inválido"),
});

type PixDetails = z.infer<typeof pixDetailsSchema>;

export default function BuyCreditsDialog({ open, onOpenChange, userId }: BuyCreditsDialogProps) {
  const [step, setStep] = useState<'selectPackage' | 'enterDetails' | 'showQrCode' | 'paymentConfirmed'>('selectPackage');
  const [selectedPackage, setSelectedPackage] = useState<typeof CREDIT_PACKAGES[0] | null>(null);
  const [pixDetails, setPixDetails] = useState<PixDetails>({ name: '', phone: '', email: '', cpf: '' });
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [pixCopyPasteCode, setPixCopyPasteCode] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [loadingQrCode, setLoadingQrCode] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    if (open && userId) {
      // Buscar email e nome completo do usuário para pré-preencher
      const fetchUserData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setPixDetails(prev => ({
            ...prev,
            email: user.email || '',
            name: (user.user_metadata?.full_name as string) || '',
          }));
        }
      };
      fetchUserData();
    }
  }, [open, userId]);

  // Polling automático para verificar pagamento
  useEffect(() => {
    if (step !== 'showQrCode' || !transactionId) return;

    const checkInterval = setInterval(async () => {
      try {
        const { status } = await checkPaymentStatus(transactionId);
        
        if (status === 'PAID') {
          clearInterval(checkInterval);
          setStep('paymentConfirmed');
          toast.success("Pagamento confirmado! Seus créditos já estão disponíveis.");
        }
      } catch (error) {
        console.error('Erro ao verificar pagamento automaticamente:', error);
      }
    }, 5000); // Verifica a cada 5 segundos

    return () => clearInterval(checkInterval);
  }, [step, transactionId]);

  const handleSelectPackage = (pkg: typeof CREDIT_PACKAGES[0]) => {
    setSelectedPackage(pkg);
    setStep('enterDetails');
  };

  const handleGenerateQrCode = async () => {
    if (!selectedPackage) {
      toast.error("Nenhum pacote selecionado.");
      return;
    }

    setLoadingQrCode(true);

    try {
      // Validar campos de entrada
      pixDetailsSchema.parse(pixDetails);

      // Chamar a API Abacate Pay primeiro para obter o transactionId
      const pixResponse = await generatePixQrCode({
        amount: selectedPackage.price,
        name: pixDetails.name,
        email: pixDetails.email,
        cellphone: pixDetails.phone,
        taxId: pixDetails.cpf,
        description: `Compra de ${selectedPackage.credits} créditos`,
      });

      // Criar pedido de compra de crédito no Supabase com o transactionId
      const { data: purchaseData, error: purchaseError } = await supabase
        .from("credit_purchases")
        .insert({
          user_id: userId,
          credits: selectedPackage.credits,
          amount_brl: selectedPackage.price,
          gateway_charge_id: pixResponse.transactionId
        })
        .select()
        .single();

      if (purchaseError) {
        throw new Error(purchaseError.message || "Erro ao criar pedido de compra.");
      }

      setQrCodeImage(pixResponse.qrCodeImage);
      setPixCopyPasteCode(pixResponse.pixCopyPasteCode);
      setTransactionId(pixResponse.transactionId);
      setStep('showQrCode');
      toast.success("QR Code PIX gerado com sucesso!");

    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error((error as Error).message || "Erro ao gerar QR Code PIX.");
      }
    } finally {
      setLoadingQrCode(false);
    }
  };

  const handleClose = () => {
    // Reload page to update credits display
    if (step === 'paymentConfirmed') {
      window.location.reload();
    }
    
    setSelectedPackage(null);
    setStep('selectPackage');
    setPixDetails({ name: '', phone: '', email: '', cpf: '' });
    setQrCodeImage(null);
    setPixCopyPasteCode(null);
    setTransactionId(null);
    onOpenChange(false);
  };

  const handleCheckPayment = async () => {
    if (!transactionId || !selectedPackage) {
      toast.error("Informações do pagamento não encontradas.");
      return;
    }

    setCheckingPayment(true);

    try {
      const paymentStatus = await checkPaymentStatus(transactionId);

      if (paymentStatus.status === "PENDING") {
        toast.info("Pagamento ainda não confirmado. Aguarde alguns instantes.");
      } else {
        // Pagamento confirmado
        setStep('paymentConfirmed');
        toast.success("Pagamento confirmado! Seus créditos já estão disponíveis.");
      }
    } catch (error) {
      toast.error((error as Error).message || "Erro ao verificar pagamento.");
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleCopyPixCode = () => {
    if (pixCopyPasteCode) {
      navigator.clipboard.writeText(pixCopyPasteCode);
      toast.success("Código PIX copiado!");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2">
            <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Comprar Créditos
          </DialogTitle>
        </DialogHeader>

        {step === 'selectPackage' && (
          <div className="space-y-4 py-4">
            <p className="text-sm sm:text-base text-muted-foreground">
              Selecione um pacote de créditos para continuar:
            </p>
            <div className="grid gap-4">
              {CREDIT_PACKAGES.map((pkg) => (
                <Card
                  key={pkg.credits}
                  className="p-4 hover:border-primary transition-all cursor-pointer bg-gradient-to-br from-card to-primary/5"
                  onClick={() => handleSelectPackage(pkg)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-lg sm:text-xl">{pkg.description}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {pkg.credits} créditos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl sm:text-2xl font-bold text-primary">
                        R$ {pkg.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {step === 'enterDetails' && selectedPackage && (
          <div className="space-y-6 py-4">
            <h3 className="text-lg sm:text-xl font-bold text-foreground text-center">
              Detalhes do Pagamento - {selectedPackage.description} (R$ {selectedPackage.price.toFixed(2)})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input
                  id="name"
                  value={pixDetails.name}
                  onChange={(e) => setPixDetails(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                <Input
                  id="phone"
                  value={pixDetails.phone}
                  onChange={(e) => setPixDetails(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(XX) XXXXX-XXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={pixDetails.email}
                  onChange={(e) => setPixDetails(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="seu@email.com"
                  disabled // Email é pré-preenchido
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={pixDetails.cpf}
                  onChange={(e) => setPixDetails(prev => ({ ...prev, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
            <Button
              onClick={handleGenerateQrCode}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
              disabled={loadingQrCode}
            >
              {loadingQrCode ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando QR Code...
                </>
              ) : (
                <>
                  <QrCode className="mr-2 h-4 w-4" />
                  Criar QR Code PIX
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setStep('selectPackage')} className="w-full">
              Voltar
            </Button>
          </div>
        )}

        {step === 'showQrCode' && selectedPackage && qrCodeImage && pixCopyPasteCode && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg shadow-lg">
                  <img src={qrCodeImage} alt="QR Code PIX" className="h-48 w-48 sm:h-64 sm:w-64" />
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="font-semibold text-base sm:text-lg">
                  Pague via PIX para continuar
                </p>
                <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Código PIX Copia e Cola:</p>
                    <p className="font-mono font-bold text-sm sm:text-base break-all">{pixCopyPasteCode.substring(0, 30)}...</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleCopyPixCode}>
                    Copiar
                  </Button>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="font-bold text-primary text-base sm:text-lg">
                    Valor: R$ {selectedPackage.price.toFixed(2)}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {selectedPackage.credits} créditos
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  ⏳ Após realizar o pagamento, clique no botão abaixo para verificar.
                </p>
              </div>
            </div>

            <Button 
              onClick={handleCheckPayment}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
              disabled={checkingPayment}
            >
              {checkingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando pagamento...
                </>
              ) : (
                "Já efetuei o pagamento"
              )}
            </Button>

            <Button 
              onClick={handleClose}
              className="w-full"
              variant="outline"
            >
              Cancelar
            </Button>
          </div>
        )}

        {step === 'paymentConfirmed' && selectedPackage && (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-6 bg-green-500/10 rounded-full">
                  <CheckCircle2 className="h-16 w-16 text-green-500" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-green-500">
                  Pagamento Confirmado!
                </h3>
                <p className="text-lg text-foreground">
                  Seus créditos já estão disponíveis.
                </p>
                <div className="p-4 bg-primary/10 rounded-lg">
                  <p className="text-xl font-bold text-primary">
                    +{selectedPackage.credits} créditos
                  </p>
                </div>
              </div>
            </div>

            <Button 
              onClick={handleClose}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              Começar a usar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}