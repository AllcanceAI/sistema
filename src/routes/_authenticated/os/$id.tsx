import { createFileRoute, Link } from "@tanstack/react-router";
import * as htmlToImage from "html-to-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Loader2, PenLine, Printer, ShieldCheck, ThumbsDown, ThumbsUp, Wrench, CheckCircle2, User, Clock, Camera, Lock, Send, LogIn, Trash2, XCircle, Pencil, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ChecklistSection } from "@/components/ChecklistSection";
import { MediaSection } from "@/components/MediaSection";
import { PaymentsPanel } from "@/components/PaymentsPanel";
import { EvidenciaPanel } from "@/components/EvidenciaPanel";
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
import { PrintableQuote } from "@/components/PrintableQuote";
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
  errorComponent: (props: any) => {
    // Log to console and send to supabase
    console.error("OS Error:", props.error);
    if (props.error) {
      supabase.from("edit_requests").insert({
        service_order_id: null,
        stage: "error_log",
        reason: String(props.error.stack || props.error.message),
      }).then(() => {});
    }
    return (
      <div className="p-8 text-center text-sm text-red-500 font-mono">
        Não foi possível carregar esta ordem de serviço. Erro: {props?.error?.message || "Desconhecido"}
      </div>
    );
  },
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
  const [editRequestModal, setEditRequestModal] = useState<{ stage: string; label: string } | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editRequestSent, setEditRequestSent] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("entrada");

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

  const mechanics = useQuery({
    queryKey: ["mechanics"],
    queryFn: async () => {
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "mecanico");
      if (rolesError) throw new Error(rolesError.message);
      const ids = (rolesData ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids)
        .eq("active", true)
        .order("full_name");
      if (profilesError) throw new Error(profilesError.message);
      return profiles ?? [];
    },
  });

  const approvals = useQuery({
    queryKey: ["approvals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select("*")
        .eq("service_order_id", id)
        .order("created_at");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["order", id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["approvals", id] });
  };

  // Keep tab in sync with workflow progression (must be above early returns)
  useEffect(() => {
    if (!order.data) return;
    const s = order.data.status;
    let idx = 0;
    if (s === "diagnostico") idx = 1;
    else if (s === "orcamento") idx = 2;
    else if (s === "aguardando_aprovacao") idx = 3;
    else if (s === "aprovado") idx = 4;
    else if (s === "compra_pecas") idx = 5;
    else if (s === "em_execucao") idx = 6;
    else if (s === "concluido") idx = 7;
    else if (s === "entregue") idx = 8;

    if (idx === 0) setActiveTab("entrada");
    else if (idx === 1) setActiveTab("diagnostico");
    else if (idx === 2 || idx === 3) setActiveTab("orcamento");
    else if (idx === 4 || idx === 5) setActiveTab("aprovacoes");
    else if (idx >= 6) setActiveTab("execucao");
  }, [order.data?.status]);

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

  const deleteOrder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("service_orders").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Ordem de serviço excluída!");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      window.location.href = "/ao-vivo"; // Go back to pista
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendEditRequest = useMutation({
    mutationFn: async ({ stage, reason }: { stage: string; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("edit_requests").insert({
        service_order_id: id,
        stage,
        reason,
        requested_by: userData.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Solicitação enviada! O gerente será notificado.");
      setEditRequestSent(true);
      setEditRequestModal(null);
      setEditReason("");
    },
    onError: (e: Error) => toast.error(e.message),
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

  const isManagerOrOwner = hasRole(me, "dono") || hasRole(me, "gerente");
  const editable = can(me, "cadastrar_os") || os.mechanic_id === me?.userId;
  const approvalsList = approvals.data ?? [];

  // Helper variables for workflow evaluation
  const internalApproved = approvalsList.some(
    (a) => a.stage === "orcamento" && (a.required_role === "dono" || a.required_role === "gerente") && a.decision === "aprovado"
  );

  const teamMechanicSigned = approvalsList.some(
    (a) => a.stage === "orcamento" && a.required_role === "mecanico" && a.decision === "aprovado"
  );
  const teamSecretarySigned = approvalsList.some(
    (a) => a.stage === "orcamento" && a.required_role === "secretaria" && a.decision === "aprovado"
  );
  const clientSigned = approvalsList.some(
    (a) => a.stage === "orcamento" && a.required_role === "funcionario" && a.decision === "aprovado"
  );

  const partsOrderApprovedByDono = approvalsList.some(
    (a) => a.stage === "compra_pecas" && a.required_role === "dono" && a.decision === "aprovado"
  );

  const partsArrivalSignedBySecretary = approvalsList.some(
    (a) => a.stage === "compra_pecas" && a.required_role === "secretaria" && a.decision === "aprovado"
  );
  const partsArrivalSignedByMechanic = approvalsList.some(
    (a) => a.stage === "compra_pecas" && a.required_role === "mecanico" && a.decision === "aprovado"
  );

  // Stepper steps configuration
  const getActiveStep = () => {
    switch (os.status) {
      case "recebido":
      case "checklist":
        return 0; // Entrada
      case "diagnostico":
        return 1; // Diagnóstico
      case "orcamento":
        return 2; // Aprovação Interna (Dono/Gerente)
      case "aguardando_aprovacao":
        return 3; // Aprovação da Equipe e Cliente
      case "aprovado":
        return 4; // Pedido de Peças (Autorização)
      case "compra_pecas":
        return 5; // Recebimento de Peças
      case "em_execucao":
        return 6; // Execução do Serviço
      case "concluido":
        return 7; // Finalizado (Pronto para Entrega)
      case "entregue":
        return 8; // Entregue
      default:
        return 0;
    }
  };

  const activeStepIndex = getActiveStep();

  // useEffect moved above early returns

  return (
    <AppShell
      title={`${os.vehicles?.plate ?? "Sem placa"} · #${os.number}`}
      subtitle={`${os.mode === "express" ? "Express" : "Análise completa"} · ${OS_STATUS_LABELS[os.status]}`}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editable && os.status !== "cancelado" && (
            <Button
              variant="destructive"
              size="sm"
              className="bg-red-600 hover:bg-red-700 font-bold"
              onClick={() => {
                if (confirm("Tem certeza que deseja registrar DESISTÊNCIA (cancelar) este serviço? Ele sairá da pista.")) {
                  updateOrder.mutate({ status: "cancelado" });
                }
              }}
              disabled={updateOrder.isPending}
            >
              <XCircle className="size-4 mr-1" /> Desistência
            </Button>
          )}

          {(hasRole(me, "dono") || hasRole(me, "gerente")) && (
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50 font-bold"
              onClick={() => {
                if (confirm("ATENÇÃO: Tem certeza absoluta que deseja EXCLUIR DEFINITIVAMENTE esta OS do sistema por erro de digitação? Essa ação não pode ser desfeita!")) {
                  deleteOrder.mutate();
                }
              }}
              disabled={deleteOrder.isPending}
            >
              <Trash2 className="size-4 mr-1" /> Excluir OS
            </Button>
          )}

          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link to="/imprimir/$id" params={{ id }}>
              <Printer className="size-4 mr-1" /> Imprimir
            </Link>
          </Button>
        </div>
      }
    >
      {/* General OS info panel */}
      <section className="panel p-4">
        <div className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 md:grid-cols-3">
          <Info label="Veículo" value={`${os.vehicles?.brand ?? ""} ${os.vehicles?.model ?? ""} ${os.vehicles?.year ?? ""}`} />
          <Info label="Cor / Km" value={`${os.vehicles?.color ?? "—"} · ${os.vehicles?.km ?? "—"}`} />
          <Info label="Empresa" value={os.companies?.name ?? "Cliente particular"} />
          <Info label="Cliente" value={os.clients?.name ?? "—"} />
          <Info label="Telefone" value={os.clients?.phone ?? os.companies?.phone ?? "—"} />
          <Info label="E-mail" value={os.clients?.email ?? "—"} />
          <Info
            label="Mecânico Responsável"
            value={
              mechanics.data?.find((m) => m.id === os.mechanic_id)?.full_name ?? "Não designado"
            }
          />
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
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {isManagerOrOwner && (
              <>
                <div className="space-y-2">
                  <Label>Situação Manual</Label>
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
                  <Label>Mecânico Responsável</Label>
                  <Select
                    value={os.mechanic_id ?? "none"}
                    onValueChange={(val) => updateOrder.mutate({ mechanic_id: val === "none" ? null : val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Designar mecânico..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {(mechanics.data ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

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

      {/* Stepper / Active Stage Card */}
      <section className="panel mt-4 overflow-hidden border-t-4 border-t-primary">
        <header className="bg-muted/40 px-4 py-3 border-b">
          <h2 className="font-display text-lg uppercase tracking-wide text-primary">Acompanhamento e Assinaturas</h2>
        </header>

        {/* Stepper headers */}
        <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-9 text-center border-b text-[11px] font-semibold text-muted-foreground bg-muted/10">
          {[
            "Entrada",
            "Diagnóstico",
            "Aprovação Interna",
            "Aprovação Equipe/Cliente",
            "Pedido de Peças",
            "Recebimento de Peças",
            "Em Execução",
            "Concluído",
            "Entregue",
          ].map((step, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-md ${
                idx === activeStepIndex
                  ? "bg-primary text-primary-foreground shadow"
                  : idx < activeStepIndex
                    ? "text-success bg-success/10 font-bold"
                    : ""
              }`}
            >
              {idx < activeStepIndex ? "✓ " : ""}
              {step}
            </div>
          ))}
        </div>

        {/* Dynamic active step panel */}
        <div className="p-5">
          <ActiveStepPanel
            activeStepIndex={activeStepIndex}
            os={os}
            me={me}
            updateOrder={updateOrder}
            approvals={approvalsList}
            invalidate={invalidate}
            mechanics={mechanics.data ?? []}
            internalApproved={internalApproved}
            teamMechanicSigned={teamMechanicSigned}
            teamSecretarySigned={teamSecretarySigned}
            clientSigned={clientSigned}
            partsOrderApprovedByDono={partsOrderApprovedByDono}
            partsArrivalSignedBySecretary={partsArrivalSignedBySecretary}
            partsArrivalSignedByMechanic={partsArrivalSignedByMechanic}
          />
        </div>
      </section>

      {/* Details tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:grid-cols-7">
          <TabsTrigger value="entrada">Entrada</TabsTrigger>
          <TabsTrigger value="diagnostico">Laudo</TabsTrigger>
          <TabsTrigger value="execucao">Execução</TabsTrigger>
          <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
          <TabsTrigger value="aprovacoes">Aprovações</TabsTrigger>
          <TabsTrigger value="evidencias">Evidências</TabsTrigger>
        </TabsList>

        <TabsContent value="entrada" className="mt-3">
          {/* Lock banner for completed entry stage */}
          {activeStepIndex > 0 && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                <Lock className="size-4 shrink-0" />
                Etapa de entrada concluída. Para fazer alterações, solicite autorização do gerente.
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-300 text-amber-700"
                onClick={() => setEditRequestModal({ stage: "entrada", label: "Entrada do Veículo" })}
              >
                <Send className="size-3.5" /> Solicitar edição
              </Button>
            </div>
          )}
          <ChecklistSection 
            serviceOrderId={id} 
            kind="entrada" 
            canEdit={editable && activeStepIndex === 0} 
            onComplete={() => updateOrder.mutate({ status: os.mode === "express" ? "orcamento" : "diagnostico" })}
          />
          {/* Fotos gerais de entrada — sempre disponível mesmo após etapa trancada */}
          <MediaSection
            serviceOrderId={id}
            stage="entrada"
            title="📷 Fotos gerais do veículo (Entrada)"
          />
        </TabsContent>

        <TabsContent value="diagnostico" className="mt-3 space-y-3">
          {/* Lock banner for completed diagnosis */}
          {activeStepIndex > 1 && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
                <Lock className="size-4 shrink-0" />
                Diagnóstico concluído e enviado para aprovação. Para alterações, solicite ao gerente.
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-300 text-amber-700"
                onClick={() => setEditRequestModal({ stage: "diagnostico", label: "Diagnóstico" })}
              >
                <Send className="size-3.5" /> Solicitar edição
              </Button>
            </div>
          )}
          <div className="panel space-y-3 p-4">
            <h2 className="font-display text-lg">Análise do problema e solução</h2>
            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnóstico</Label>
              <Textarea
                id="diagnosis"
                rows={4}
                defaultValue={os.diagnosis ?? ""}
                disabled={activeStepIndex > 1 || (!can(me, "lancar_diagnostico") && os.mechanic_id !== me?.userId)}
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
                disabled={activeStepIndex > 1 || (!can(me, "lancar_diagnostico") && os.mechanic_id !== me?.userId)}
                onBlur={(e) =>
                  e.target.value !== (os.solution ?? "") &&
                  updateOrder.mutate({ solution: e.target.value })
                }
              />
            </div>
          </div>
          <ChecklistSection 
            serviceOrderId={id} 
            kind="diagnostico" 
            canEdit={editable && activeStepIndex === 1} 
            onComplete={() => updateOrder.mutate({ status: "orcamento" })}
          />
          <MediaSection
            serviceOrderId={id}
            stage="defeito"
            title="📷 Fotos do defeito / problema encontrado"
          />
        </TabsContent>

        <TabsContent value="execucao" className="mt-3 space-y-3">
          <MediaSection serviceOrderId={id} stage="peca_nova" title="🔧 Peças novas instaladas" />
          <MediaSection serviceOrderId={id} stage="servico_concluido" title="✅ Serviço realizado / concluído" />
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
          <MediaSection serviceOrderId={id} stage="outro" title="📷 Fotos adicionais da execução" />
          
          {editable && os.status === "em_execucao" && (
            <div className="mt-8 flex justify-end">
              <Button
                size="lg"
                className="w-full sm:w-auto font-bold bg-green-600 hover:bg-green-700 text-white gap-2"
                onClick={() => {
                  if (confirm("Deseja confirmar a conclusão do serviço e liberar o veículo para entrega?")) {
                    updateOrder.mutate({ status: "concluido" });
                  }
                }}
              >
                <CheckCircle2 className="size-5" />
                Concluir Serviço (Pronto para Entrega)
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="orcamento" className="mt-3 space-y-3">
          <QuotesPanel serviceOrderId={id} osData={os} onChange={invalidate} />
          <MediaSection serviceOrderId={id} stage="outro" title="📷 Fotos e documentos do orçamento" />
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-3">
          <PaymentsPanel serviceOrderId={id} />
        </TabsContent>

        <TabsContent value="aprovacoes" className="mt-3">
          <ApprovalsPanel serviceOrderId={id} onChange={invalidate} />
        </TabsContent>

        <TabsContent value="evidencias" className="mt-3">
          <EvidenciaPanel serviceOrderId={id} />
        </TabsContent>
      </Tabs>

      {/* Edit Request Modal */}
      {editRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEditRequestModal(null)}>
          <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-xl font-bold mb-1">Solicitar Edição</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Etapa: <strong>{editRequestModal.label}</strong> — OS #{os.number}
            </p>
            <p className="text-sm mb-3">Descreva o motivo da alteração necessária. O gerente será notificado e poderá aprovar a edição.</p>
            <Textarea
              rows={3}
              placeholder="Ex: Diagnóstico incompleto, faltou descrever o problema do ar condicionado..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="mb-3"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditRequestModal(null)}>Cancelar</Button>
              <Button
                className="flex-1"
                disabled={!editReason.trim() || sendEditRequest.isPending}
                onClick={() => sendEditRequest.mutate({ stage: editRequestModal.stage, reason: editReason })}
              >
                {sendEditRequest.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Enviar Solicitação
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// Sub-component for managing the stepper flow interface
function ActiveStepPanel({
  activeStepIndex,
  os,
  me,
  updateOrder,
  approvals,
  invalidate,
  mechanics,
  internalApproved,
  teamMechanicSigned,
  teamSecretarySigned,
  clientSigned,
  partsOrderApprovedByDono,
  partsArrivalSignedBySecretary,
  partsArrivalSignedByMechanic,
}: {
  activeStepIndex: number;
  os: any;
  me: any;
  updateOrder: any;
  approvals: any[];
  invalidate: () => void;
  mechanics: any[];
  internalApproved: boolean;
  teamMechanicSigned: boolean;
  teamSecretarySigned: boolean;
  clientSigned: boolean;
  partsOrderApprovedByDono: boolean;
  partsArrivalSignedBySecretary: boolean;
  partsArrivalSignedByMechanic: boolean;
}) {
  const queryClient = useQueryClient();
  const [signatureName, setSignatureName] = useState(me?.fullName ?? "");

  const handleSign = useMutation({
    mutationFn: async (input: { stage: string; role: AppRole; decision?: "aprovado" | "reprovado" }) => {
      if (!signatureName.trim()) {
        throw new Error("Por favor, digite seu nome completo para assinar.");
      }
      // Insert approval
      const { error } = await supabase.from("approvals").insert({
        service_order_id: os.id,
        stage: input.stage as any,
        required_role: input.role,
        decision: input.decision ?? "aprovado",
        signature: signatureName.trim(),
        decided_at: new Date().toISOString(),
        decided_by: me?.userId ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Assinatura registrada com sucesso!");
      invalidate();
      setSignatureName(me?.fullName ?? "");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Autocomplete updates based on workflow state transition
  const transitionToStatus = (status: string) => {
    updateOrder.mutate({ status });
  };

  switch (activeStepIndex) {
    case 0: // Entrada
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 p-4 rounded-lg">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Fase 1: Entrada do Veículo</h3>
              <p className="text-xs text-muted-foreground mt-0.5">O veículo deu entrada na oficina. Defina o mecânico responsável e inicie o laudo.</p>
            </div>
            {hasRole(me, "dono", "gerente", "secretaria") && (
              <Button
                onClick={() => {
                  if (!os.mechanic_id) {
                    toast.error("Por favor, selecione um mecânico para assumir o serviço antes de prosseguir.");
                    return;
                  }
                  transitionToStatus("diagnostico");
                }}
              >
                Iniciar Diagnóstico <Wrench className="size-4 ml-1.5" />
              </Button>
            )}
          </div>
          {!os.mechanic_id && (
            <div className="text-sm p-3 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300 rounded border border-yellow-200/50">
              Aguardando a designação do mecânico para a realização do diagnóstico.
            </div>
          )}
        </div>
      );

    case 1: // Diagnóstico
      const hasDiagnosis = !!os.diagnosis?.trim() && !!os.solution?.trim();
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 p-4 rounded-lg">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Fase 2: Diagnóstico e Proposta</h3>
              <p className="text-xs text-muted-foreground mt-0.5">O mecânico deve realizar a análise, lançar o laudo (diagnóstico) e propor a solução na aba "Laudo".</p>
            </div>
            {hasDiagnosis && (os.mechanic_id === me?.userId || hasRole(me, "dono", "gerente", "secretaria")) && (
              <Button
                onClick={() => {
                  transitionToStatus("orcamento");
                }}
              >
                Mandar para Aprovação Interna <CheckCircle2 className="size-4 ml-1.5" />
              </Button>
            )}
          </div>
          {!hasDiagnosis ? (
            <div className="text-sm p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 rounded border border-blue-200/50">
              Mecânico designado: <strong>{mechanics.find((m) => m.id === os.mechanic_id)?.full_name ?? "Não designado"}</strong>.
              Aguardando a inserção do laudo técnico (diagnóstico e solução proposta).
            </div>
          ) : (
            <div className="text-sm p-3 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 rounded border border-green-200/50">
              Diagnóstico e solução preenchidos! Pronto para enviar para a aprovação interna da gerência.
            </div>
          )}
        </div>
      );

    case 2: // Aprovação Interna (Dono/Gerente)
      const canSignInternal = hasRole(me, "dono", "gerente");
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 p-4 rounded-lg">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Fase 3: Aprovação Interna</h3>
              <p className="text-xs text-muted-foreground mt-0.5">O orçamento e o laudo técnico devem ser assinados pelo Dono ou Gerente antes de serem apresentados ao cliente.</p>
            </div>
          </div>

          {internalApproved ? (
            <div className="space-y-3">
              <div className="text-sm p-3 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 rounded border border-green-200/50">
                Aprovação interna assinada com sucesso!
              </div>
              <Button onClick={() => transitionToStatus("aguardando_aprovacao")}>
                Avançar para Assinatura da Equipe & Cliente
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm p-3 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300 rounded border border-yellow-200/50">
                Aguardando assinatura do Dono ou Gerente.
              </div>
              {canSignInternal && (
                <div className="panel p-4 space-y-3 bg-background">
                  <Label htmlFor="sig-internal">Assinatura de Aprovação Interna (Nome Completo)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sig-internal"
                      placeholder="Seu nome completo"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                    />
                    <Button onClick={() => handleSign.mutate({ stage: "orcamento", role: me?.roles.includes("dono") ? "dono" : "gerente" })}>
                      Assinar e Autorizar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );

    case 3: // Aprovação da Equipe e Cliente
      const isMecanicoResponsavel = os.mechanic_id === me?.userId;
      const isSecretaria = hasRole(me, "secretaria", "dono");

      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 p-4 rounded-lg">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Fase 4: Assinaturas da Equipe & Cliente</h3>
              <p className="text-xs text-muted-foreground mt-0.5">O mecânico designado e a secretária devem assinar o plano definitivo. Em seguida, o cliente aprova o orçamento.</p>
            </div>
            {teamMechanicSigned && teamSecretarySigned && clientSigned && (
              <Button onClick={() => transitionToStatus("aprovado")}>
                Avançar para Pedido de Peças
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Mechanic signature card */}
            <div className="panel p-3 space-y-2 bg-background">
              <h4 className="font-medium text-sm flex items-center gap-1">
                {teamMechanicSigned ? "✓ " : ""} Mecânico
              </h4>
              <p className="text-xs text-muted-foreground">Assinatura do mecânico responsável.</p>
              {teamMechanicSigned ? (
                <Badge className="bg-success text-success-foreground">Assinado</Badge>
              ) : isMecanicoResponsavel ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Nome completo"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button size="sm" className="w-full" onClick={() => handleSign.mutate({ stage: "orcamento", role: "mecanico" })}>
                    Assinar
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Aguardando mecânico</span>
              )}
            </div>

            {/* Secretary signature card */}
            <div className="panel p-3 space-y-2 bg-background">
              <h4 className="font-medium text-sm flex items-center gap-1">
                {teamSecretarySigned ? "✓ " : ""} Secretaria
              </h4>
              <p className="text-xs text-muted-foreground">Assinatura da secretária/recepcionista.</p>
              {teamSecretarySigned ? (
                <Badge className="bg-success text-success-foreground">Assinado</Badge>
              ) : isSecretaria ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Nome completo"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button size="sm" className="w-full" onClick={() => handleSign.mutate({ stage: "orcamento", role: "secretaria" })}>
                    Assinar
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Aguardando secretaria</span>
              )}
            </div>

            {/* Client signature card */}
            <div className="panel p-3 space-y-2 bg-background">
              <h4 className="font-medium text-sm flex items-center gap-1">
                {clientSigned ? "✓ " : ""} Cliente
              </h4>
              <p className="text-xs text-muted-foreground">Confirmação de aceite do cliente.</p>
              {clientSigned ? (
                <Badge className="bg-success text-success-foreground">Aprovado pelo Cliente</Badge>
              ) : hasRole(me, "secretaria", "gerente", "dono") ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Nome do cliente (autorização)"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Button size="sm" className="w-full" onClick={() => handleSign.mutate({ stage: "orcamento", role: "funcionario" })}>
                    Confirmar Aceite
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">Aguardando aceite</span>
              )}
            </div>
          </div>
        </div>
      );

    case 4: // Pedido de Peças (Autorização)
      const canSignPurchase = hasRole(me, "dono");
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 p-4 rounded-lg">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Fase 5: Pedido de Peças</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Após aceitação do cliente, o Dono deve autorizar e assinar a compra/pedido das peças necessárias no sistema.</p>
            </div>
          </div>

          {partsOrderApprovedByDono ? (
            <div className="space-y-3">
              <div className="text-sm p-3 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 rounded border border-green-200/50">
                Pedido de compra e autorização assinada pelo Dono!
              </div>
              <Button onClick={() => transitionToStatus("compra_pecas")}>
                Avançar para Recebimento de Peças
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm p-3 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300 rounded border border-yellow-200/50">
                Aguardando assinatura do Dono para a compra de peças.
              </div>
              {canSignPurchase && (
                <div className="panel p-4 space-y-3 bg-background">
                  <Label htmlFor="sig-purchase">Assinatura de Compra de Peças (Dono)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="sig-purchase"
                      placeholder="Nome do Dono"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                    />
                    <Button onClick={() => handleSign.mutate({ stage: "compra_pecas", role: "dono" })}>
                      Autorizar Compra
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );

    case 5: // Recebimento de Peças
      const isSec = hasRole(me, "secretaria", "dono");
      const isMec = os.mechanic_id === me?.userId;

      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 p-4 rounded-lg">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Fase 6: Recebimento e Conferência de Peças</h3>
              <p className="text-xs text-muted-foreground mt-0.5">As peças chegaram. A recepcionista deve tirar uma foto das peças no sistema, assinar e o mecânico também assina.</p>
            </div>
            {partsArrivalSignedBySecretary && partsArrivalSignedByMechanic && (
              <Button onClick={() => transitionToStatus("em_execucao")}>
                Liberar para Execução do Serviço
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <MediaSection
                serviceOrderId={os.id}
                stage="peca_nova"
                title="Foto das peças novas recebidas"
              />
            </div>

            <div className="space-y-3">
              {/* Secretary parts arrival signature */}
              <div className="panel p-4 space-y-2 bg-background">
                <h4 className="font-medium text-sm flex items-center gap-1">
                  {partsArrivalSignedBySecretary ? "✓ " : ""} Confirmação da Recepcionista
                </h4>
                <p className="text-xs text-muted-foreground">Assinar atestando o recebimento físico e upload da foto.</p>
                {partsArrivalSignedBySecretary ? (
                  <Badge className="bg-success text-success-foreground">Confirmado</Badge>
                ) : isSec ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Seu nome"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                    />
                    <Button onClick={() => handleSign.mutate({ stage: "compra_pecas", role: "secretaria" })}>
                      Assinar Recebimento
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Aguardando recepcionista</span>
                )}
              </div>

              {/* Mechanic parts arrival signature */}
              <div className="panel p-4 space-y-2 bg-background">
                <h4 className="font-medium text-sm flex items-center gap-1">
                  {partsArrivalSignedByMechanic ? "✓ " : ""} Confirmação do Mecânico
                </h4>
                <p className="text-xs text-muted-foreground">Assinar atestando conformidade das peças recebidas.</p>
                {partsArrivalSignedByMechanic ? (
                  <Badge className="bg-success text-success-foreground">Confirmado</Badge>
                ) : isMec ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Seu nome"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                    />
                    <Button onClick={() => handleSign.mutate({ stage: "compra_pecas", role: "mecanico" })}>
                      Aprovar Peças
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Aguardando mecânico</span>
                )}
              </div>
            </div>
          </div>
        </div>
      );

    case 6: // Execução
      const isMecExec = os.mechanic_id === me?.userId || hasRole(me, "dono", "gerente");
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 p-4 rounded-lg">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Fase 7: Execução do Serviço</h3>
              <p className="text-xs text-muted-foreground mt-0.5">O veículo está com as peças liberadas. Mecânico deve realizar a manutenção e concluir o serviço.</p>
            </div>
            {isMecExec && (
              <Button
                onClick={() => {
                  transitionToStatus("concluido");
                }}
              >
                Concluir e Finalizar Serviço <CheckCircle2 className="size-4 ml-1.5" />
              </Button>
            )}
          </div>
          <div className="text-sm p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 rounded border border-blue-200/50">
            Veículo em manutenção pelo mecânico: <strong>{mechanics.find((m) => m.id === os.mechanic_id)?.full_name ?? "—"}</strong>.
          </div>
        </div>
      );

    case 7: // Concluído
      const isSecDelivery = hasRole(me, "secretaria", "gerente", "dono");
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/20 p-4 rounded-lg">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Fase 8: Pronto para Entrega</h3>
              <p className="text-xs text-muted-foreground mt-0.5">O serviço foi finalizado. Aguardando a retirada do veículo e a entrega formal ao cliente pela secretaria.</p>
            </div>
            {isSecDelivery && (
              <Button
                onClick={() => {
                  transitionToStatus("entregue");
                }}
              >
                Confirmar Entrega do Veículo <CheckCircle2 className="size-4 ml-1.5" />
              </Button>
            )}
          </div>
          <div className="text-sm p-3 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300 rounded border border-green-200/50">
            Serviço finalizado pelo mecânico! Pronto para entrega.
          </div>
        </div>
      );

    case 8: // Entregue
      return (
        <div className="space-y-4 text-center p-6 bg-success/10 border border-success/30 rounded-xl">
          <CheckCircle2 className="size-12 mx-auto text-success" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Ordem de Serviço Encerrada!</h3>
          <p className="text-sm text-muted-foreground">O veículo foi entregue ao cliente e todos os processos de assinatura e conferência foram finalizados com sucesso.</p>
        </div>
      );

    default:
      return null;
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words font-medium">{value?.trim() ? value : "—"}</p>
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
  osData,
  onChange,
}: {
  serviceOrderId: string;
  osData?: any;
  onChange: () => void;
}) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const visible = can(me, "ver_financeiro") || hasRole(me, "secretaria");
  
  const [items, setItems] = useState<{ id: string, kind: "peca" | "servico", description: string, quantity: number, unit_price: number, total: number }[]>([]);
  const [newPart, setNewPart] = useState({ description: "", quantity: 1, unit_price: "" });
  const [newService, setNewService] = useState({ description: "", quantity: 1, unit_price: "" });
  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [notes, setNotes] = useState("");
  
  const [po, setPo] = useState({ supplier: "", description: "", total: "", refCode: "", term: "a_vista", paymentStatus: "pendente" });
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [printState, setPrintState] = useState<{ id: string, action: "pdf" | "image" } | null>(null);

  useEffect(() => {
    if (printState) {
      setTimeout(async () => {
        if (printState.action === "pdf") {
          window.print();
        } else if (printState.action === "image") {
          const el = document.getElementById("printable-quote");
          if (el) {
            try {
              const dataUrl = await htmlToImage.toPng(el, { quality: 1, pixelRatio: 2 });
              const link = document.createElement("a");
              link.download = `orcamento-${osData?.number || "export"}.png`;
              link.href = dataUrl;
              link.click();
            } catch (e) {
              toast.error("Erro ao gerar imagem");
            }
          }
        }
        setPrintState(null);
      }, 500); // Wait for render
    }
  }, [printState, osData]);

  const quotes = useQuery({
    enabled: visible,
    queryKey: ["quotes", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, quote_items(*)")
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

  const handleAddPart = () => {
    if (!newPart.description) return toast.error("Informe a descrição da peça");
    const up = Number(newPart.unit_price) || 0;
    const qty = Number(newPart.quantity) || 1;
    if (up <= 0) return toast.error("Informe um preço válido");
    setItems([...items, { id: crypto.randomUUID(), kind: "peca", description: newPart.description.trim(), quantity: qty, unit_price: up, total: up * qty }]);
    setNewPart({ description: "", quantity: 1, unit_price: "" });
  };

  const handleAddService = () => {
    if (!newService.description) return toast.error("Informe a descrição do serviço");
    const up = Number(newService.unit_price) || 0;
    const qty = Number(newService.quantity) || 1;
    if (up <= 0) return toast.error("Informe um preço válido");
    setItems([...items, { id: crypto.randomUUID(), kind: "servico", description: newService.description.trim(), quantity: qty, unit_price: up, total: up * qty }]);
    setNewService({ description: "", quantity: 1, unit_price: "" });
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const partsTotal = items.filter(i => i.kind === "peca").reduce((sum, i) => sum + i.total, 0);
  const laborTotal = items.filter(i => i.kind === "servico").reduce((sum, i) => sum + i.total, 0);

  const createQuote = useMutation({
    mutationFn: async () => {
      const disc = Number(discount || 0);
      
      let finalNotes = notes.trim();
      if (!editingQuoteId) {
        const headers = [];
        if (disc > 0) headers.push(`Desconto concedido: R$ ${disc.toFixed(2)}`);
        if (paymentMethod) headers.push(`Forma de pagamento: ${paymentMethod.toUpperCase()}`);
        
        if (headers.length > 0) {
          finalNotes = `${headers.join(" | ")}\n\n${finalNotes}`.trim();
        }
      }

      const { data: userData } = await supabase.auth.getUser();
      const quotePayload = {
        service_order_id: serviceOrderId,
        parts_total: partsTotal,
        labor_total: laborTotal,
        total: Math.max(0, partsTotal + laborTotal - disc),
        notes: finalNotes || null,
      };

      let quoteId = editingQuoteId;

      if (editingQuoteId) {
        const { error: quoteError } = await supabase.from("quotes").update(quotePayload).eq("id", editingQuoteId);
        if (quoteError) throw new Error(quoteError.message);
        
        const { error: delError } = await supabase.from("quote_items").delete().eq("quote_id", editingQuoteId);
        if (delError) throw new Error(delError.message);
      } else {
        const { data: quoteData, error: quoteError } = await supabase.from("quotes").insert({
          ...quotePayload,
          created_by: userData.user?.id ?? null,
        }).select("id").single();
        if (quoteError) throw new Error(quoteError.message);
        quoteId = quoteData.id;
      }

      if (items.length > 0 && quoteId) {
        const { error: itemsError } = await supabase.from("quote_items").insert(
          items.map(i => ({
            quote_id: quoteId,
            kind: i.kind,
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
            total: i.total
          }))
        );
        if (itemsError) throw new Error(itemsError.message);
      }
    },
    onSuccess: () => {
      setItems([]);
      setDiscount("");
      setNotes("");
      setEditingQuoteId(null);
      toast.success(editingQuoteId ? "Orçamento atualizado." : "Orçamento lançado.");
      queryClient.invalidateQueries({ queryKey: ["quotes", serviceOrderId] });
      onChange();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleEditQuote = (q: any) => {
    setEditingQuoteId(q.id);
    setNewPart({ description: "", quantity: 1, unit_price: "" });
    setNewService({ description: "", quantity: 1, unit_price: "" });
    setDiscount((q.parts_total + q.labor_total - q.total).toString());
    setNotes(q.notes || "");
    setItems((q.quote_items || []).map((i: any) => ({
      id: crypto.randomUUID(),
      kind: i.kind,
      description: i.description,
      quantity: i.quantity,
      unit_price: Number(i.unit_price || 0),
      total: Number(i.total || 0)
    })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createPo = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const descJson = JSON.stringify({
        text: po.description.trim(),
        refCode: po.refCode.trim(),
        term: po.term
      });

      const { error } = await supabase.from("purchase_orders").insert({
        service_order_id: serviceOrderId,
        supplier: po.supplier.trim() || null,
        description: descJson,
        status: po.paymentStatus,
        total: Number(po.total || 0),
        created_by: userData.user?.id ?? null,
      });
      if (error) throw new Error(error.message);

      if (po.paymentStatus === "pago") {
        await supabase.from("expenses").insert({
          description: `Peça OS #${osData?.number} - Fornecedor: ${po.supplier}`,
          category: "pecas",
          amount: Number(po.total || 0),
          spent_at: new Date().toISOString(),
          created_by: userData.user?.id ?? null,
        });
      }
    },
    onSuccess: () => {
      setPo({ supplier: "", description: "", total: "", refCode: "", term: "a_vista", paymentStatus: "pendente" });
      toast.success("Pedido de compra registrado.");
      queryClient.invalidateQueries({ queryKey: ["purchase_orders", serviceOrderId] });
      queryClient.invalidateQueries({ queryKey: ["caixa"] });
      onChange();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const payPo = useMutation({
    mutationFn: async (p: any) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("purchase_orders").update({ status: "pago" }).eq("id", p.id);
      if (error) throw new Error(error.message);

      await supabase.from("expenses").insert({
        description: `Peça OS #${osData?.number} - Fornecedor: ${p.supplier}`,
        category: "pecas",
        amount: Number(p.total || 0),
        spent_at: new Date().toISOString(),
        created_by: userData.user?.id ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Pagamento do fornecedor registrado no caixa.");
      queryClient.invalidateQueries({ queryKey: ["purchase_orders", serviceOrderId] });
      queryClient.invalidateQueries({ queryKey: ["caixa"] });
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
      {printState && (
        <PrintableQuote osData={osData} quote={quotes.data?.find(q => q.id === printState.id)} forceVisible={printState.action === "image"} />
      )}

      <div className="panel space-y-3 p-4">
        <h2 className="font-display text-lg">{editingQuoteId ? "Editar Orçamento" : "Novo Orçamento"}</h2>
        
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Peças Form */}
          <div className="bg-blue-50/50 p-3 rounded-md border space-y-2">
            <h3 className="font-semibold text-sm text-blue-800">Adicionar Peça</h3>
            <Input 
              placeholder="Descrição da peça" 
              className="bg-white"
              value={newPart.description}
              onChange={(e) => setNewPart({ ...newPart, description: e.target.value })}
            />
            <div className="flex gap-2 items-end">
              <div className="w-[80px]">
                <Label className="text-[10px]">Qtd</Label>
                <Input type="number" min="1" className="bg-white" value={newPart.quantity} onChange={(e) => setNewPart({ ...newPart, quantity: e.target.value })} />
              </div>
              <div className="flex-1">
                <Label className="text-[10px]">Preço Unitário (R$)</Label>
                <Input type="number" step="0.01" className="bg-white" value={newPart.unit_price} onChange={(e) => setNewPart({ ...newPart, unit_price: e.target.value })} />
              </div>
              <Button type="button" variant="secondary" onClick={handleAddPart}>+ Peça</Button>
            </div>
          </div>

          {/* Serviços Form */}
          <div className="bg-green-50/50 p-3 rounded-md border space-y-2">
            <h3 className="font-semibold text-sm text-green-800">Adicionar Serviço</h3>
            <Input 
              placeholder="Descrição do serviço" 
              className="bg-white"
              value={newService.description}
              onChange={(e) => setNewService({ ...newService, description: e.target.value })}
            />
            <div className="flex gap-2 items-end">
              <div className="w-[80px]">
                <Label className="text-[10px]">Qtd</Label>
                <Input type="number" min="1" className="bg-white" value={newService.quantity} onChange={(e) => setNewService({ ...newService, quantity: e.target.value })} />
              </div>
              <div className="flex-1">
                <Label className="text-[10px]">Preço Unitário (R$)</Label>
                <Input type="number" step="0.01" className="bg-white" value={newService.unit_price} onChange={(e) => setNewService({ ...newService, unit_price: e.target.value })} />
              </div>
              <Button type="button" variant="secondary" onClick={handleAddService}>+ Serviço</Button>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="border rounded-md overflow-hidden text-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-xs">
                <tr>
                  <th className="p-2 font-medium">Item</th>
                  <th className="p-2 font-medium text-right">Preço</th>
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map(i => (
                  <tr key={i.id}>
                    <td className="p-2">
                      <div className="font-medium">{i.description}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{i.kind} • Qtd: {i.quantity}</div>
                    </td>
                    <td className="p-2 text-right">{brl(i.total)}</td>
                    <td className="p-2 text-right">
                      <button onClick={() => removeItem(i.id)} className="text-red-500 hover:text-red-700">
                        <XCircle className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 mt-4">
          <div className="space-y-2">
            <Label htmlFor="discount">Desconto Global (R$)</Label>
            <Input
              id="discount"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Textarea
          rows={3}
          placeholder="Observações do orçamento"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        
        <div className="flex justify-between items-center py-2 border-t gap-4">
          <div className="text-sm">
            <p className="text-muted-foreground">Peças: {brl(partsTotal)} | M.O: {brl(laborTotal)}</p>
            <p className="font-bold text-lg text-primary">Total: {brl(Math.max(0, partsTotal + laborTotal - Number(discount || 0)))}</p>
          </div>
          <div className="flex gap-2">
            {editingQuoteId && (
              <Button variant="outline" onClick={() => {
                setEditingQuoteId(null);
                setItems([]);
                setDiscount("");
                setNotes("");
              }}>
                Cancelar
              </Button>
            )}
            <Button onClick={() => createQuote.mutate()} disabled={createQuote.isPending || items.length === 0}>
              {editingQuoteId ? "Salvar Alterações" : "Lançar Orçamento"}
            </Button>
          </div>
        </div>
      </div>

      {(quotes.data ?? []).map((q) => {
        const handleSendQuote = () => {
          if (!osData) return;
          const rawPhone = osData.clients?.phone ?? osData.companies?.phone ?? "";
          let phone = rawPhone ? rawPhone.replace(/\D/g, "") : "";
          if (phone.length === 11 && !phone.startsWith("55")) {
            phone = "55" + phone;
          }
          const plate = osData.vehicles?.plate ? ` (Placa: ${osData.vehicles.plate})` : "";
          const message = `Olá! Segue o orçamento para o veículo${plate}:\n\nPeças: ${brl(Number(q.parts_total))}\nMão de obra: ${brl(Number(q.labor_total))}\n*Total: ${brl(Number(q.total))}*\n\n${q.notes ? `Observações:\n${q.notes}` : ""}\n\nAguardo sua aprovação.`;
          const whatsappUrl = phone 
            ? `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
          window.open(whatsappUrl, "_blank");
        };

        return (
          <div key={q.id} className="panel p-4 text-sm relative">
            <div className="absolute top-4 right-4 flex gap-2">
              {osData && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 px-2"
                  onClick={handleSendQuote}
                >
                  <Send className="size-3 mr-1.5" /> WhatsApp
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 px-2"
                onClick={() => handleEditQuote(q)}
              >
                <Pencil className="size-3 mr-1.5" /> Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 px-2"
                onClick={() => setPrintState({ id: q.id, action: "image" })}
              >
                <ImageIcon className="size-3 mr-1.5" /> Imagem
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 px-2"
                onClick={() => setPrintState({ id: q.id, action: "pdf" })}
              >
                <Printer className="size-3 mr-1.5" /> PDF
              </Button>
            </div>
            <p className="font-display text-2xl leading-none text-primary">{brl(Number(q.total))}</p>
            <p className="mt-1 text-xs text-muted-foreground pr-48">
              Peças {brl(Number(q.parts_total))} · Mão de obra {brl(Number(q.labor_total))} ·{" "}
              {new Date(q.created_at).toLocaleDateString("pt-BR")}
            </p>
            
            {q.quote_items && q.quote_items.length > 0 && (
              <div className="mt-3 bg-slate-50 border rounded p-2 text-xs">
                {q.quote_items.map((i: any) => (
                  <div key={i.id} className="flex justify-between border-b last:border-0 py-1">
                    <div className="truncate pr-4 flex-1">{i.description}</div>
                    <div className="w-12 text-right">{i.quantity}x</div>
                    <div className="w-20 text-right font-medium">{brl(Number(i.total))}</div>
                  </div>
                ))}
              </div>
            )}

            {q.notes ? <p className="mt-3 whitespace-pre-wrap">{q.notes}</p> : null}
          </div>
        );
      })}

      <div className="panel space-y-3 p-4 print:hidden">
        <h2 className="font-display text-lg">Pedido de compra de peças</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Fornecedor" value={po.supplier} onChange={(e) => setPo({ ...po, supplier: e.target.value })} />
          <Input placeholder="Cód. Referência (Opcional)" value={po.refCode} onChange={(e) => setPo({ ...po, refCode: e.target.value })} />
        </div>
        <Textarea rows={2} placeholder="Peças solicitadas" value={po.description} onChange={(e) => setPo({ ...po, description: e.target.value })} />
        
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Valor Total (R$)</Label>
            <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00" value={po.total} onChange={(e) => setPo({ ...po, total: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Forma de Pagto</Label>
            <Select value={po.term} onValueChange={(v) => setPo({ ...po, term: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a_vista">À vista</SelectItem>
                <SelectItem value="a_prazo">A prazo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={po.paymentStatus} onValueChange={(v) => setPo({ ...po, paymentStatus: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Já Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Button variant="secondary" className="w-full" onClick={() => createPo.mutate()} disabled={createPo.isPending}>
          Registrar pedido de compra
        </Button>
      </div>

      {(purchases.data ?? []).map((p) => {
        let meta = { text: p.description, refCode: "", term: "" };
        try { meta = JSON.parse(p.description || "{}"); } catch(e) {}
        if (!meta.text) meta.text = p.description;

        return (
          <div key={p.id} className="panel p-4 text-sm print:hidden">
            <div className="flex items-center justify-between">
              <p className="font-medium">{p.supplier ?? "Fornecedor não informado"}</p>
              <Badge variant={p.status === "pago" ? "secondary" : "outline"} className={p.status === "pago" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                {p.status === "pago" ? "Pago" : "Pendente"}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center mt-1">
              <p className="font-display text-lg leading-none">{brl(Number(p.total))}</p>
              <p className="text-[10px] text-muted-foreground uppercase">
                {meta.term === "a_prazo" ? "A Prazo" : meta.term === "a_vista" ? "À Vista" : ""}
              </p>
            </div>
            
            {meta.refCode ? <p className="text-xs font-mono text-muted-foreground mt-1">Ref: {meta.refCode}</p> : null}
            {meta.text ? <p className="mt-2 whitespace-pre-wrap">{meta.text}</p> : null}

            {p.status !== "pago" && (
              <Button size="sm" variant="outline" className="w-full mt-3 gap-2" onClick={() => payPo.mutate(p)} disabled={payPo.isPending}>
                <CheckCircle2 className="size-4" /> Marcar como Pago e Baixar Caixa
              </Button>
            )}
          </div>
        );
      })}
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

  const canRequest = can(me, "cadastrar_os") || hasRole(me, "secretaria");

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
