import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import hmLogo from "@/assets/hm-logo.png.asset.json";
import { OS_STATUS_LABELS, APPROVAL_STAGE_LABELS, ROLE_LABELS } from "@/lib/roles";
import { brl } from "@/lib/finance";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/imprimir/$id")({
  head: () => ({
    meta: [
      { title: "Orçamento e laudo para impressão — Oficina" },
      {
        name: "description",
        content: "Versão para impressão ou PDF do orçamento, laudo e aprovações da ordem de serviço.",
      },
      { property: "og:title", content: "Orçamento e laudo para impressão — Oficina" },
      { property: "og:description", content: "Documento imprimível da ordem de serviço." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => (
    <div className="p-8 text-center text-sm">Não foi possível carregar o documento.</div>
  ),
  notFoundComponent: () => <div className="p-8 text-center text-sm">Ordem não encontrada.</div>,
  component: Imprimir,
});

function Imprimir() {
  const { id } = Route.useParams();

  const doc = useQuery({
    queryKey: ["print", id],
    queryFn: async () => {
      const [order, quotes, approvals, payments] = await Promise.all([
        supabase
          .from("service_orders")
          .select(
            "*, vehicles(plate, brand, model, year, color, km), clients(name, phone, email, document), companies(name, cnpj, phone)",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("quotes")
          .select("id, labor_total, parts_total, total, notes, created_at, quote_items(description, kind, quantity, unit_price, total)")
          .eq("service_order_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("approvals")
          .select("stage, required_role, decision, signature, note, decided_at")
          .eq("service_order_id", id)
          .order("created_at"),
        supabase
          .from("payments")
          .select("amount, method, paid_at")
          .eq("service_order_id", id),
      ]);
      if (order.error) throw new Error(order.error.message);
      return {
        os: order.data,
        quote: quotes.data?.[0] ?? null,
        approvals: approvals.data ?? [],
        payments: payments.data ?? [],
      };
    },
  });

  if (doc.isLoading) {
    return <Loader2 className="mx-auto my-16 size-6 animate-spin text-muted-foreground" />;
  }

  const os = doc.data?.os;
  if (!os) {
    return <p className="p-8 text-center text-sm">Ordem não encontrada.</p>;
  }

  const quote = doc.data?.quote ?? null;
  const recebido = (doc.data?.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="min-h-dvh bg-background print:bg-white">
      <div className="mx-auto max-w-3xl p-4 print:max-w-none print:p-0">
        <div className="mb-4 flex items-center justify-between gap-2 print:hidden">
          <Button asChild variant="outline" size="sm">
            <Link to="/os/$id" params={{ id }}>
              <ArrowLeft className="size-4" /> Voltar
            </Link>
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimir / salvar PDF
          </Button>
        </div>

        <article className="panel space-y-5 p-6 text-sm print:border-0 print:shadow-none">
          <header className="flex items-start justify-between gap-4 border-b pb-3">
            <div>
              <img src={hmLogo.url} alt="HM Auto Elétrica" className="mb-1 w-44" />
              <p className="text-xs text-muted-foreground">
                Orçamento e laudo técnico · Documento gerado pelo sistema
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl leading-none">OS #{os.number}</p>
              <p className="text-xs text-muted-foreground">
                {os.mode === "express" ? "Express" : "Análise completa"} ·{" "}
                {OS_STATUS_LABELS[os.status]}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(os.created_at).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </header>

          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Row label="Cliente" value={os.clients?.name ?? "—"} />
            <Row label="Empresa credenciada" value={os.companies?.name ?? "Cliente particular"} />
            <Row label="Telefone" value={os.clients?.phone ?? os.companies?.phone ?? "—"} />
            <Row label="E-mail" value={os.clients?.email ?? "—"} />
            <Row
              label="Veículo"
              value={`${os.vehicles?.brand ?? ""} ${os.vehicles?.model ?? ""} ${os.vehicles?.year ?? ""}`.trim() || "—"}
            />
            <Row label="Placa" value={os.vehicles?.plate ?? "—"} />
            <Row label="Cor" value={os.vehicles?.color ?? "—"} />
            <Row label="Km" value={os.vehicles?.km ? String(os.vehicles.km) : "—"} />
          </div>

          <Block title="Reclamação do cliente" text={os.complaint} />
          <Block title="Diagnóstico técnico" text={os.diagnosis} />
          <Block title="Solução proposta" text={os.solution} />
          <Block title="Laudo final" text={os.final_report} />

          <section>
            <h2 className="font-display text-lg uppercase">Orçamento</h2>
            {quote ? (
              <>
                <table className="mt-2 w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b text-left uppercase text-muted-foreground">
                      <th className="py-1">Item</th>
                      <th className="py-1">Tipo</th>
                      <th className="py-1 text-right">Qtd</th>
                      <th className="py-1 text-right">Unit.</th>
                      <th className="py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(quote.quote_items ?? []).map((item, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-1">{item.description}</td>
                        <td className="py-1">{item.kind === "peca" ? "Peça" : "Mão de obra"}</td>
                        <td className="py-1 text-right">{Number(item.quantity)}</td>
                        <td className="py-1 text-right">{brl(Number(item.unit_price))}</td>
                        <td className="py-1 text-right">{brl(Number(item.total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 space-y-1 text-right text-sm">
                  <p>Peças: {brl(Number(quote.parts_total))}</p>
                  <p>Mão de obra: {brl(Number(quote.labor_total))}</p>
                  <p className="font-display text-xl">Total: {brl(Number(quote.total))}</p>
                  {recebido > 0 ? (
                    <>
                      <p>Recebido: {brl(recebido)}</p>
                      <p>Saldo: {brl(Number(quote.total) - recebido)}</p>
                    </>
                  ) : null}
                </div>
                {quote.notes ? (
                  <p className="mt-2 text-xs text-muted-foreground">Obs.: {quote.notes}</p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">Nenhum orçamento lançado.</p>
            )}
          </section>

          <section>
            <h2 className="font-display text-lg uppercase">Aprovações registradas</h2>
            {(doc.data?.approvals ?? []).length === 0 ? (
              <p className="text-muted-foreground">Nenhuma aprovação registrada.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs">
                {(doc.data?.approvals ?? []).map((a, index) => (
                  <li key={index} className="flex flex-wrap justify-between gap-2 border-b py-1">
                    <span>
                      {APPROVAL_STAGE_LABELS[a.stage] ?? a.stage} ·{" "}
                      {ROLE_LABELS[a.required_role as keyof typeof ROLE_LABELS] ?? a.required_role}
                    </span>
                    <span>
                      {a.decision === "aprovado"
                        ? "Aprovado"
                        : a.decision === "reprovado"
                          ? "Reprovado"
                          : "Pendente"}
                      {a.signature ? ` — ${a.signature}` : ""}
                      {a.decided_at
                        ? ` — ${new Date(a.decided_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-8 pt-8 sm:grid-cols-2">
            <SignatureLine label="Assinatura do cliente / empresa" />
            <SignatureLine label="Responsável pela oficina" />
          </section>
        </article>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}: </span>
      <span>{value?.trim() ? value : "—"}</span>
    </div>
  );
}

function Block({ title, text }: { title: string; text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <section>
      <h2 className="font-display text-lg uppercase">{title}</h2>
      <p className="whitespace-pre-wrap">{text}</p>
    </section>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div className="border-t pt-1 text-center text-xs text-muted-foreground">{label}</div>
  );
}
