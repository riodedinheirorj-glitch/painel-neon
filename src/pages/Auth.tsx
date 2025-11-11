import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { z } from "zod";
import { getUserRole } from "@/lib/supabase-helpers";
import { Eye, EyeOff } from "lucide-react";
import confetti from "canvas-confetti";
import { WelcomeDialog } from "@/components/WelcomeDialog";

// Função para traduzir erros do Supabase
const translateSupabaseError = (errorMessage: string): string => {
  const errorMap: Record<string, string> = {
    "Invalid login credentials": "Email ou senha inválidos",
    "Email not confirmed": "Email não confirmado",
    "User already registered": "Este email já está cadastrado",
    "Password should be at least 6 characters": "A senha deve ter no mínimo 6 caracteres",
    "Unable to validate email address: invalid format": "Formato de email inválido",
    "Invalid email or password": "Email ou senha inválidos",
    "Email link is invalid or has expired": "Link de email inválido ou expirado",
    "Token has expired or is invalid": "Token expirado ou inválido",
    "New password should be different from the old password": "A nova senha deve ser diferente da senha antiga",
  };

  return errorMap[errorMessage] || errorMessage;
};

// Validation schemas
const authSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255, "Email muito longo"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").max(100, "Senha muito longa"),
});

const signupSchema = authSchema.extend({
  fullName: z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo"),
});

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "update-password">("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeCredits, setWelcomeCredits] = useState(0);

  // Detectar recuperação de senha
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth event:", event, "Session:", session);
      if (event === "PASSWORD_RECOVERY") {
        setMode("update-password");
      }
    });

    // Processar sessão e verificar se há token de recuperação
    const checkRecoveryToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log("Session data on load:", session);
      
      if (session?.user) {
        // Se há sessão válida, mostra o formulário de atualização
        setMode("update-password");
      }
    };

    checkRecoveryToken();

    return () => subscription?.unsubscribe();
  }, []);

  // Função para disparar confetes
  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 999999 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    try {
      authSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return;
    }
    
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if user is admin
      const roles = await getUserRole(data.user.id);

      // Verificar se é o primeiro login do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('email', email.trim().toLowerCase())
        .single();

      const isFirstLogin = profile && new Date(profile.created_at).getTime() > Date.now() - 60000; // Criado nos últimos 60 segundos

      if (isFirstLogin) {
        triggerConfetti();
        setWelcomeCredits(3);
        setShowWelcome(true);
      } else {
        toast.success("Login realizado com sucesso!");
      }
      
      // Redirect to admin dashboard if user is admin, otherwise to home
      setTimeout(() => {
        if (roles) {
          navigate("/admin");
        } else {
          navigate("/");
        }
      }, isFirstLogin ? 100 : 0);
    } catch (error: any) {
      // Verificar se o email existe no banco de dados
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (!profile) {
        toast.error("Este email não está cadastrado. Por favor, faça o cadastro primeiro.");
      } else {
        const errorMessage = error.message ? translateSupabaseError(error.message) : "Erro ao fazer login";
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    try {
      signupSchema.parse({ email, password, fullName });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // Disparar confetes e mostrar popup de boas-vindas
      triggerConfetti();
      setWelcomeCredits(3);
      setShowWelcome(true);

      toast.success("Conta criada com sucesso! Você já pode fazer login.");
      
      // Aguardar um pouco antes de mudar para login
      setTimeout(() => {
        setMode("login");
      }, 100);
    } catch (error: any) {
      const errorMessage = error.message ? translateSupabaseError(error.message) : "Erro ao criar conta";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    try {
      z.object({ email: z.string().trim().email("Email inválido") }).parse({ email });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;

      toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
      setMode("login");
    } catch (error: any) {
      const errorMessage = error.message ? translateSupabaseError(error.message) : "Erro ao enviar email de recuperação";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    if (password.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success("Senha atualizada com sucesso! Você já pode fazer login.");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      const errorMessage = error.message ? translateSupabaseError(error.message) : "Erro ao atualizar senha";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <WelcomeDialog 
        open={showWelcome} 
        onClose={() => setShowWelcome(false)} 
        credits={welcomeCredits}
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-background/95 backdrop-blur-sm border-2 border-primary/20">
        <div className="text-center space-y-2">
          <img src="/rotasmart-logo.png" alt="RotaSmart Logo" className="h-[100px] sm:h-[150px] w-auto mx-auto mb-4" />
          <p className="text-muted-foreground">
            {mode === "login" && "Entre na sua conta"}
            {mode === "signup" && "Crie sua conta"}
            {mode === "reset" && "Recuperar senha"}
            {mode === "update-password" && "Defina sua nova senha"}
          </p>
        </div>

        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative"> {/* Adicionado div para posicionamento do botão */}
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"} // Alterna o tipo do input
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-1 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowPassword((prev) => !prev)} // Alterna o estado
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative"> {/* Adicionado div para posicionamento do botão */}
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"} // Alterna o tipo do input
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-1 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowPassword((prev) => !prev)} // Alterna o estado
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar email de recuperação"}
            </Button>
          </form>
        )}

        {mode === "update-password" && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-1 text-muted-foreground hover:bg-transparent"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar senha</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar senha"}
            </Button>
          </form>
        )}

        <div className="text-center space-y-2 text-sm">
          {mode === "login" && (
            <>
              <button
                type="button"
                onClick={() => setMode("reset")}
                className="text-primary hover:underline block relative z-10"
              >
                Esqueceu sua Senha ?
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-primary hover:underline block relative z-10"
              >
                Não tem conta? Criar uma
              </button>
            </>
          )}
          {mode === "signup" && (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-primary hover:underline relative z-10"
            >
              Já tem conta? Entrar
            </button>
          )}
          {mode === "reset" && (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-primary hover:underline relative z-10"
            >
              Voltar para login
            </button>
          )}
          {mode === "update-password" && (
            <button
              type="button"
              onClick={() => setMode("login")}
              className="text-primary hover:underline relative z-10"
            >
              Voltar para login
            </button>
          )}
        </div>
      </Card>
    </div>
    </>
  );
}