import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe, can, hasRole } from "@/hooks/useMe";
import { PAYMENT_METHOD_LABELS, brl } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PaymentsPanel({ serviceOrderId }: { serviceOrderId: string }) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const visible = can(me, "ver_financeiro");
  const [form, setForm] = useState({ amount: "", method: "pix", note: "" });

  const payments = useQuery({
    enabled: visible,
    queryKey: ["payments", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, method, paid_at, note")
        .eq("service_order_id", serviceOrderId)
        .order("paid_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const quoteTotal = useQuery({
    enabled: visible,
    queryKey: ["quote-total", serviceOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("total")
        .eq("service_order_id", serviceOrderId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw new Error(error.message);
      return Number(data?.[0]?.total ?? 0);
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["caixa"] });
  };

  const addPayment = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount.replace(",", "."));
      if (!amount || amount <= 0) throw new Error("Informe um valor válido.");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("payments").insert({
        service_order_id: serviceOrderId,
        amount,
        method: form.method as never,
        note: form.note.trim() || null,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Recebimento lançado.");
      setForm({ amount: "", method: form.method, note: "" });
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removePayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Recebimento removido.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!visible) {
    return (
      <p className="panel p-6 text-center text-sm text-muted-foreground">
        Você não tem permissão para ver valores desta ordem.
      </p>
    );
  }

  const total = (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
  const orcado = quoteTotal.data ?? 0;
  const saldo = orcado - total;

  return (
    <div className="space-y-3">
      <section className="panel grid grid-cols-3 gap-2 p-4 text-center">
        <Stat label="Orçado" value={brl(orcado)} />
        <Stat label="Recebido" value={brl(total)} tone="ok" />
        <Stat label="Saldo" value={brl(saldo)} tone={saldo > 0 ? "warn" : "ok"} />
      </section>

      <section className="panel space-y-3 p-4">
        <h2 className="font-display text-lg">Lançar recebimento</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Valor (R$)</Label>
            <Input
              id="pay-amount"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0,00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-method">Forma</Label>
            <Select
              value={form.method}
              onValueChange={(method) => setForm((f) => ({ ...f, method }))}
            >
              <SelectTrigger id="pay-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(PAYMENT_METHOD_LABELS).map((value) => (
                  <SelectItem key={value} value={value}>
                    {PAYMENT_METHOD_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-note">Observação</Label>
            <Input
              id="pay-note"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Ex.: entrada, parcela 1/2"
            />
          </div>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => addPayment.mutate()}
          disabled={addPayment.isPending}
        >
          {addPayment.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Lançar
        </Button>
      </section>

      <section className="panel divide-y p-0">
        {(payments.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg leading-none">{brl(Number(p.amount))}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(p.paid_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                {p.note ? ` · ${p.note}` : ""}
              </p>
            </div>
            <Badge variant="secondary">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</Badge>
            {hasRole(me, "dono") ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover recebimento"
                onClick={() => removePayment.mutate(p.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
        {(payments.data ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum recebimento lançado.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "ok" | "warn";
}) {
  const toneClass =
    tone === "ok" ? "text-success" : tone === "warn" ? "text-destructive" : "text-primary";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-display text-xl leading-tight ${toneClass}`}>{value}</p>
    </div>
  );
}
