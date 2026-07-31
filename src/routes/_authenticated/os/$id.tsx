import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, PenLine, Printer, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ChecklistSection } from "@/components/ChecklistSection";
import { MediaSection } from "@/components/MediaSection";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { useMe, can, hasRole } from "@/hooks/useMe";
import {
  APPROVAL_STAGE_LABELS,
  OS_STATUS_LABELS,
  ROLE_LABELS,
  APP_ROLES,
  type AppRole,
} from "@/lib/roles";
import { brl } from "@/routes/_authenticated/painel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/os/$id")({
  head: () => ({
    meta: [
      { title: "Ordem de serviço — Oficina" },
      { name: "description", content: "Detalhes da ordem: checklist, diagnóstico, orçamento, peças e aprovações." },
      { property: "og:title", content: "Ordem de serviço — Oficina" },
      { property: "og:description", content: "Checklist, diagnóstico, orçamento e aprovações da ordem." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Não foi possível carregar esta ordem de serviço.
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Ordem não encontrada.</div>
  ),
  component: OsDetalhe,
});

const STATUS_FLOW = [
  "recebido",
  "checklist",
  "diagnostico",
  "orcamento",
  "aguardando_aprovacao",
  "aprovado",
  "compra_pecas",
  "em_execucao",
  "concluido",
  "entregue",
  "cancelado",
];

function OsDetalhe() {
  const { id } = Route.useParams();
  const { data: me } = useMe();
  const queryClient = useQueryClient();

  const order = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(
          "*, vehicles(plate, brand, model, year, color, km), clients(name, phone, email), companies(name, phone)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["order", id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["approvals"] });
  };

  const updateOrder = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase
        .from("service_orders")
        .update(patch as never)
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Ordem atualizada.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (order.isLoading) {
    return (
      <AppShell title="Ordem de serviço">
        <Loader2 className="mx-auto my-10 size-6 animate-spin text-muted-foreground" />
      </AppShell>
    );
  }

  const os = order.data;
  if (!os) {
    return (
      <AppShell title="Ordem de serviço">
        <p className="panel p-6 text-center text-sm text-muted-foreground">Ordem não encontrada.</p>
      </AppShell>
    );
  }

  const editable = can(me, "cadastrar_os") || os.mechanic_id === me?.userId;

  return (
    <AppShell
      title={`${os.vehicles?.plate ?? "Sem placa"} · #${os.number}`}
      subtitle={`${os.mode === "express" ? "Express" : "Análise completa"} · ${OS_STATUS_LABELS[os.status]}`}
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/imprimir/$id" params={{ id }}>
            <Printer className="size-4" /> Imprimir
          </Link>
        </Button>
      }
    >
      <section className="panel p-4">
        <div className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 md:grid-cols-3">
          <Info label="Veículo" value={`${os.vehicles?.brand ?? ""} ${os.vehicles?.model ?? ""} ${os.vehicles?.year ?? ""}`} />
          <Info label="Cor / Km" value={`${os.vehicles?.color ?? "—"} · ${os.vehicles?.km ?? "—"}`} />
          <Info label="Empresa" value={os.companies?.name ?? "Cliente particular"} />
          <Info label="Cliente" value={os.clients?.name ?? "—"} />
          <Info label="Telefone" value={os.clients?.phone ?? os.companies?.phone ?? "—"} />
          <Info label="E-mail" value={os.clients?.email ?? "—"} />
          <Info
            label="Prazo estimado"
            value={
              os.promised_at
                ? new Date(os.promised_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "—"
            }
          />
          <Info label="Reclamação" value={os.complaint ?? "—"} />
        </div>

        {editable ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select
                value={os.status}
                onValueChange={(status) => updateOrder.mutate({ status })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FLOW.map((status) => (
                    <SelectItem key={status} value={status}>
                      {OS_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazo">Prazo de entrega</Label>
              <Input
                id="prazo"
                type="datetime-local"
                defaultValue={os.promised_at ? toLocalInput(os.promised_at) : ""}
                onBlur={(e) =>
                  updateOrder.mutate({
                    promised_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </div>
          </div>
        ) : null}
      </section>

      <Tabs defaultValue="entrada" className="mt-4">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-6">
          <TabsTrigger value="entrada">Entrada</TabsTrigger>
          <TabsTrigger value="diagnostico">Laudo</TabsTrigger>
          <TabsTrigger value="execucao">Execução</TabsTrigger>
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>
        </TabsList>

        <TabsContent value="entrada" className="mt-3">
          <ChecklistSection serviceOrderId={id} kind="entrada" canEdit={editable} />
        </TabsContent>

        <TabsContent value="diagnostico" className="mt-3 space-y-3">
          <div className="panel space-y-3 p-4">
            <h2 className="font-display text-lg">Análise do problema e solução</h2>
            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnóstico</Label>
              <Textarea
                id="diagnosis"
                rows={4}
                defaultValue={os.diagnosis ?? ""}
                disabled={!can(me, "lancar_diagnostico") && os.mechanic_id !== me?.userId}
                onBlur={(e) =>
                  e.target.value !== (os.diagnosis ?? "") &&
                  updateOrder.mutate({ diagnosis: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="solution">Solução proposta</Label>
              <Textarea
                id="solution"
                rows={4}
                defaultValue={os.solution ?? ""}
                disabled={!can(me, "lancar_diagnostico") && os.mechanic_id !== me?.userId}
                onBlur={(e) =>
                  e.target.value !== (os.solution ?? "") &&
                  updateOrder.mutate({ solution: e.target.value })
                }
              />
            </div>
          </div>
          <ChecklistSection serviceOrderId={id} kind="diagnostico" canEdit={editable} />
          <MediaSection
            serviceOrderId={id}
            stage="defeito"
            title="Foto / vídeo do problema encontrado"
          />
        </TabsContent>

        <TabsContent value="execucao" className="mt-3 space-y-3">
          <MediaSection serviceOrderId={id} stage="peca_nova" title="Peças novas instaladas" />
          <MediaSection serviceOrderId={id} stage="servico_concluido" title="Serviço realizado" />
          <div className="panel space-y-2 p-4">
            <Label htmlFor="final">Laudo final entregue ao cliente</Label>
            <Textarea
              id="final"
              rows={4}
              defaultValue={os.final_report ?? ""}
              disabled={!editable}
              onBlur={(e) =>
                e.target.value !== (os.final_report ?? "") &&
                updateOrder.mutate({ final_report: e.target.value })
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="orcamento" className="mt-3">
          <QuotesPanel serviceOrderId={id} onChange={invalidate} />
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-3">
          <PaymentsPanel serviceOrderId={id} />
        </TabsContent>



        <TabsContent value="aprovacoes" className="mt-3">
          <ApprovalsPanel serviceOrderId={id} onChange={invalidate} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

function toLocalInput(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function QuotesPanel({
  serviceOrderId,
  onChange,
}: {
  serviceOrderId: string;
  onChange: () => void;
}) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const visible = can(me, "ver_financeiro");
  const [quote, setQuote] = useState({ parts: "", labor: "", notes: "" });
  const [po, setPo] = useState({ supplier: "", description: "", total: "" });

  const quotes = useQuery({
    enabled: visible,
    queryKey: ["quotes", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .eq("service_order_id", serviceOrderId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const purchases = useQuery({
    enabled: visible,
    queryKey: ["purchase_orders", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("service_order_id", serviceOrderId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const createQuote = useMutation({
    mutationFn: async () => {
      const parts = Number(quote.parts || 0);
      const labor = Number(quote.labor || 0);
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("quotes").insert({
        service_order_id: serviceOrderId,
        parts_total: parts,
        labor_total: labor,
        total: parts + labor,
        notes: quote.notes.trim() || null,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setQuote({ parts: "", labor: "", notes: "" });
      toast.success("Orçamento lançado.");
      queryClient.invalidateQueries({ queryKey: ["quotes", serviceOrderId] });
      onChange();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createPo = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("purchase_orders").insert({
        service_order_id: serviceOrderId,
        supplier: po.supplier.trim() || null,
        description: po.description.trim() || null,
        total: Number(po.total || 0),
        created_by: userData.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPo({ supplier: "", description: "", total: "" });
      toast.success("Pedido de compra registrado.");
      queryClient.invalidateQueries({ queryKey: ["purchase_orders", serviceOrderId] });
      onChange();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!visible) {
    return (
      <p className="panel p-6 text-center text-sm text-muted-foreground">
        Seu acesso não permite ver valores desta ordem.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="panel space-y-3 p-4">
        <h2 className="font-display text-lg">Novo orçamento</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="parts">Peças (R$)</Label>
            <Input
              id="parts"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={quote.parts}
              onChange={(e) => setQuote({ ...quote, parts: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="labor">Mão de obra (R$)</Label>
            <Input
              id="labor"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={quote.labor}
              onChange={(e) => setQuote({ ...quote, labor: e.target.value })}
            />
          </div>
        </div>
        <Textarea
          rows={3}
          placeholder="Itens e observações do orçamento"
          value={quote.notes}
          onChange={(e) => setQuote({ ...quote, notes: e.target.value })}
        />
        <Button className="w-full" onClick={() => createQuote.mutate()} disabled={createQuote.isPending}>
          Lançar orçamento
        </Button>
      </div>

      {(quotes.data ?? []).map((q) => (
        <div key={q.id} className="panel p-4 text-sm">
          <p className="font-display text-2xl leading-none text-primary">{brl(Number(q.total))}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Peças {brl(Number(q.parts_total))} · Mão de obra {brl(Number(q.labor_total))} ·{" "}
            {new Date(q.created_at).toLocaleDateString("pt-BR")}
          </p>
          {q.notes ? <p className="mt-2 whitespace-pre-wrap">{q.notes}</p> : null}
        </div>
      ))}

      <div className="panel space-y-3 p-4">
        <h2 className="font-display text-lg">Pedido de compra de peças</h2>
        <Input
          placeholder="Fornecedor"
          value={po.supplier}
          onChange={(e) => setPo({ ...po, supplier: e.target.value })}
        />
        <Textarea
          rows={2}
          placeholder="Peças solicitadas"
          value={po.description}
          onChange={(e) => setPo({ ...po, description: e.target.value })}
        />
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="Valor total"
          value={po.total}
          onChange={(e) => setPo({ ...po, total: e.target.value })}
        />
        <Button variant="secondary" className="w-full" onClick={() => createPo.mutate()} disabled={createPo.isPending}>
          Registrar pedido de compra
        </Button>
      </div>

      {(purchases.data ?? []).map((p) => (
        <div key={p.id} className="panel p-4 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium">{p.supplier ?? "Fornecedor não informado"}</p>
            <Badge variant="outline">{p.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{brl(Number(p.total))}</p>
          {p.description ? <p className="mt-1 whitespace-pre-wrap">{p.description}</p> : null}
        </div>
      ))}
    </div>
  );
}

function ApprovalsPanel({
  serviceOrderId,
  onChange,
}: {
  serviceOrderId: string;
  onChange: () => void;
}) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const key = ["approvals", serviceOrderId];
  const [stage, setStage] = useState("orcamento");
  const [role, setRole] = useState<AppRole>("dono");
  const [signatures, setSignatures] = useState<Record<string, string>>({});

  const approvals = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select("*")
        .eq("service_order_id", serviceOrderId)
        .order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const request = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("approvals").insert({
        service_order_id: serviceOrderId,
        stage: stage as never,
        required_role: role as never,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Etapa de aprovação criada.");
      queryClient.invalidateQueries({ queryKey: key });
      onChange();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const decide = useMutation({
    mutationFn: async (input: { id: string; decision: "aprovado" | "reprovado"; signature: string }) => {
      if (!input.signature.trim()) throw new Error("Assine com seu nome completo para registrar.");
      const { error } = await supabase
        .from("approvals")
        .update({
          decision: input.decision,
          signature: input.signature.trim(),
          decided_at: new Date().toISOString(),
          decided_by: me?.userId ?? null,
        })
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Decisão registrada com assinatura.");
      queryClient.invalidateQueries({ queryKey: key });
      onChange();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canRequest = can(me, "cadastrar_os");

  return (
    <div className="space-y-3">
      {canRequest ? (
        <div className="panel space-y-3 p-4">
          <h2 className="font-display text-lg">Solicitar aprovação</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(APPROVAL_STAGE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quem deve assinar</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button className="w-full" onClick={() => request.mutate()} disabled={request.isPending}>
            Criar etapa de aprovação
          </Button>
        </div>
      ) : null}

      {(approvals.data ?? []).map((a) => {
        const mine =
          a.decision === "pendente" &&
          (hasRole(me, "dono") || me?.roles.includes(a.required_role as AppRole));
        return (
          <div key={a.id} className="panel space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{APPROVAL_STAGE_LABELS[a.stage] ?? a.stage}</p>
              <Badge
                variant={
                  a.decision === "aprovado"
                    ? "default"
                    : a.decision === "reprovado"
                      ? "destructive"
                      : "outline"
                }
              >
                {a.decision}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Responsável: {ROLE_LABELS[a.required_role as AppRole]}
              {a.signature ? ` · Assinado por ${a.signature}` : ""}
              {a.decided_at ? ` em ${new Date(a.decided_at).toLocaleString("pt-BR")}` : ""}
            </p>

            {mine ? (
              <div className="space-y-2">
                <Label htmlFor={`sig-${a.id}`} className="flex items-center gap-1.5">
                  <PenLine className="size-3.5" /> Assinatura (nome completo)
                </Label>
                <Input
                  id={`sig-${a.id}`}
                  value={signatures[a.id] ?? me?.fullName ?? ""}
                  onChange={(e) => setSignatures({ ...signatures, [a.id]: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() =>
                      decide.mutate({
                        id: a.id,
                        decision: "aprovado",
                        signature: signatures[a.id] ?? me?.fullName ?? "",
                      })
                    }
                  >
                    <ThumbsUp className="size-4" /> Aprovar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      decide.mutate({
                        id: a.id,
                        decision: "reprovado",
                        signature: signatures[a.id] ?? me?.fullName ?? "",
                      })
                    }
                  >
                    <ThumbsDown className="size-4" /> Reprovar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      {(approvals.data ?? []).length === 0 ? (
        <p className="panel p-6 text-center text-sm text-muted-foreground">
          <ShieldCheck className="mx-auto mb-2 size-5" />
          Nenhuma etapa de aprovação criada para esta ordem.
        </p>
      ) : null}
    </div>
  );
}
