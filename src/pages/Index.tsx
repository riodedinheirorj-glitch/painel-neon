import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, LogOut, Shield, Coins, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import StepIndicator from "@/components/StepIndicator";
import UploadStep from "@/components/UploadStep";
import ProcessingStep from "@/components/ProcessingStep";
import ResultsStep from "@/components/ResultsStep";
import BuyCreditsDialog from "@/components/BuyCreditsDialog";
import CreditsDisplay from "@/components/CreditsDisplay";
import * as XLSX from "xlsx";
import { toast } from "sonner"; // Usando toast do sonner
interface ProcessedData {
  [key: string]: any;
  sequences?: string;
}
import { getUserRole, insertDownload, getUserCredits, deductCredit } from "@/lib/supabase-helpers";
const Index = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Aguardando início...");
  const [processedData, setProcessedData] = useState<ProcessedData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [credits, setCredits] = useState(0);
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  
  useEffect(() => {
    // Check auth state
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        // Redirect to auth if not logged in
        navigate("/auth");
      }
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      } else {
        setIsAdmin(false);
        navigate("/auth");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const checkAdminStatus = async (userId: string) => {
    const data = await getUserRole(userId);
    setIsAdmin(!!data);

    // Load credits
    const userCredits = await getUserCredits(userId);
    setCredits(userCredits);
  };

  // Listen to real-time credit updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-credits-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log('Credits updated:', payload);
          const newCredits = (payload.new as any).credits;
          setCredits(newCredits);
          
          // Show toast when credits are added
          if (newCredits > credits) {
            toast.success(`+${newCredits - credits} créditos adicionados!`, {
              description: `Novo saldo: ${newCredits} créditos`
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, credits]);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Você saiu da sua conta"); // Usando toast do sonner
    navigate("/auth");
  };

  // Removido - sem normalização

  const processFile = async (file: File) => {
    setCurrentStep(2);
    setIsProcessing(true);
    setProgress(10);
    setStatus("Lendo arquivo...");
    try {
      const data = await file.arrayBuffer();
      setProgress(30);
      setStatus("Analisando dados...");
      
      // Opções específicas para lidar com arquivos em mobile
      const workbook = XLSX.read(data, {
        type: 'array',
        cellDates: true,
        cellNF: false,
        cellText: false,
        WTF: false // Desabilita warnings que podem causar problemas
      });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      console.log("Total de linhas na planilha:", jsonData.length);
      if (!jsonData || jsonData.length === 0) {
        throw new Error("Planilha vazia ou sem dados válidos");
      }
      setProgress(50);
      setStatus("Identificando endereços...");
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(70);
      setStatus("Agrupando por endereço...");

      // Encontrar coluna de endereço
      const addressColumn = Object.keys(jsonData[0] || {}).find(key => key.toLowerCase().includes('endereco') || key.toLowerCase().includes('endereço') || key.toLowerCase().includes('address') || key.toLowerCase().includes('rua'));

      // Encontrar coluna de sequence
      const sequenceColumn = Object.keys(jsonData[0] || {}).find(key => key.toLowerCase().includes('sequence') || key.toLowerCase().includes('sequencia'));
      if (!addressColumn) {
        throw new Error("Coluna de endereço não encontrada na planilha");
      }

      // Função para normalizar endereço (extrair rua + número, ignorando complementos)
      const normalizeAddress = (address: string): string => {
        // Remove espaços extras
        const cleaned = address.trim().replace(/\s+/g, ' ');
        
        // Tenta extrair: Nome da Rua + Número
        // Exemplos: "Rua Justo de Morais, 21, Casa" -> "Rua Justo de Morais, 21"
        const match = cleaned.match(/^(.+?[,\s]+\d+)/);
        if (match) {
          return match[1].trim();
        }
        
        // Se não encontrar número, retorna o endereço completo
        return cleaned;
      };

      // Agrupar por endereço normalizado (rua + número)
      const grouped: {
        [key: string]: any[];
      } = {};
      jsonData.forEach((row: any) => {
        const fullAddress = String(row[addressColumn] || '').trim();
        const normalizedAddress = normalizeAddress(fullAddress);
        
        if (!grouped[normalizedAddress]) {
          grouped[normalizedAddress] = [];
        }
        grouped[normalizedAddress].push(row);
      });

      // Processar cada grupo
      const results = Object.entries(grouped).map(([address, rows]) => {
        // Pegar o primeiro registro como base
        const firstRow = {
          ...rows[0]
        };

        // Se tem coluna de sequence, juntar todos os valores na coluna original
        if (sequenceColumn) {
          const sequences = rows.map(r => String(r[sequenceColumn] || '')).filter(s => s && s.trim() !== '').join('; ');
          firstRow[sequenceColumn] = sequences;
        }

        return firstRow;
      });
      console.log("Total de linhas originais:", jsonData.length);
      console.log("Total de endereços únicos:", results.length);
      
      // AI-powered address and coordinate correction
      setProgress(70);
      setStatus(`Corrigindo endereços com IA (${results.length} endereços)...`);
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: Correção demorou muito')), 120000) // 2 minutes
        );
        
        const correctionPromise = supabase.functions.invoke('correct-addresses', {
          body: { rows: results }
        });

        const { data: correctionData, error: correctionError } = await Promise.race([
          correctionPromise,
          timeoutPromise
        ]) as any;

        if (correctionError) {
          console.error("Error correcting addresses:", correctionError);
          toast.warning("Não foi possível corrigir todos os endereços, usando dados originais");
          setProcessedData(results);
        } else {
          const correctedResults = correctionData?.correctedRows || results;
          console.log("Endereços corrigidos pela IA");
          setProcessedData(correctedResults);
        }
      } catch (error) {
        console.error("Error in AI correction:", error);
        if (error instanceof Error && error.message.includes('Timeout')) {
          toast.warning("Correção demorou muito, usando dados originais");
        } else {
          toast.warning("Erro ao corrigir endereços, usando dados originais");
        }
        setProcessedData(results);
      }
      
      setProgress(90);
      setStatus("Finalizando...");
      await new Promise(resolve => setTimeout(resolve, 500));

      // Store total count
      (window as any).totalSequencesCount = jsonData.length;
      setProgress(100);
      setIsProcessing(false);

      await new Promise(resolve => setTimeout(resolve, 1000));
      setCurrentStep(3);
      toast.success(`Processamento concluído! ${results.length} endereços únicos de ${jsonData.length} registros`); // Usando toast do sonner
    } catch (error) {
      console.error("Erro ao processar arquivo:", error);
      toast.error(error instanceof Error ? error.message : "Verifique o formato e tente novamente."); // Usando toast do sonner
      setCurrentStep(1);
      setIsProcessing(false);
    }
  };
  const handleReset = () => {
    setCurrentStep(1);
    setProgress(0);
    setStatus("Aguardando início...");
    setProcessedData([]);
    setIsProcessing(false);
  };
  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!user) {
      toast.error("Usuário não autenticado"); // Usando toast do sonner
      return;
    }

    // Check credits
    if (credits < 1) {
      toast.error("Compre mais créditos para continuar", { // Usando toast do sonner
        description: "Créditos insuficientes",
      });
      setShowBuyCredits(true);
      return;
    }

    // Deduct credit using atomic RPC function
    const { data, error } = await (supabase as any).rpc('deduct_credit', { user_id: user.id });
    if (error || !data || !data[0]?.success) {
      toast.error(data?.[0]?.error_msg || error?.message || "Erro ao descontar crédito");
      return;
    }

    // Update local credits
    setCredits(prev => prev - 1);

    // Track download after successful credit deduction
    await insertDownload(user.id, `download_${format}_${new Date().toISOString()}`);

    // Exporta com os mesmos campos originais
    const exportData = processedData;
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agrupados por Endereço");
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const fileName = `RotaSmart-${day}-${month}-${year}`;
    if (format === 'xlsx') {
      XLSX.writeFile(wb, `${fileName}.xlsx`);
    } else {
      XLSX.writeFile(wb, `${fileName}.csv`);
    }
    toast.success(`Arquivo exportado! Seu arquivo ${format.toUpperCase()} foi baixado com sucesso. Créditos restantes: ${credits - 1}`);
  };
  return <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-float" style={{
        animationDelay: '1s'
      }}></div>
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-accent/10 rounded-full blur-3xl animate-float" style={{
        animationDelay: '2s'
      }}></div>
      </div>
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* User Menu */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
          {user ? <>
              <CreditsDisplay credits={credits} />
              <Button variant="outline" size="sm" onClick={() => setShowBuyCredits(true)} className="hidden sm:flex border-primary/50 hover:bg-primary/10">
                <Coins className="mr-2 h-4 w-4" />
                Comprar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowBuyCredits(true)} className="sm:hidden border-primary/50 hover:bg-primary/10">
                <Coins className="mr-1.5 h-4 w-4" />
                Comprar
              </Button>
              {isAdmin && <Button variant="secondary" size="sm" onClick={() => navigate("/admin")} className="hidden sm:flex">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin
                </Button>}
              {isAdmin && <Button variant="secondary" size="sm" onClick={() => navigate("/admin")} className="sm:hidden">
                  <Shield className="h-4 w-4" />
                </Button>}
              <Button variant="outline" size="sm" onClick={handleLogout} className="hidden sm:flex">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout} className="sm:hidden">
                <LogOut className="h-4 w-4" />
              </Button>
            </> : <>
              <Button variant="default" size="sm" onClick={() => navigate("/auth")} className="hidden sm:flex">
                <User className="mr-2 h-4 w-4" />
                Entrar
              </Button>
              <Button variant="default" size="sm" onClick={() => navigate("/auth")} className="sm:hidden">
                <User className="h-4 w-4" />
              </Button>
            </>}
        </div>

        <BuyCreditsDialog open={showBuyCredits} onOpenChange={setShowBuyCredits} userId={user?.id || ""} />

        <header className="text-center mb-8 sm:mb-12 px-4 py-6 sm:py-8">
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3 sm:mb-4 animate-float">
            <img src="/rotasmart-logo.png" alt="RotaSmart Logo" className="h-[120px] sm:h-[160px] w-auto" />
          </div>
          {currentStep !== 3 && (
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Gerencie suas rotas de entrega com eficiência. Otimize endereços, agrupe pedidos e exporte dados organizados.
            </p>
          )}
        </header>

        <StepIndicator currentStep={currentStep} />

        <div className="max-w-4xl mx-auto">
          {currentStep === 1 && user && <UploadStep onFileUpload={processFile} isAuthenticated={!!user} onAuthRequired={() => {
          toast.error("Autenticação necessária - Faça login para processar arquivos");
          navigate("/auth");
        }} />}
          
          {currentStep === 2 && <ProcessingStep progress={progress} status={status} isComplete={!isProcessing && progress === 100} />}
          
          {currentStep === 3 && <ResultsStep data={processedData} onExport={handleExport} onReset={handleReset} totalSequences={(window as any).totalSequencesCount || processedData.reduce((sum, row) => sum + row.orderCount, 0)} />}
        </div>
      </div>

      {/* WhatsApp Support Button */}
      <a
        href="https://wa.me/5521977074612"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center group"
        aria-label="Contato via WhatsApp"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute right-full mr-3 bg-card text-foreground px-3 py-2 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm font-medium">
          Precisa de ajuda? Fale conosco!
        </span>
      </a>
    </div>;
};
export default Index;