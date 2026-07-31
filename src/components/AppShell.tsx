import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import hmLogo from "@/assets/hm-logo.png.asset.json";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Wrench,
  Users,
  ClipboardList,
  LogOut,
  ShieldCheck,
  Radio,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe, hasRole } from "@/hooks/useMe";
import { ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: ReactNode };

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
  children: ReactNode;
}) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  const items: NavItem[] = [
    { to: "/painel", label: "Painel", icon: <LayoutDashboard className="size-5" /> },
    { to: "/ao-vivo", label: "Ao vivo", icon: <Radio className="size-5" /> },
    { to: "/os", label: "Ordens", icon: <Wrench className="size-5" /> },
    { to: "/cadastros", label: "Cadastros", icon: <ClipboardList className="size-5" /> },
  ];
  if (hasRole(me, "dono", "gerente", "contabilidade")) {
    items.push({ to: "/financeiro", label: "Caixa", icon: <Wallet className="size-5" /> });
  }
  if (hasRole(me, "dono")) {
    items.push({ to: "/usuarios", label: "Equipe", icon: <Users className="size-5" /> });
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden md:flex md:w-60 md:flex-col md:gap-1 md:bg-sidebar md:p-4">
        <div className="mb-6 px-2">
          <img
            src={hmLogo.url}
            alt="HM Auto Elétrica"
            className="mb-2 w-full max-w-[176px] rounded-md bg-surface p-2"
          />
          <p className="text-xs text-sidebar-foreground/60">Gestão de ordens de serviço</p>
        </div>
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground font-semibold" }}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
        <div className="mt-auto space-y-2 px-2 pt-4 text-xs text-sidebar-foreground/70">
          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-sidebar-primary" />
            {me?.roles.map((r) => ROLE_LABELS[r]).join(", ") || "—"}
          </p>
          <p className="truncate">{me?.fullName || me?.email}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
            onClick={signOut}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b bg-surface/95 px-4 py-3 shadow-panel backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-semibold leading-tight text-primary">
                {title}
              </h1>
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {action}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={signOut}
                aria-label="Sair"
              >
                <LogOut className="size-5" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4 pb-28 md:px-8 md:py-6 md:pb-8">{children}</main>

        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-flow-col bg-sidebar px-2 pt-2 md:hidden">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center gap-1 rounded-lg py-1 text-[11px] text-sidebar-foreground/65"
              activeProps={{ className: "text-sidebar-primary font-semibold" }}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

      </div>
    </div>
  );
}
