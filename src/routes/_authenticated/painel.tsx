import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Car, Clock, FileCheck2, TriangleAlert, Plus, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useMe, can, hasRole } from "@/hooks/useMe";
import { OS_STATUS_LABELS, ROLE_LABELS, APPROVAL_STAGE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Oficina" },
      { name: "description", content: "Visão geral das ordens de serviço, prazos e aprovações pendentes." },
      { property: "og:title", content: "Painel — Oficina" },
      { property: "og:description", content: "Visão geral das ordens, prazos e aprovações pendentes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const { data: me } = useMe();

  const orders = useQuery({
    queryKey: ["orders", "painel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(
          "id, number, mode, status, complaint, promised_at, created_at, mechanic_id, vehicles(plate, brand, model), clients(name), companies(name)",
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const approvals = useQuery({
    queryKey: ["approvals", "pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select("id, stage, required_role, service_order_id, created_at, service_orders(number)")
        .eq("decision", "pendente")
        .order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const financeiro = useQuery({
    enabled: can(me, "ver_financeiro"),
    queryKey: ["quotes", "total"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotes").select("total");
      if (error) throw new Error(error.message);
      return (data ?? []).reduce((sum, q) => sum + Number(q.total ?? 0), 0);
    },
  });

  const list = orders.data ?? [];
  const mine = hasRole(me, "mecanico") ? list.filter((o) => o.mechanic_id === me?.userId) : list;
  const abertas = list.filter((o) => !["entregue", "cancelado"].includes(o.status));
  const atrasadas = abertas.filter((o) => o.promised_at && new Date(o.promised_at) < new Date());
  const minhasPendentes = (approvals.data ?? []).filter(
    (a) => me?.roles.includes(a.required_role as never) || hasRole(me, "dono"),
  );

  return (
    <AppShell
      title={`Olá, ${me?.fullName?.split(" ")[0] || "equipe"}`}
      subtitle={me?.roles.map((r) => ROLE_LABELS[r]).join(" · ")}
      action={
        can(me, "cadastrar_os") ? (
          <Button asChild size="sm">
            <Link to="/os/nova">
              <Plus className="size-4" /> Nova OS
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Car className="size-4" />} label="Carros na oficina" value={abertas.length} />
        <Stat
          icon={<Clock className="size-4" />}
          label="Prazo estourado"
          value={atrasadas.length}
          tone={atrasadas.length > 0 ? "warning" : "default"}
        />
        <Stat
          icon={<FileCheck2 className="size-4" />}
          label="Aprovações pendentes"
          value={minhasPendentes.length}
        />
        {can(me, "ver_financeiro") ? (
          <Stat
            icon={<DollarSign className="size-4" />}
            label="Orçamentos (total)"
            value={brl(financeiro.data ?? 0)}
          />
        ) : (
          <Stat icon={<Car className="size-4" />} label="Minhas ordens" value={mine.length} />
        )}
      </div>

      {minhasPendentes.length > 0 ? (
        <section className="panel mt-4 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl">
            <TriangleAlert className="size-4 text-warning" /> Aguardando sua assinatura
          </h2>
          <ul className="space-y-2">
            {minhasPendentes.map((a) => (
              <li key={a.id}>
                <Link
                  to="/os/$id"
                  params={{ id: a.service_order_id }}
                  className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2.5 text-sm"
                >
                  <span>
                    OS #{(a.service_orders as { number: number } | null)?.number} —{" "}
                    {APPROVAL_STAGE_LABELS[a.stage] ?? a.stage}
                  </span>
                  <Badge variant="outline">{ROLE_LABELS[a.required_role as never]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-4">
        <h2 className="mb-3 font-display text-xl">
          {hasRole(me, "mecanico") && !hasRole(me, "dono", "gerente")
            ? "Minhas ordens"
            : "Ordens recentes"}
        </h2>
        <div className="space-y-2">
          {mine.slice(0, 15).map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
          {mine.length === 0 ? (
            <p className="panel p-6 text-center text-sm text-muted-foreground">
              Nenhuma ordem de serviço ainda.
            </p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

function Stat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="panel p-3">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p
        className={`mt-1 font-display text-3xl leading-none ${tone === "warning" ? "text-warning" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

export function OrderCard({
  order,
}: {
  order: {
    id: string;
    number: number;
    mode: string;
    status: string;
    complaint: string | null;
    promised_at: string | null;
    vehicles: { plate: string; brand: string | null; model: string | null } | null;
    clients: { name: string } | null;
    companies: { name: string } | null;
  };
}) {
  const late = order.promised_at && new Date(order.promised_at) < new Date();
  return (
    <Link
      to="/os/$id"
      params={{ id: order.id }}
      className="panel block p-3 transition-colors active:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl leading-none">
            {order.vehicles?.plate ?? "SEM PLACA"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            #{order.number} · {order.vehicles?.brand ?? ""} {order.vehicles?.model ?? ""} ·{" "}
            {order.companies?.name ?? order.clients?.name ?? "—"}
          </p>
        </div>
        <Badge variant={order.mode === "express" ? "default" : "secondary"}>
          {order.mode === "express" ? "Express" : "Análise"}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <Badge variant="outline">{OS_STATUS_LABELS[order.status] ?? order.status}</Badge>
        {order.promised_at ? (
          <span className={late ? "text-warning" : "text-muted-foreground"}>
            Prazo: {new Date(order.promised_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
