import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Radio, Clock, Car, User, Wifi, AlertCircle, CheckCircle, ShieldAlert, Package, Play, UserCheck } from "lucide-react";
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
  { key: "1. Entrada / Triagem", statuses: ["recebido", "checklist"] },
  { key: "2. Diagnóstico", statuses: ["diagnostico"] },
  { key: "3. Aprovação Interna", statuses: ["orcamento", "aguardando_aprovacao"] },
  { key: "4. Compra Autorizada", statuses: ["aprovado"] },
  { key: "5. Apoiando / Peças", statuses: ["compra_pecas"] },
  { key: "6. Em Execução", statuses: ["em_execucao"] },
  { key: "7. Prontos / Concluídos", statuses: ["concluido", "entregue"] },
];

type LiveOrder = {
  id: string;
  number: number;
  mode: string;
  status: string;
  mechanic_id: string | null;
  complaint: string | null;
  promised_at: string | null;
  updated_at: string;
  vehicles: { plate: string; brand: string | null; model: string | null; year: number | null } | null;
  clients: { name: string } | null;
  companies: { name: string } | null;
  approvals: {
    id: string;
    stage: string;
    required_role: string;
    decision: string;
    signature: string | null;
  }[];
};

function AoVivo() {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const [tick, setTick] = useState(0);

  const orders = useQuery({
    queryKey: ["orders", "ao-vivo"],
    refetchInterval: 15_000, // Update faster (15s)
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(
          "id, number, mode, status, mechanic_id, complaint, promised_at, updated_at, vehicles(plate, brand, model, year), clients(name), companies(name), approvals(id, stage, required_role, decision, signature)",
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
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => {
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
      title="Acompanhamento Ao Vivo"
      subtitle={`${naOficina.length} carros na oficina · ${atrasadas.length} com prazo estourado`}
      action={
        <Badge variant={live ? "default" : "secondary"} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0 py-1">
          {live ? <Radio className="size-3.5 animate-pulse" /> : <Wifi className="size-3.5" />}
          {live ? "Conectado em tempo real" : "Conectando"}
        </Badge>
      }
    >
      <div
        key={tick}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:snap-none md:overflow-visible md:px-0 xl:grid-cols-7"
      >
        {COLUMNS.map((col) => {
          const items = list.filter((o) => col.statuses.includes(o.status));
          return (
            <section
              key={col.key}
              className="w-[85vw] shrink-0 snap-start overflow-hidden rounded-xl border bg-slate-900/50 shadow-lg border-slate-800/80 sm:w-[60vw] md:w-auto"
            >
              <header className="flex items-center justify-between gap-2 bg-black px-3 py-3 border-b border-slate-800">
                <h2 className="truncate font-display text-sm font-bold uppercase leading-none tracking-wider text-slate-200">
                  {col.key}
                </h2>
                <span className="shrink-0 rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                  {items.length}
                </span>
              </header>
              <div className="space-y-3 p-3 max-h-[70vh] overflow-y-auto">
                {items.map((o) => (
                  <LiveCard key={o.id} order={o} />
                ))}
                {items.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500 italic">Nenhum veículo</p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-center text-xs text-slate-500 md:hidden">
        Arraste para o lado para ver as outras etapas do fluxo
      </p>
    </AppShell>
  );
}

function LiveCard({ order }: { order: LiveOrder }) {
  const late = order.promised_at && new Date(order.promised_at) < new Date();

  // Helper to evaluate detailed pending reason
  const getPendingAction = (): { label: string; colorClass: string; icon: any } => {
    const appList = order.approvals ?? [];

    switch (order.status) {
      case "recebido":
      case "checklist":
        if (!order.mechanic_id) {
          return { label: "Aguardando Mecânico", colorClass: "bg-red-500/10 text-red-400 border-red-500/20", icon: User };
        }
        return { label: "Realizar Laudo Inicial", colorClass: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock };

      case "diagnostico":
        return { label: "Realizar Diagnóstico", colorClass: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: Wrench };

      case "orcamento":
        const hasInternal = appList.some(
          (a) => a.stage === "orcamento" && (a.required_role === "dono" || a.required_role === "gerente") && a.decision === "aprovado"
        );
        if (!hasInternal) {
          return { label: "Aprovação do Dono/Gerente", colorClass: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: ShieldAlert };
        }
        return { label: "Aprovação Interna Pronta", colorClass: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle };

      case "aguardando_aprovacao":
        const mechSigned = appList.some((a) => a.stage === "orcamento" && a.required_role === "mecanico" && a.decision === "aprovado");
        const secSigned = appList.some((a) => a.stage === "orcamento" && a.required_role === "secretaria" && a.decision === "aprovado");
        const cliSigned = appList.some((a) => a.stage === "orcamento" && a.required_role === "funcionario" && a.decision === "aprovado");

        if (!mechSigned) return { label: "Falta Assinatura Mecânico", colorClass: "bg-red-500/10 text-red-450 border-red-500/20", icon: UserCheck };
        if (!secSigned) return { label: "Falta Assinatura Secretaria", colorClass: "bg-red-500/10 text-red-450 border-red-500/20", icon: UserCheck };
        if (!cliSigned) return { label: "Aguardando Aceite Cliente", colorClass: "bg-yellow-500/10 text-yellow-450 border-yellow-500/20", icon: User };
        return { label: "Pronto p/ Avançar", colorClass: "bg-green-500/10 text-green-450 border-green-500/20", icon: CheckCircle };

      case "aprovado":
        return { label: "Autorizar Compra (Dono)", colorClass: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: ShieldAlert };

      case "compra_pecas":
        const partSecSigned = appList.some((a) => a.stage === "compra_pecas" && a.required_role === "secretaria" && a.decision === "aprovado");
        const partMechSigned = appList.some((a) => a.stage === "compra_pecas" && a.required_role === "mecanico" && a.decision === "aprovado");

        if (!partSecSigned) return { label: "Recepcionista: Foto e Assinar", colorClass: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: Camera };
        if (!partMechSigned) return { label: "Mecânico: Conferir Peças", colorClass: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: Package };
        return { label: "Peças Prontas", colorClass: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle };

      case "em_execucao":
        return { label: "Serviço em Andamento", colorClass: "bg-blue-500/10 text-blue-450 border-blue-500/20", icon: Play };

      case "concluido":
        return { label: "Pronto para Entrega", colorClass: "bg-green-500/10 text-green-400 border-green-500/20", icon: CheckCircle };

      case "entregue":
        return { label: "Veículo Entregue", colorClass: "bg-slate-500/10 text-slate-400 border-slate-550/20", icon: CheckCircle };

      default:
        return { label: "Indefinido", colorClass: "bg-slate-500/10 text-slate-400", icon: AlertCircle };
    }
  };

  const pending = getPendingAction();
  const IconComponent = pending.icon;

  return (
    <Link
      to="/os/$id"
      params={{ id: order.id }}
      className="block rounded-lg border border-l-4 border-slate-800 border-l-primary bg-slate-900 p-3.5 shadow transition-all duration-200 hover:border-slate-700/80 hover:bg-slate-850 active:scale-[0.98]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <p className="font-display text-lg font-bold leading-none text-slate-100 uppercase tracking-wide">
          {order.vehicles?.plate ?? "SEM PLACA"}
        </p>
        <Badge variant={order.mode === "express" ? "default" : "secondary"} className="shrink-0 h-5 text-[10px]">
          {order.mode === "express" ? "Express" : "Análise"}
        </Badge>
      </div>

      <p className="mt-2 flex items-center gap-1.5 truncate text-[11px] text-slate-400">
        <Car className="size-3.5 shrink-0 text-slate-500" />
        <span className="truncate">
          {order.vehicles?.brand ?? ""} {order.vehicles?.model ?? ""} {order.vehicles?.year ?? ""}
        </span>
      </p>

      <p className="flex items-center gap-1.5 truncate text-[11px] text-slate-400">
        <User className="size-3.5 shrink-0 text-slate-500" />
        <span className="truncate">{order.companies?.name ?? order.clients?.name ?? "—"}</span>
      </p>

      {/* Workflow Pending Badge */}
      <div className={`mt-3 flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium ${pending.colorClass}`}>
        <IconComponent className="size-3.5 shrink-0" />
        <span className="truncate">{pending.label}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-800/80 pt-2 text-[10px] text-slate-500">
        <span>#{order.number} · {timeAgo(order.updated_at)}</span>
        {order.promised_at ? (
          <span className={`flex items-center gap-1 ${late ? "text-amber-500 font-bold" : ""}`}>
            <Clock className="size-3" />
            {new Date(order.promised_at).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        ) : null}
      </div>
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
