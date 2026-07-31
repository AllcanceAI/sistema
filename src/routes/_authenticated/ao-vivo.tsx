import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Radio, Clock, Car, User, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { OS_STATUS_LABELS } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/ao-vivo")({
  head: () => ({
    meta: [
      { title: "Ao vivo — Oficina" },
      {
        name: "description",
        content: "Quadro ao vivo dos carros na oficina, atualizado em tempo real em todos os aparelhos.",
      },
      { property: "og:title", content: "Ao vivo — Oficina" },
      {
        property: "og:description",
        content: "Acompanhe o andamento dos serviços em tempo real, no computador ou no celular.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AoVivo,
});

const COLUMNS: { key: string; statuses: string[] }[] = [
  { key: "Recebido", statuses: ["recebido", "checklist"] },
  { key: "Diagnóstico", statuses: ["diagnostico", "orcamento", "aguardando_aprovacao"] },
  { key: "Autorizado", statuses: ["aprovado", "compra_pecas"] },
  { key: "Em execução", statuses: ["em_execucao"] },
  { key: "Terminado", statuses: ["concluido", "entregue"] },
];

type LiveOrder = {
  id: string;
  number: number;
  mode: string;
  status: string;
  complaint: string | null;
  promised_at: string | null;
  updated_at: string;
  vehicles: { plate: string; brand: string | null; model: string | null; year: number | null } | null;
  clients: { name: string } | null;
  companies: { name: string } | null;
};

function AoVivo() {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [tick, setTick] = useState(0);

  const orders = useQuery({
    queryKey: ["orders", "ao-vivo"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(
          "id, number, mode, status, complaint, promised_at, updated_at, vehicles(plate, brand, model, year), clients(name), companies(name)",
        )
        .neq("status", "cancelado")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as LiveOrder[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("ao-vivo-service-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const list = orders.data ?? [];
  const naOficina = list.filter((o) => !["entregue", "concluido"].includes(o.status));
  const atrasadas = naOficina.filter((o) => o.promised_at && new Date(o.promised_at) < new Date());

  return (
    <AppShell
      title="Ao vivo"
      subtitle={`${naOficina.length} carros na oficina · ${atrasadas.length} com prazo estourado`}
      action={
        <Badge variant={live ? "default" : "secondary"} className="gap-1.5">
          {live ? <Radio className="size-3.5 animate-pulse" /> : <Wifi className="size-3.5" />}
          {live ? "Tempo real" : "Conectando"}
        </Badge>
      }
    >
      <div
        key={tick}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:snap-none md:overflow-visible md:px-0 xl:grid-cols-5"
      >
        {COLUMNS.map((col) => {
          const items = list.filter((o) => col.statuses.includes(o.status));
          return (
            <section
              key={col.key}
              className="w-[85vw] shrink-0 snap-start overflow-hidden rounded-xl border bg-muted/60 shadow-panel sm:w-[60vw] md:w-auto"
            >
              <header className="flex items-center justify-between gap-2 bg-sidebar px-3 py-2.5">
                <h2 className="truncate font-display text-lg font-semibold uppercase leading-none tracking-wide text-sidebar-foreground">
                  {col.key}
                </h2>
                <span className="shrink-0 rounded-full bg-sidebar-accent px-2.5 py-0.5 text-xs font-semibold text-sidebar-accent-foreground">
                  {items.length}
                </span>
              </header>
              <div className="space-y-3 p-3">
                {items.map((o) => (
                  <LiveCard key={o.id} order={o} />
                ))}
                {items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Vazio</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground md:hidden">
        Arraste para o lado para ver as outras etapas
      </p>

    </AppShell>
  );
}

function LiveCard({ order }: { order: LiveOrder }) {
  const late = order.promised_at && new Date(order.promised_at) < new Date();
  return (
    <Link
      to="/os/$id"
      params={{ id: order.id }}
      className="block rounded-lg border border-l-4 border-l-info bg-card p-3 shadow-panel transition-colors hover:bg-accent/40 active:bg-accent"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <p className="truncate font-display text-xl font-semibold leading-none text-info">
          {order.vehicles?.plate ?? "SEM PLACA"}
        </p>
        <Badge variant={order.mode === "express" ? "default" : "secondary"} className="shrink-0">
          {order.mode === "express" ? "Express" : "Análise"}
        </Badge>
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        <Car className="size-3.5 shrink-0" />
        <span className="truncate">
          {order.vehicles?.brand ?? ""} {order.vehicles?.model ?? ""} {order.vehicles?.year ?? ""}

        </span>
      </p>
      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
        <User className="size-3.5 shrink-0" />
        <span className="truncate">{order.companies?.name ?? order.clients?.name ?? "—"}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge variant="outline">{OS_STATUS_LABELS[order.status] ?? order.status}</Badge>
        {order.promised_at ? (
          <span className={`flex items-center gap-1 ${late ? "text-warning" : "text-muted-foreground"}`}>
            <Clock className="size-3.5" />
            {new Date(order.promised_at).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">#{order.number} · {timeAgo(order.updated_at)}</p>
    </Link>
  );
}

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}
