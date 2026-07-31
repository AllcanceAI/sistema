import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Mail, Eye, EyeOff, ShieldAlert } from "lucide-react";
import hmLogo from "@/assets/hm-logo.png.asset.json";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapOwner, needsBootstrap } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Acesso ao sistema — Oficina" },
      {
        name: "description",
        content:
          "Área restrita da oficina: ordens de serviço, checklists com fotos, orçamentos e aprovações por função.",
      },
      { property: "og:title", content: "Acesso ao sistema — Oficina" },
      {
        property: "og:description",
        content: "Sistema interno da oficina: ordens de serviço, checklists, orçamentos e aprovações.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const checkBootstrap = useServerFn(needsBootstrap);
  const runBootstrap = useServerFn(bootstrapOwner);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const fullName = "Dono";
  const [loading, setLoading] = useState(false);

  const bootstrap = useQuery({
    queryKey: ["needs-bootstrap"],
    queryFn: () => checkBootstrap(),
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/painel", replace: true });
    });
  }, [navigate]);

  const firstAccess = bootstrap.data?.needsBootstrap === true;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (firstAccess) {
        const result = await runBootstrap({ data: { email, password, fullName } });
        if (result.created) toast.success("Acesso do dono criado. Entrando…");
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("E-mail ou senha inválidos.");
      await queryClient.invalidateQueries();
      navigate({ to: "/painel", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* Embedded Animation Styles */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-8px) scale(1.02); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float {
          animation: float 5s ease-in-out infinite;
        }
        .animate-pulse-glow-1 {
          animation: pulseGlow 10s ease-in-out infinite;
        }
        .animate-pulse-glow-2 {
          animation: pulseGlow 12s ease-in-out infinite-reverse;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Dynamic Background Glows */}
      <div className="absolute -left-48 -top-48 h-96 w-96 rounded-full bg-blue-600/10 blur-[128px] animate-pulse-glow-1" />
      <div className="absolute -right-48 -bottom-48 h-96 w-96 rounded-full bg-red-600/10 blur-[128px] animate-pulse-glow-2" />
      <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-[160px]" />

      <div className="relative w-full max-w-md animate-fade-in-up">
        {/* Card wrapper */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-8 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:border-slate-700/50">
          <div className="mb-8 text-center">
            {/* Logo Container with floating animation */}
            <div className="inline-block animate-float">
              <img
                src={hmLogo.url}
                alt="HM Auto Elétrica"
                className="mx-auto h-auto w-52 max-w-full drop-shadow-[0_0_15px_rgba(59,130,246,0.2)]"
              />
            </div>
            <p className="mt-4 text-xs font-semibold tracking-wider text-slate-400 uppercase">
              {firstAccess ? "Primeiro Acesso — Criar Conta Master" : "Portal Administrativo"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {firstAccess && (
              <div className="flex gap-2 rounded-lg bg-blue-950/40 p-3 text-xs text-blue-300 border border-blue-900/30 animate-pulse">
                <ShieldAlert className="size-4 shrink-0 text-blue-400" />
                <p>Nenhuma conta master foi encontrada. Insira o e-mail e senha desejados para criar o usuário administrador.</p>
              </div>
            )}

            <div className="space-y-2 group">
              <Label htmlFor="email" className="text-xs font-semibold tracking-wide text-slate-350 transition-colors group-focus-within:text-blue-400">
                E-mail
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-400" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="h-11 border-slate-800 bg-slate-950/80 pl-10 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 hover:border-slate-700 focus:scale-[1.01]"
                />
              </div>
            </div>

            <div className="space-y-2 group">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold tracking-wide text-slate-350 transition-colors group-focus-within:text-blue-400">
                  Senha
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-blue-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={firstAccess ? 8 : 1}
                  autoComplete="current-password"
                  className="h-11 border-slate-800 bg-slate-950/80 px-10 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200 hover:border-slate-700 focus:scale-[1.01]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                  aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="relative mt-2 w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 focus:ring-2 focus:ring-blue-600/50 hover:shadow-blue-500/20 active:scale-[0.98] transition-all duration-350 ease-out cursor-pointer"
              disabled={loading || bootstrap.isPending}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Lock className="size-4" />
              )}
              <span>{firstAccess ? "Configurar e Entrar" : "Acessar Painel"}</span>
            </Button>

            <div className="border-t border-slate-800/80 pt-4 text-center">
              <p className="text-[11px] leading-relaxed text-slate-500">
                Acesso restrito a colaboradores autorizados da HM Auto Elétrica.
                Em caso de perda de credenciais, contate o administrador do sistema.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
