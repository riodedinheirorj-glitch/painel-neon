import { Upload, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner"; // Usando toast do sonner
import { z } from "zod";

// Validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_FILE_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/vnd.ms-excel"
];

const fileSchema = z.object({
  size: z.number().max(MAX_FILE_SIZE, "Arquivo muito grande (máx. 10MB)"),
  type: z.string().refine(
    (type) => ACCEPTED_FILE_TYPES.includes(type),
    "Formato inválido. Use .xlsx, .xls ou .csv"
  ),
});

interface UploadStepProps {
  onFileUpload: (file: File) => void;
  isAuthenticated: boolean;
  onAuthRequired: () => void;
}
const UploadStep = ({
  onFileUpload,
  isAuthenticated,
  onAuthRequired
}: UploadStepProps) => {
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAuthenticated) {
      onAuthRequired();
      return;
    }
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file using Zod schema
    try {
      fileSchema.parse({
        size: file.size,
        type: file.type,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      // Reset input
      e.target.value = '';
      return;
    }
    
    onFileUpload(file);
  };
  return <Card className="p-4 sm:p-8 border-2 border-dashed border-primary/50 bg-card/50 backdrop-blur-sm shadow-lg shadow-primary/10 hover:border-primary hover:shadow-primary/30 transition-all duration-300 animate-fade-in">
      <div className="flex flex-col items-center justify-center space-y-4 sm:space-y-6 text-center py-[7px]">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-lg shadow-primary/50 animate-float">
          <FileSpreadsheet className="w-8 h-8 sm:w-10 sm:h-10 text-background" />
        </div>
        
        <div className="space-y-2 px-4">
          <h3 className="text-xl sm:text-2xl font-semibold text-foreground">
            Upload da Planilha
          </h3>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md">
            Envie seu arquivo Excel (.xlsx) ou CSV contendo as ordens de entrega
          </p>
        </div>

        <div className="space-y-3 w-full max-w-sm">
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="relative group transition-transform duration-300 hover:scale-105">
              {/* Background with border */}
              <div className="relative rounded-lg bg-[#1a1d24] shadow-[inset_0_2px_10px_rgba(0,0,0,0.8),0_4px_20px_rgba(0,0,0,0.5)] overflow-visible">
                <div className="absolute inset-[1px] rounded-lg border border-[#2a2d34]"></div>
                
                {/* Bottom neon glow - static subtle highlight */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-12 bg-[#00baff] opacity-40 blur-xl rounded-full animate-pulse-glow pointer-events-none"></div>
                
                {/* Button content */}
                <div className="relative z-10 px-8 py-4 bg-gradient-to-br from-[#1f2229] to-[#16181d] rounded-lg shadow-[inset_0_2px_6px_rgba(0,0,0,0.7),inset_0_-2px_6px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-center gap-2 text-[#00baff] font-semibold text-lg">
                    <Upload className="w-5 h-5" />
                    Selecionar Arquivo
                  </div>
                </div>
                
                {/* Subtle top highlight on surface */}
                <div className="absolute top-[8%] left-[25%] w-[50%] h-[15%] bg-gradient-to-b from-white/5 to-transparent rounded-full blur-sm pointer-events-none z-20"></div>
              </div>
            </div>
            
            <input id="file-upload" type="file" accept=".xlsx,.csv,.xls" onChange={handleFileChange} className="hidden" />
          </label>

          <p className="text-xs text-muted-foreground text-center">
            Formatos aceitos: .xlsx, .csv (máx. 10MB)
          </p>
        </div>
      </div>
    </Card>;
};
export default UploadStep;