import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Car, Clock, FileCheck2, TriangleAlert, Plus, DollarSign, Send, Search, Calendar, CheckSquare, MessageSquare, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useMe, can, hasRole } from "@/hooks/useMe";
import { OS_STATUS_LABELS, ROLE_LABELS, APPROVAL_STAGE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

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
  const [searchTerm, setSearchTerm] = useState("");

  const orders = useQuery({
    queryKey: ["orders", "painel"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(
          "id, number, mode, status, complaint, promised_at, created_at, mechanic_id, vehicles(plate, brand, model), clients(name, phone), companies(name, phone)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
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

  const editRequests = useQuery({
    enabled: hasRole(me, "dono", "gerente"),
    queryKey: ["edit_requests", "pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("edit_requests")
        .select(`
          id, stage, reason, status, service_order_id, created_at, requested_by,
          service_orders!inner(number),
          profiles!edit_requests_requested_by_fkey(full_name)
        `)
        .is("status", null)
        .order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const queryClient = useQueryClient();

  const approveEditRequest = useMutation({
    mutationFn: async ({ id, osId, stage }: { id: string; osId: string; stage: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      // Mark as approved
      const { error: reqErr } = await supabase.from("edit_requests").update({
        status: "aprovado",
        reviewed_by: userData.user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (reqErr) throw new Error(reqErr.message);

      // Rollback the OS status
      const newStatus = stage === "entrada" ? "recebido" : "diagnostico";
      const { error: osErr } = await supabase.from("service_orders").update({
        status: newStatus
      }).eq("id", osId);
      if (osErr) throw new Error(osErr.message);
    },
    onSuccess: () => {
      toast.success("Edição liberada! A etapa foi destrancada na OS.");
      queryClient.invalidateQueries({ queryKey: ["edit_requests"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  const list = (orders.data ?? []) as any[];
  const mine = hasRole(me, "mecanico") ? list.filter((o) => o.mechanic_id === me?.userId) : list;
  const abertas = list.filter((o) => !["entregue", "cancelado"].includes(o.status));
  const atrasadas = abertas.filter((o) => o.promised_at && new Date(o.promised_at) < new Date());
  const minhasPendentes = (approvals.data ?? []).filter(
    (a) => me?.roles.includes(a.required_role as never) || hasRole(me, "dono"),
  );

  // Filter list by search term
  const filteredList = list.filter((o) => {
    const term = searchTerm.toLowerCase();
    const plate = o.vehicles?.plate?.toLowerCase() ?? "";
    const client = o.clients?.name?.toLowerCase() ?? o.companies?.name?.toLowerCase() ?? "";
    const num = String(o.number);
    return plate.includes(term) || client.includes(term) || num.includes(term);
  });

  const isSecretaria = hasRole(me, "secretaria");

  if (isSecretaria) {
    return (
      <AppShell
        title={`Olá, ${me?.fullName?.split(" ")[0] || "Recepcionista"}`}
        subtitle="Painel de Controle e Recepção"
        action={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/agendamentos">
                <Calendar className="size-4" /> Agendar
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/os/nova">
                <Plus className="size-4" /> Nova OS
              </Link>
            </Button>
          </div>
        }
      >
        {/* KPI Row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<Car className="size-4" />} label="Carros na Oficina" value={abertas.length} />
          <Stat
            icon={<Clock className="size-4" />}
            label="Prazos Estourados"
            value={atrasadas.length}
            tone={atrasadas.length > 0 ? "warning" : "default"}
          />
          <Stat
            icon={<FileCheck2 className="size-4" />}
            label="Assinaturas Pendentes"
            value={minhasPendentes.length}
          />
          <Stat
            icon={<AlertCircle className="size-4" />}
            label="Peças p/ Conferir"
            value={list.filter((o) => o.status === "compra_pecas").length}
          />
        </div>

        {/* Quick Search */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar veículo pela placa, cliente ou número da OS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Dynamic Scheduler Checklist / agendados */}
        <section className="mt-4 panel p-4">
          <div className="flex items-center gap-2 mb-3 border-b pb-2">
            <Calendar className="size-5 text-primary" />
            <h2 className="font-display text-lg font-bold">Agenda de Veículos & Confirmação</h2>
          </div>
          <AgendaChecklist list={list} />
        </section>

        {/* Active OS Panel */}
        <section className="mt-4">
          <h2 className="mb-3 font-display text-xl">Ordens de Serviço Ativas</h2>
          <div className="space-y-2">
            {(searchTerm ? filteredList : abertas).slice(0, 30).map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
            {(searchTerm ? filteredList : abertas).length === 0 ? (
              <p className="panel p-6 text-center text-sm text-muted-foreground">
                Nenhum veículo ativo encontrado.
              </p>
            ) : null}
          </div>
        </section>
      </AppShell>
    );
  }

  // Default dashboard for Dono/Mecanico/Gerente
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

      {hasRole(me, "dono", "gerente") && (editRequests.data ?? []).length > 0 ? (
        <section className="panel mt-4 p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/10">
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl text-amber-800 dark:text-amber-500">
            <TriangleAlert className="size-4" /> Solicitações de Edição (Destrancar Etapa)
          </h2>
          <ul className="space-y-3">
            {(editRequests.data ?? []).map((req: any) => (
              <li key={req.id} className="rounded-lg bg-background p-3 border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">
                    OS #{req.service_orders?.number} — Destrancar {req.stage === "entrada" ? "Entrada" : "Diagnóstico"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Solicitado por: {req.profiles?.full_name ?? "Usuário"}
                  </p>
                  <p className="text-sm mt-1.5 italic text-amber-900/80 dark:text-amber-200/80">
                    "{req.reason}"
                  </p>
                </div>
                <Button 
                  size="sm" 
                  className="shrink-0 whitespace-nowrap bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={approveEditRequest.isPending}
                  onClick={() => approveEditRequest.mutate({ id: req.id, osId: req.service_order_id, stage: req.stage })}
                >
                  <CheckSquare className="size-4 mr-1.5" /> Liberar Edição
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

// Sub-component for scheduled checklist & WhatsApp notifications
function AgendaChecklist({ list }: { list: any[] }) {
  const [confirmedIds, setConfirmedIds] = useState<Record<string, boolean>>({});

  // Filter service orders that have promised_at set in the future/today
  const upcoming = list
    .filter((o) => o.promised_at && ["recebido", "checklist"].includes(o.status))
    .sort((a, b) => new Date(a.promised_at).getTime() - new Date(b.promised_at).getTime());

  const handleSendReminder = (o: any) => {
    const clientName = o.clients?.name ?? o.companies?.name ?? "Cliente";
    const rawPhone = o.clients?.phone ?? o.companies?.phone ?? "";
    const plate = o.vehicles?.plate ?? "Sem Placa";
    const brandModel = `${o.vehicles?.brand ?? ""} ${o.vehicles?.model ?? ""}`.trim() || "Veículo";

    const dateStr = new Date(o.promised_at).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

    // Clean phone number (leave only digits, add 55 country code if not present)
    let phone = rawPhone.replace(/\D/g, "");
    if (phone.length === 11 && !phone.startsWith("55")) {
      phone = "55" + phone;
    }

    const message = `Olá, *${clientName}*! Tudo bem? Passando para lembrar do agendamento de manutenção do seu veículo *${brandModel}* (Placa: *${plate}*) marcado para o dia *${dateStr}* na Oficina HM. Confirmamos sua vinda?`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const toggleConfirm = (id: string) => {
    setConfirmedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (upcoming.length === 0) {
    return (
      <p className="text-center py-6 text-xs text-muted-foreground italic">
        Nenhum veículo agendado/prometido para as próximas datas.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {upcoming.slice(0, 10).map((o) => {
        const isConfirmed = !!confirmedIds[o.id];
        return (
          <div
            key={o.id}
            className={`flex items-start justify-between gap-3 p-3.5 rounded-lg border transition-all ${
              isConfirmed
                ? "bg-green-500/5 border-green-500/20 opacity-80"
                : "bg-secondary/40 hover:bg-secondary/60"
            }`}
          >
            <div className="flex gap-2.5 items-start min-w-0">
              <button
                type="button"
                onClick={() => toggleConfirm(o.id)}
                className={`mt-0.5 shrink-0 size-5 flex items-center justify-center rounded border transition-colors ${
                  isConfirmed
                    ? "bg-green-600 border-green-700 text-white"
                    : "border-slate-400 hover:border-slate-500"
                }`}
                aria-label="Confirmar presença"
              >
                {isConfirmed && <CheckSquare className="size-3.5" />}
              </button>
              <div className="min-w-0 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className={`font-semibold tracking-wide uppercase ${isConfirmed ? "line-through text-muted-foreground" : ""}`}>
                    {o.vehicles?.plate ?? "SEM PLACA"}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {new Date(o.promised_at).toLocaleDateString("pt-BR")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {o.vehicles?.brand ?? ""} {o.vehicles?.model ?? ""}
                </p>
                <p className="text-xs font-semibold text-primary mt-1 truncate">
                  {o.clients?.name ?? o.companies?.name ?? "Particular"}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8 shrink-0 hover:bg-primary/10 hover:text-primary"
              onClick={() => handleSendReminder(o)}
              title="Preparar lembrete no WhatsApp"
            >
              <MessageSquare className="size-4" />
            </Button>
          </div>
        );
      })}
    </div>
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
