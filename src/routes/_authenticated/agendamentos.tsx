import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Car, User, Clock,
  Loader2, X, MessageCircle, Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/agendamentos")({
  head: () => ({
    meta: [
      { title: "Agenda — Oficina" },
      { name: "description", content: "Calendário de agendamentos de veículos da oficina." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Agendamentos,
});

type Appointment = {
  id: string;
  client_name: string;
  plate: string | null;
  service: string | null;
  scheduled_at: string;
  notes: string | null;
  status: string;
  created_at: string;
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Agendamentos() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [showModal, setShowModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Form state
  const [form, setForm] = useState({
    client_name: "",
    plate: "",
    service: "",
    scheduled_at: "",
    notes: "",
  });

  const appointments = useQuery({
    queryKey: ["appointments", year, month],
    queryFn: async () => {
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("scheduled_at");
      if (error) throw new Error(error.message);
      return (data ?? []) as Appointment[];
    },
  });

  const createAppointment = useMutation({
    mutationFn: async (values: typeof form) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("appointments").insert({
        client_name: values.client_name,
        plate: values.plate || null,
        service: values.service || null,
        scheduled_at: new Date(values.scheduled_at).toISOString(),
        notes: values.notes || null,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Veículo agendado!");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setShowModal(false);
      setForm({ client_name: "", plate: "", service: "", scheduled_at: "", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelado" })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const allAppts = appointments.data ?? [];
  const activeAppts = allAppts.filter(a => a.status !== "cancelado");

  function getAppts(day: number) {
    return activeAppts.filter(a => {
      const d = new Date(a.scheduled_at);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  }

  function openModal(day?: number) {
    if (day) {
      const date = new Date(year, month, day, 9, 0);
      const iso = date.toISOString().slice(0, 16);
      setForm(f => ({ ...f, scheduled_at: iso }));
    }
    setShowModal(true);
  }

  function whatsapp(a: Appointment) {
    const phone = a.notes?.match(/\d{10,11}/)?.[0];
    const date = new Date(a.scheduled_at);
    const dateStr = date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    const msg = encodeURIComponent(
      `Olá ${a.client_name}! 👋\n\nGostaríamos de confirmar seu agendamento na HM Auto Elétrica:\n📅 Data: ${dateStr}\n🚗 Veículo: ${a.plate ?? "—"}\n🔧 Serviço: ${a.service ?? "—"}\n\nPor favor, confirme seu comparecimento. Qualquer dúvida, estamos à disposição!`
    );
    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${msg}`, "_blank");
    }
  }

  const todayD = now.getDate();
  const todayM = now.getMonth();
  const todayY = now.getFullYear();

  return (
    <AppShell
      title="Agenda"
      subtitle={`${MONTH_NAMES[month]} ${year} · ${activeAppts.length} agendamento${activeAppts.length !== 1 ? "s" : ""}`}
      action={
        <Button size="sm" onClick={() => openModal()}>
          <Plus className="size-4" /> Agendar
        </Button>
      }
    >
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={prevMonth}>
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="font-display text-xl font-bold">{MONTH_NAMES[month]} {year}</h2>
        <Button variant="outline" size="icon" onClick={nextMonth}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="panel overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {DOW.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="min-h-[80px] border-b border-r bg-muted/5 last:border-r-0" />;
            const dayAppts = getAppts(day);
            const isToday = day === todayD && month === todayM && year === todayY;
            return (
              <div
                key={day}
                className={`min-h-[80px] border-b border-r p-1 last:border-r-0 cursor-pointer hover:bg-muted/20 transition-colors ${isToday ? "bg-primary/5" : ""}`}
                onClick={() => openModal(day)}
              >
                <div className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs font-bold ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayAppts.slice(0, 3).map((a) => (
                    <div
                      key={a.id}
                      className="truncate rounded bg-primary/15 px-1 py-0.5 text-[10px] font-medium text-primary"
                      onClick={(e) => { e.stopPropagation(); setSelectedDay(day); }}
                    >
                      🚗 {a.plate ?? a.client_name}
                    </div>
                  ))}
                  {dayAppts.length > 3 && (
                    <div className="text-[9px] text-muted-foreground px-1">+{dayAppts.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedDay !== null && (
        <section className="mt-4 panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-bold">
              {selectedDay} de {MONTH_NAMES[month]} — Agendamentos
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDay(null)}>
              <X className="size-4" />
            </Button>
          </div>
          {getAppts(selectedDay).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum agendamento neste dia.</p>
          ) : (
            <div className="space-y-3">
              {getAppts(selectedDay).map((a) => (
                <div key={a.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <User className="size-3.5 shrink-0" /> {a.client_name}
                    </p>
                    {a.plate && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Car className="size-3" /> {a.plate}
                      </p>
                    )}
                    {a.service && (
                      <p className="text-xs text-muted-foreground mt-0.5">🔧 {a.service}</p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="size-3" />
                      {new Date(a.scheduled_at).toLocaleString("pt-BR", { timeStyle: "short" })}
                    </p>
                    {a.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{a.notes}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-300" onClick={() => whatsapp(a)}>
                      <MessageCircle className="size-3.5" /> WhatsApp
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => cancelAppointment.mutate(a.id)}>
                      <X className="size-3.5" /> Cancelar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button className="mt-3 w-full" size="sm" onClick={() => openModal(selectedDay)}>
            <Plus className="size-4" /> Novo agendamento neste dia
          </Button>
        </section>
      )}

      {/* Bottom list of all appointments this month */}
      <section className="mt-4">
        <h2 className="mb-3 font-display text-xl font-bold">Todos os agendamentos do mês</h2>
        {appointments.isLoading ? (
          <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
        ) : activeAppts.length === 0 ? (
          <p className="panel p-6 text-center text-sm text-muted-foreground">
            Nenhum agendamento este mês. Clique em "Agendar" para adicionar.
          </p>
        ) : (
          <div className="space-y-2">
            {activeAppts.map((a) => (
              <div key={a.id} className="panel flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {new Date(a.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    {" — "}
                    <span className="text-primary">{a.plate ?? "Sem placa"}</span>
                    {" · "}
                    {a.client_name}
                  </p>
                  {a.service && <p className="text-xs text-muted-foreground">{a.service}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="text-green-600" onClick={() => whatsapp(a)}>
                    <MessageCircle className="size-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelAppointment.mutate(a.id)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal: New Appointment */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold">Agendar Veículo</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowModal(false)}>
                <X className="size-4" />
              </Button>
            </div>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.client_name || !form.scheduled_at) {
                  toast.error("Preencha o nome do cliente e a data/hora.");
                  return;
                }
                createAppointment.mutate(form);
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="ag-client">Cliente *</Label>
                <Input
                  id="ag-client"
                  placeholder="Nome do cliente"
                  value={form.client_name}
                  onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ag-plate">Placa do veículo</Label>
                <Input
                  id="ag-plate"
                  placeholder="ABC-1234"
                  value={form.plate}
                  onChange={(e) => setForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ag-service">Serviço</Label>
                <Input
                  id="ag-service"
                  placeholder="Ex: Revisão, troca de óleo, diagnóstico..."
                  value={form.service}
                  onChange={(e) => setForm(f => ({ ...f, service: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ag-date">Data e Hora *</Label>
                <Input
                  id="ag-date"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ag-notes">Observações / Telefone WhatsApp</Label>
                <Input
                  id="ag-notes"
                  placeholder="Telefone para lembrete, ou outras observações"
                  value={form.notes}
                  onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={createAppointment.isPending}>
                {createAppointment.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Confirmar Agendamento
              </Button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
