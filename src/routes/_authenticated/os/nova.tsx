import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lookupPlate } from "@/lib/placa.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type NovaOsSearch = {
  appointmentId?: string;
  clientName?: string;
  phone?: string;
  plate?: string;
  complaint?: string;
};

export const Route = createFileRoute("/_authenticated/os/nova")({
  validateSearch: (search: Record<string, unknown>): NovaOsSearch => {
    return {
      appointmentId: search.appointmentId as string | undefined,
      clientName: search.clientName as string | undefined,
      phone: search.phone as string | undefined,
      plate: search.plate as string | undefined,
      complaint: search.complaint as string | undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Nova ordem de serviço — Oficina" },
      { name: "description", content: "Registrar entrada de veículo: cliente, empresa, placa e laudo inicial." },
      { property: "og:title", content: "Nova ordem de serviço — Oficina" },
      { property: "og:description", content: "Registro de entrada de veículo na oficina." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NovaOs,
});

function NovaOs() {
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const [mode, setMode] = useState<"express" | "analise">("express");
  const [form, setForm] = useState({
    clientName: searchParams.clientName || "",
    phone: searchParams.phone || "",
    email: "",
    companyId: "",
    plate: searchParams.plate || "",
    brand: "",
    model: "",
    year: "",
    color: "",
    km: "",
    complaint: searchParams.complaint || "",
    estimatedMinutes: "60",
    mechanicId: "",
    cpf: "",
    birthDate: "",
  });

  const [docError, setDocError] = useState("");

  const validateDocument = (doc: string) => {
    const raw = doc.replace(/[^\d]+/g, "");
    if (raw.length === 11) {
      if (/^(\d)\1+$/.test(raw)) return false;
      let sum = 0, rest;
      for (let i = 1; i <= 9; i++) sum = sum + parseInt(raw.substring(i - 1, i)) * (11 - i);
      rest = (sum * 10) % 11;
      if (rest === 10 || rest === 11) rest = 0;
      if (rest !== parseInt(raw.substring(9, 10))) return false;
      sum = 0;
      for (let i = 1; i <= 10; i++) sum = sum + parseInt(raw.substring(i - 1, i)) * (12 - i);
      rest = (sum * 10) % 11;
      if (rest === 10 || rest === 11) rest = 0;
      if (rest !== parseInt(raw.substring(10, 11))) return false;
      return true;
    }
    if (raw.length === 14) {
      if (/^(\d)\1+$/.test(raw)) return false;
      let size = raw.length - 2;
      let numbers = raw.substring(0, size);
      let digits = raw.substring(size);
      let sum = 0;
      let pos = size - 7;
      for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
      }
      let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
      if (result !== parseInt(digits.charAt(0))) return false;
      size = size + 1;
      numbers = raw.substring(0, size);
      sum = 0;
      pos = size - 7;
      for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
      }
      result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
      if (result !== parseInt(digits.charAt(1))) return false;
      return true;
    }
    return false;
  };

  const runLookup = useServerFn(lookupPlate);
  const lookup = useMutation({
    mutationFn: () => runLookup({ data: { plate: form.plate } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message ?? "Placa não encontrada.");
        return;
      }
      setForm((prev) => ({
        ...prev,
        brand: result.brand ?? prev.brand,
        model: result.model ?? prev.model,
        year: result.year ? String(result.year) : prev.year,
        color: result.color ?? prev.color,
      }));
      toast.success("Dados do veículo preenchidos.");
    },
    onError: () => toast.error("Não foi possível consultar a placa."),
  });



  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const mechanics = useQuery({
    queryKey: ["mechanics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "mecanico");
      if (error) throw new Error(error.message);
      const ids = (data ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids)
        .eq("active", true)
        .order("full_name");
      return profiles ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const companyId = form.companyId || null;

      let clientId: string | null = null;
      if (form.clientName.trim()) {
        const { data: client, error } = await supabase
          .from("clients")
          .insert({
            name: form.clientName.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            document: form.cpf.trim() || null,
            notes: form.birthDate.trim() ? `Data de Nascimento: ${form.birthDate}` : null,
            kind: companyId ? "empresa" : "pessoa",
            company_id: companyId,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        clientId = client.id;
      }

      const plate = form.plate.trim().toUpperCase();
      const { data: existing } = await supabase
        .from("vehicles")
        .select("id")
        .eq("plate", plate)
        .maybeSingle();

      let vehicleId = existing?.id ?? null;
      const vehiclePayload = {
        plate,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        year: form.year ? Number(form.year) : null,
        color: form.color.trim() || null,
        km: form.km ? Number(form.km) : null,
        client_id: clientId,
        company_id: companyId,
      };
      if (vehicleId) {
        await supabase.from("vehicles").update(vehiclePayload).eq("id", vehicleId);
      } else {
        const { data: vehicle, error } = await supabase
          .from("vehicles")
          .insert(vehiclePayload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        vehicleId = vehicle.id;
      }

      const minutes = mode === "express" ? Number(form.estimatedMinutes || 60) : null;
      const { data: order, error: orderError } = await supabase
        .from("service_orders")
        .insert({
          vehicle_id: vehicleId!,
          client_id: clientId,
          company_id: companyId,
          mode,
          status: "recebido",
          complaint: form.complaint.trim() || null,
          estimated_minutes: minutes,
          promised_at: minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null,
          mechanic_id: form.mechanicId || null,
          created_by: userId,
        })
        .select("id")
        .single();
      if (orderError) throw new Error(orderError.message);

      if (searchParams.appointmentId) {
        await supabase.from("appointments").update({ status: "compareceu" }).eq("id", searchParams.appointmentId);
      }

      return order.id;
    },
    onSuccess: (id) => {
      toast.success("Ordem de serviço criada.");
      navigate({ to: "/os/$id", params: { id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <AppShell title="Nova ordem" subtitle="Entrada de veículo na oficina">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.plate.trim()) {
            toast.error("Informe a placa do veículo.");
            return;
          }
          if (form.cpf && !validateDocument(form.cpf)) {
            setDocError("CPF ou CNPJ inválido");
            return;
          }
          save.mutate();
        }}
      >
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="w-full">
            <TabsTrigger value="express" className="flex-1">
              Express (serviço rápido)
            </TabsTrigger>
            <TabsTrigger value="analise" className="flex-1">
              Análise completa
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <section className="panel space-y-3 p-4">
          <h2 className="font-display text-lg">Cliente</h2>
          <div className="space-y-2">
            <Label htmlFor="companyId">Empresa credenciada (locadora)</Label>
            <Select value={form.companyId} onValueChange={(v) => set("companyId", v === "none" ? "" : v)}>
              <SelectTrigger id="companyId">
                <SelectValue placeholder="Cliente particular" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Cliente particular</SelectItem>
                {(companies.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field label="Nome do cliente / contato" value={form.clientName} onChange={(v) => set("clientName", v)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Telefone" value={form.phone} onChange={(v) => set("phone", v)} type="tel" />
            <Field label="E-mail" value={form.email} onChange={(v) => set("email", v)} type="email" />
            <div className="space-y-2">
              <Label htmlFor="cpf" className={docError ? "text-red-500" : ""}>CPF / CNPJ</Label>
              <Input
                id="cpf"
                value={form.cpf}
                onChange={(e) => {
                  set("cpf", e.target.value);
                  setDocError("");
                }}
                className={docError ? "border-red-500 focus-visible:ring-red-500" : ""}
                placeholder="Apenas números..."
              />
              {docError && <p className="text-xs text-red-500">{docError}</p>}
            </div>
            <Field label="Data de Nascimento" value={form.birthDate} onChange={(v) => set("birthDate", v)} type="date" />
          </div>
        </section>

        <section className="panel space-y-3 p-4">
          <h2 className="font-display text-lg">Veículo</h2>
          <div className="space-y-2">
            <Label htmlFor="plate">Placa *</Label>
            <div className="flex gap-2">
              <Input
                id="plate"
                value={form.plate}
                required
                autoCapitalize="characters"
                placeholder="ABC1D23"
                onChange={(e) => set("plate", e.target.value.toUpperCase())}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => lookup.mutate()}
                disabled={lookup.isPending || form.plate.replace(/\W/g, "").length < 7}
              >
                {lookup.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                Buscar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A consulta preenche marca, modelo, ano e cor automaticamente.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Marca" value={form.brand} onChange={(v) => set("brand", v)} />
            <Field label="Modelo" value={form.model} onChange={(v) => set("model", v)} />
            <Field label="Ano" value={form.year} onChange={(v) => set("year", v)} type="number" />
            <Field label="Cor" value={form.color} onChange={(v) => set("color", v)} />
            <Field label="Km" value={form.km} onChange={(v) => set("km", v)} type="number" />
          </div>
        </section>

        <section className="panel space-y-3 p-4">
          <h2 className="font-display text-lg">Serviço</h2>
          <div className="space-y-2">
            <Label htmlFor="complaint">Reclamação / serviço solicitado</Label>
            <Textarea
              id="complaint"
              rows={3}
              value={form.complaint}
              onChange={(e) => set("complaint", e.target.value)}
              placeholder="Ex.: troca de óleo e filtro, ruído no freio dianteiro…"
            />
          </div>
          {mode === "express" ? (
            <Field
              label="Prazo estimado (minutos)"
              value={form.estimatedMinutes}
              onChange={(v) => set("estimatedMinutes", v)}
              type="number"
            />
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="mechanicId">Mecânico responsável</Label>
            <Select value={form.mechanicId} onValueChange={(v) => set("mechanicId", v === "none" ? "" : v)}>
              <SelectTrigger id="mechanicId">
                <SelectValue placeholder="Definir depois" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Definir depois</SelectItem>
                {(mechanics.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name || "Mecânico"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <Button type="submit" size="lg" className="w-full" disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Abrir ordem de serviço
        </Button>
      </form>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
