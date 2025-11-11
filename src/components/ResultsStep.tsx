import { Download, Eye, CheckCircle2, Package, MapPin, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
interface ProcessedData {
  [key: string]: any;
}
interface ResultsStepProps {
  data: ProcessedData[];
  onExport: (format: 'xlsx' | 'csv') => void;
  onReset: () => void;
  totalSequences: number;
}
const ResultsStep = ({
  data,
  onExport,
  onReset,
  totalSequences
}: ResultsStepProps) => {
  const totalStops = data.length;

  // Pegar os nomes das colunas do primeiro registro
  const allColumns = data.length > 0 ? Object.keys(data[0]) : [];

  // Função para traduzir nomes de colunas
  const translateColumnName = (col: string): string => {
    const translations: {
      [key: string]: string;
    } = {
      'Destination Address': 'Endereço do Cliente',
      'Sequence': 'Identificação do Pacote',
      'sequence': 'Identificação do Pacote',
      'Address': 'Endereço do Cliente',
      'address': 'Endereço do Cliente'
    };
    return translations[col] || col;
  };

  // Filtrar e ordenar colunas - apenas Endereço do Cliente e Identificação do Pacote
  const columns = allColumns.filter(col => {
    const translated = translateColumnName(col);
    return translated === 'Endereço do Cliente' || translated === 'Identificação do Pacote';
  }).sort((a, b) => {
    const translatedA = translateColumnName(a);
    const translatedB = translateColumnName(b);
    // Endereço do Cliente primeiro, Identificação do Pacote depois
    if (translatedA === 'Endereço do Cliente') return -1;
    if (translatedB === 'Endereço do Cliente') return 1;
    return 0;
  });
  return <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Success Message */}
      <div className="text-center space-y-3 mb-8">
        <div className="flex justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center animate-scale-in shadow-lg shadow-primary/30">
            <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary animate-glow-pulse" />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">Processamento Concluído!</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Endereços Corrigidos e Pacotes Agrupados por endereço </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-6 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 backdrop-blur-sm shadow-lg shadow-primary/10 hover:shadow-primary/20 transition-all">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm text-muted-foreground">Total de Paradas</p>
              <p className="text-3xl sm:text-4xl font-bold text-primary">{totalStops}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 border-2 border-secondary/30 bg-gradient-to-br from-secondary/5 to-secondary/10 backdrop-blur-sm shadow-lg shadow-secondary/10 hover:shadow-secondary/20 transition-all">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs sm:text-sm text-muted-foreground">Total de Pacotes</p>
              <p className="text-3xl sm:text-4xl font-bold text-secondary">{totalSequences}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-secondary/20 flex items-center justify-center">
              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-secondary" />
            </div>
          </div>
        </Card>
      </div>

      {/* Results Table */}
      <Card className="p-4 sm:p-6 border-2 border-primary/30 bg-card/50 backdrop-blur-sm shadow-lg shadow-primary/10">
        <div className="mb-6">
          <h3 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent flex items-center justify-center gap-2">
            <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Detalhes da sua Rota
          </h3>
        </div>

        <ScrollArea className="h-[300px] sm:h-[400px] rounded-md border border-primary/30 bg-card/30 mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col, idx) => <TableHead key={idx} className="text-xs sm:text-sm whitespace-nowrap">
                    {translateColumnName(col)}
                  </TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, rowIndex) => <TableRow key={rowIndex}>
                  {columns.map((col, colIndex) => <TableCell key={colIndex} className="text-xs sm:text-sm whitespace-nowrap">
                      {String(row[col] ?? '')}
                    </TableCell>)}
                </TableRow>)}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex flex-col-reverse sm:flex-row gap-2 w-full justify-end mt-6">
          <Button variant="outline" onClick={onReset} className="w-full sm:w-auto text-sm" size="sm">
            Carregar Novo Romaneio
          </Button>
          <Button onClick={() => onExport('xlsx')} className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary w-full sm:w-auto text-sm" size="sm">
            <Download className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            Baixar a Rota
          </Button>
        </div>
      </Card>
    </div>;
};
export default ResultsStep;