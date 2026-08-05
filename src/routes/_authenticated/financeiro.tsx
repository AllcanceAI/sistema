import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, TrendingDown, TrendingUp, Wallet, FileText, CheckCircle, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useMe, hasRole } from "@/hooks/useMe";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  brl,
  monthRange,
  toDateInput,
} from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro e caixa — Oficina" },
      {
        name: "description",
        content: "Recebimentos, despesas, saldo do caixa e faturamento por período da oficina.",
      },
      { property: "og:title", content: "Financeiro e caixa — Oficina" },
      { property: "og:description", content: "Controle de caixa, recebimentos e despesas da oficina." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Financeiro,
});

function Financeiro() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const initial = monthRange();
  const [from, setFrom] = useState(toDateInput(initial.start));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [expense, setExpense] = useState({
    description: "",
    category: "pecas",
    amount: "",
    spentAt: toDateInput(new Date()),
  });

  const allowed = hasRole(me, "dono", "gerente", "contabilidade");
  const fromIso = new Date(`${from}T00:00:00`).toISOString();
  const toIso = new Date(`${to}T23:59:59`).toISOString();

  const payments = useQuery({
    enabled: allowed,
    queryKey: ["caixa", "payments", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, amount, method, paid_at, note, service_orders(number, vehicles(plate), clients(name), companies(name))",
        )
        .gte("paid_at", fromIso)
        .lte("paid_at", toIso)
        .order("paid_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const expenses = useQuery({
    enabled: allowed,
    queryKey: ["caixa", "expenses", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, description, category, amount, spent_at")
        .gte("spent_at", fromIso)
        .lte("spent_at", toIso)
        .order("spent_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const osSummary = useQuery({
    enabled: allowed,
    queryKey: ["caixa", "os_summary", fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(`
          id,
          status,
          created_at,
          quotes (total, created_at),
          payments (amount)
        `)
        .gte("created_at", fromIso)
        .lte("created_at", toIso);

      if (error) throw new Error(error.message);

      let countPendente = 0;
      let countFinalizado = 0;
      let countPago = 0;
      let valorPendente = 0;
      let valorFinalizado = 0;
      let valorPago = 0;

      for (const os of data || []) {
        const latestQuote = os.quotes?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const osTotal = latestQuote ? Number(latestQuote.total) : 0;
        
        const osPaid = (os.payments || []).reduce((sum: number, p: any) => sum + Number(p.amount), 0);

        if (os.status === "orcamento" || os.status === "aguardando_aprovacao") {
          countPendente++;
          valorPendente += osTotal;
        } else if (os.status !== "recebido" && os.status !== "checklist" && os.status !== "diagnostico") {
          countFinalizado++;
          valorFinalizado += osTotal;

          if (osTotal > 0 && osPaid >= osTotal) {
            countPago++;
            valorPago += osTotal;
          }
        }
      }

      return {
        countPendente,
        valorPendente,
        countFinalizado,
        valorFinalizado,
        countPago,
        valorPago,
      };
    }
  });

  const addExpense = useMutation({
    mutationFn: async () => {
      const amount = Number(expense.amount.replace(",", "."));
      if (!expense.description.trim()) throw new Error("Descreva a despesa.");
      if (!amount || amount <= 0) throw new Error("Informe um valor válido.");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("expenses").insert({
        description: expense.description.trim(),
        category: expense.category,
        amount,
        spent_at: new Date(`${expense.spentAt}T12:00:00`).toISOString(),
        created_by: userData.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Despesa lançada.");
      setExpense({ ...expense, description: "", amount: "" });
      queryClient.invalidateQueries({ queryKey: ["caixa"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["caixa"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const totals = useMemo(() => {
    const entrada = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const saida = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
    const porForma: Record<string, number> = {};
    for (const p of payments.data ?? []) {
      porForma[p.method] = (porForma[p.method] ?? 0) + Number(p.amount);
    }
    return { entrada, saida, saldo: entrada - saida, porForma };
  }, [payments.data, expenses.data]);

  if (!allowed) {
    return (
      <AppShell title="Financeiro">
        <p className="panel p-6 text-center text-sm text-muted-foreground">
          Área restrita ao dono, gerentes e contabilidade.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Financeiro e caixa" subtitle="Recebimentos, despesas e saldo do período">
      <section className="panel grid gap-3 p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="from">De</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Até</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </section>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Kpi label="Entradas" value={brl(totals.entrada)} icon={<TrendingUp className="size-4" />} tone="ok" />
        <Kpi label="Saídas" value={brl(totals.saida)} icon={<TrendingDown className="size-4" />} tone="warn" />
        <Kpi label="Saldo" value={brl(totals.saldo)} icon={<Wallet className="size-4" />} tone={totals.saldo < 0 ? "warn" : "default"} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Kpi label={`Orçamentos Pendentes (${osSummary.data?.countPendente || 0})`} value={brl(osSummary.data?.valorPendente || 0)} icon={<FileText className="size-4" />} tone="warn" />
        <Kpi label={`Orçamentos Aprovados (${osSummary.data?.countFinalizado || 0})`} value={brl(osSummary.data?.valorFinalizado || 0)} icon={<CheckCircle className="size-4" />} tone="ok" />
        <Kpi label={`OS Totalmente Pagas (${osSummary.data?.countPago || 0})`} value={brl(osSummary.data?.valorPago || 0)} icon={<CheckCheck className="size-4" />} tone="ok" />
      </div>

      {Object.keys(totals.porForma).length > 0 ? (
        <section className="panel mt-3 flex flex-wrap gap-2 p-4">
          {Object.keys(totals.porForma).map((method) => (
            <Badge key={method} variant="secondary" className="text-xs">
              {PAYMENT_METHOD_LABELS[method] ?? method}: {brl(totals.porForma[method] ?? 0)}
            </Badge>
          ))}
        </section>
      ) : null}

      <Tabs defaultValue="entradas" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="entradas" className="flex-1">
            Entradas
          </TabsTrigger>
          <TabsTrigger value="saidas" className="flex-1">
            Saídas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entradas" className="mt-3">
          <section className="panel divide-y p-0">
            {payments.isLoading ? (
              <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />
            ) : null}
            {(payments.data ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg leading-none">{brl(Number(p.amount))}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    OS #{p.service_orders?.number ?? "—"} ·{" "}
                    {p.service_orders?.vehicles?.plate ?? "sem placa"} ·{" "}
                    {p.service_orders?.companies?.name ?? p.service_orders?.clients?.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.paid_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <Badge variant="secondary">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</Badge>
              </div>
            ))}
            {!payments.isLoading && (payments.data ?? []).length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhum recebimento no período.
              </p>
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="saidas" className="mt-3 space-y-3">
          <section className="panel space-y-3 p-4">
            <h2 className="font-display text-lg">Lançar despesa</h2>
            <div className="space-y-2">
              <Label htmlFor="exp-desc">Descrição</Label>
              <Input
                id="exp-desc"
                value={expense.description}
                onChange={(e) => setExpense((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex.: kit de pastilhas, conta de luz"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="exp-cat">Categoria</Label>
                <Select
                  value={expense.category}
                  onValueChange={(category) => setExpense((f) => ({ ...f, category }))}
                >
                  <SelectTrigger id="exp-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-amount">Valor (R$)</Label>
                <Input
                  id="exp-amount"
                  inputMode="decimal"
                  value={expense.amount}
                  onChange={(e) => setExpense((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exp-date">Data</Label>
                <Input
                  id="exp-date"
                  type="date"
                  value={expense.spentAt}
                  onChange={(e) => setExpense((f) => ({ ...f, spentAt: e.target.value }))}
                />
              </div>
            </div>
            <Button
              className="w-full sm:w-auto"
              onClick={() => addExpense.mutate()}
              disabled={addExpense.isPending}
            >
              {addExpense.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Lançar despesa
            </Button>
          </section>

          <section className="panel divide-y p-0">
            {(expenses.data ?? []).map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg leading-none">{brl(Number(e.amount))}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.description} ·{" "}
                    {new Date(e.spent_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <Badge variant="secondary">
                  {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                </Badge>
                {hasRole(me, "dono") ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover despesa"
                    onClick={() => removeExpense.mutate(e.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            ))}
            {(expenses.data ?? []).length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma despesa no período.
              </p>
            ) : null}
          </section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "default" | "ok" | "warn";
}) {
  const toneClass =
    tone === "ok" ? "text-success" : tone === "warn" ? "text-destructive" : "text-primary";
  return (
    <div className="panel p-4">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={`font-display text-2xl leading-tight ${toneClass}`}>{value}</p>
    </div>
  );
}
