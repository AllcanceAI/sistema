import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
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
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src={hmLogo.url}
            alt="HM Auto Elétrica"
            className="mx-auto mb-4 w-56 max-w-full"
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {firstAccess ? "Primeiro acesso — crie a conta do dono" : "Acesso restrito à equipe"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="panel space-y-4 p-5">

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={firstAccess ? 8 : 1}
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={loading || bootstrap.isPending}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {firstAccess ? "Criar acesso e entrar" : "Entrar"}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Senhas e permissões são definidas pelo dono. Em caso de perda de acesso, procure o dono
            da oficina.
          </p>
        </form>
      </div>
    </div>
  );
}
