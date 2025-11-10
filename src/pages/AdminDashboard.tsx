import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Users, Download, LogOut, Coins, ShoppingCart, Plus, Minus, Check, X } from "lucide-react";
import { z } from "zod";
import { 
  getUserRole, 
  getProfiles, 
  getDownloads, 
  updateUserCredits,
  getPendingPurchases,
  approvePurchase,
  getTransactions
} from "@/lib/supabase-helpers";

interface UserStats {
  id: string;
  email: string;
  full_name: string | null;
  credits: number;
  download_count: number;
}

interface PendingPurchase {
  id: string;
  credits: number;
  amount_brl: number;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
}

// Validation schema
const creditAmountSchema = z.number()
  .int("Valor deve ser um número inteiro")
  .min(-10000, "Valor mínimo: -10000")
  .max(10000, "Valor máximo: 10000")
  .refine((val) => val !== 0, { message: "Valor não pode ser zero" });

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminId, setAdminId] = useState<string>("");
  const [totalUsers, setTotalUsers] = useState(0);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [creditInputs, setCreditInputs] = useState<{ [key: string]: string }>({});
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      // Server-side admin verification using RLS-protected query
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (roleError || !roleData) {
        toast.error("Acesso negado. Você não é um administrador.");
        navigate("/");
        return;
      }

      setIsAdmin(true);
      setAdminId(user.id);

      // Load user stats
      const { data: profiles, error: profilesError } = await getProfiles();

      if (profilesError) throw profilesError;

      setTotalUsers(profiles?.length || 0);

      // Get download counts for each user
      const statsPromises = profiles?.map(async (profile: any) => {
        const downloads = await getDownloads(profile.id);

        return {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          credits: profile.credits || 0,
          download_count: downloads?.length || 0,
        };
      }) || [];

      const stats = await Promise.all(statsPromises);
      setUserStats(stats);

      // Load pending purchases
      const { data: purchases } = await getPendingPurchases();
      
      // Delete pending purchases older than 10 minutes
      if (purchases && purchases.length > 0) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const expiredPurchaseIds = purchases
          .filter(p => new Date(p.created_at) < tenMinutesAgo)
          .map(p => p.id);
        
        if (expiredPurchaseIds.length > 0) {
          await supabase
            .from('credit_purchases')
            .delete()
            .in('id', expiredPurchaseIds);
          
          // Filter out expired purchases from the list
          const activePurchases = purchases.filter(p => !expiredPurchaseIds.includes(p.id));
          setPendingPurchases(activePurchases);
        } else {
          setPendingPurchases(purchases);
        }
      } else {
        setPendingPurchases([]);
      }

      // Load transactions
      const { data: trans } = await getTransactions();
      setTransactions(trans || []);

      // Calculate total revenue from approved purchases
      const { data: approvedPurchases } = await supabase
        .from('credit_purchases')
        .select('amount_brl')
        .eq('status', 'approved');

      if (approvedPurchases && approvedPurchases.length > 0) {
        const grossRevenue = approvedPurchases.reduce((acc, p) => acc + Number(p.amount_brl), 0);
        const fees = approvedPurchases.length * 0.80; // R$ 0,80 por transação
        const netRevenue = grossRevenue - fees;
        setTotalRevenue(netRevenue);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar dados do dashboard");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const handleUpdateCredits = async (userId: string, amount: number) => {
    // Validate credit amount
    try {
      creditAmountSchema.parse(amount);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return;
    }
    
    const result = await updateUserCredits(userId, amount, adminId);
    
    if (result.success) {
      toast.success("Créditos atualizados com sucesso!");
      await checkAdminAndLoadData();
      setCreditInputs({ ...creditInputs, [userId]: "" });
    } else {
      toast.error(result.error || "Erro ao atualizar créditos");
    }
  };

  const handleApprovePurchase = async (purchaseId: string) => {
    const result = await approvePurchase(purchaseId, adminId);
    
    if (result.success) {
      toast.success("Compra aprovada com sucesso!");
      await checkAdminAndLoadData();
    } else {
      toast.error(result.error || "Erro ao aprovar compra");
    }
  };

  const handleRejectPurchase = async (purchaseId: string) => {
    const { error } = await (supabase as any)
      .from("credit_purchases")
      .update({ status: "rejected" })
      .eq("id", purchaseId);
    
    if (!error) {
      toast.success("Compra rejeitada");
      await checkAdminAndLoadData();
    } else {
      toast.error("Erro ao rejeitar compra");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent text-center sm:text-left">
              Dashboard RotaSmart
            </h1>
            <p className="text-muted-foreground mt-2 text-center sm:text-left">
              Gerencie usuários e visualize estatísticas
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="w-full sm:w-auto">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 border-2 border-primary/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/20 rounded-lg">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Usuários</p>
                <p className="text-3xl font-bold">{totalUsers}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-secondary/10 to-accent/10 border-2 border-secondary/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-secondary/20 rounded-lg">
                <Download className="h-8 w-8 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Downloads</p>
                <p className="text-3xl font-bold">
                  {userStats.reduce((acc, user) => acc + user.download_count, 0)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-accent/10 to-primary/10 border-2 border-accent/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-accent/20 rounded-lg">
                <Coins className="h-8 w-8 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Créditos Vendidos</p>
                <p className="text-3xl font-bold text-green-600">
                  R$ {totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="purchases">
              Pedidos Pendentes
              {pendingPurchases.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                  {pendingPurchases.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="transactions">Histórico</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card className="p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-6">Gerenciar Usuários</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Nome</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Email</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Créditos</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Downloads</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userStats.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center p-8 text-muted-foreground text-sm">
                          Nenhum usuário cadastrado ainda
                        </td>
                      </tr>
                    ) : (
                      userStats.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3 text-xs sm:text-sm">{user.full_name || "Não informado"}</td>
                          <td className="p-3 text-xs sm:text-sm">{user.email}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary/10 text-primary font-medium text-xs">
                              <Coins className="h-3 w-3 mr-1" />
                              {user.credits}
                            </span>
                          </td>
                          <td className="p-3 text-xs sm:text-sm">{user.download_count}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Input
                                type="number"
                                placeholder="Qtd"
                                value={creditInputs[user.id] || ""}
                                onChange={(e) => setCreditInputs({ ...creditInputs, [user.id]: e.target.value })}
                                className="w-16 sm:w-20 text-xs sm:text-sm"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-primary hover:bg-primary/10 h-7 w-7 sm:h-8 sm:w-8 p-0"
                                onClick={() => {
                                  const amount = parseInt(creditInputs[user.id] || "0");
                                  if (amount > 0) handleUpdateCredits(user.id, amount);
                                }}
                              >
                                <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive hover:bg-destructive/10 h-7 w-7 sm:h-8 sm:w-8 p-0"
                                onClick={() => {
                                  const amount = parseInt(creditInputs[user.id] || "0");
                                  if (amount > 0) handleUpdateCredits(user.id, -amount);
                                }}
                              >
                                <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Pending Purchases Tab */}
          <TabsContent value="purchases">
            <Card className="p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
                Pedidos de Créditos Pendentes
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Usuário</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Créditos</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Valor</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPurchases.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center p-8 text-muted-foreground text-sm">
                          Nenhum pedido pendente
                        </td>
                      </tr>
                    ) : (
                      pendingPurchases.map((purchase) => (
                        <tr key={purchase.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3 text-xs sm:text-sm">
                            <div>
                              <p className="font-medium">{purchase.profiles.full_name || "Não informado"}</p>
                              <p className="text-xs text-muted-foreground">{purchase.profiles.email}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-primary/10 text-primary font-medium text-xs">
                              <Coins className="h-3 w-3 mr-1" />
                              {purchase.credits}
                            </span>
                          </td>
                          <td className="p-3 text-xs sm:text-sm">
                            <span className="font-bold text-green-600">
                              R$ {purchase.amount_brl.toFixed(2)}
                            </span>
                          </td>
                          <td className="p-3 text-xs sm:text-sm">
                            {new Date(purchase.created_at).toLocaleString('pt-BR')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card className="p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-6">Histórico de Transações</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Data</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Usuário</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Tipo</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Créditos</th>
                      <th className="text-left p-3 font-semibold text-xs sm:text-sm">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center p-8 text-muted-foreground text-sm">
                          Nenhuma transação registrada
                        </td>
                      </tr>
                    ) : (
                      transactions.map((trans) => (
                        <tr key={trans.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3 text-xs sm:text-sm">
                            {new Date(trans.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="p-3 text-xs sm:text-sm">
                            <div>
                              <p className="font-medium">{trans.profiles.full_name || "Não informado"}</p>
                              <p className="text-xs text-muted-foreground">{trans.profiles.email}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              trans.type === 'purchase' ? 'bg-green-100 text-green-700' :
                              trans.type === 'download' ? 'bg-red-100 text-red-700' :
                              trans.type === 'admin_add' ? 'bg-blue-100 text-blue-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {trans.type === 'purchase' ? 'Compra' :
                               trans.type === 'download' ? 'Download' :
                               trans.type === 'admin_add' ? 'Admin +' :
                               'Admin -'}
                            </span>
                          </td>
                          <td className="p-3 text-xs sm:text-sm">
                            <span className={`font-bold ${trans.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {trans.amount > 0 ? '+' : ''}{trans.amount}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {trans.description}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}