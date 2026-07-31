import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { OrderCard } from "@/routes/_authenticated/painel";
import { useMe, can } from "@/hooks/useMe";
import { OS_STATUS_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/os/")({
  head: () => ({
    meta: [
      { title: "Ordens de serviço — Oficina" },
      { name: "description", content: "Lista de ordens de serviço express e de análise completa." },
      { property: "og:title", content: "Ordens de serviço — Oficina" },
      { property: "og:description", content: "Ordens express e de análise completa da oficina." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OsList,
});

function OsList() {
  const { data: me } = useMe();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState("abertas");

  const orders = useQuery({
    queryKey: ["orders", "lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_orders")
        .select(
          "id, number, mode, status, complaint, promised_at, created_at, mechanic_id, vehicles(plate, brand, model), clients(name), companies(name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const list = (orders.data ?? []).filter((o) => {
    if (filter === "abertas" && ["entregue", "cancelado"].includes(o.status)) return false;
    if (filter === "express" && o.mode !== "express") return false;
    if (filter === "analise" && o.mode !== "analise") return false;
    if (filter === "finalizadas" && !["entregue", "concluido"].includes(o.status)) return false;
    if (!term.trim()) return true;
    const haystack = [
      o.vehicles?.plate,
      o.vehicles?.brand,
      o.vehicles?.model,
      o.clients?.name,
      o.companies?.name,
      OS_STATUS_LABELS[o.status],
      String(o.number),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(term.trim().toLowerCase());
  });

  return (
    <AppShell
      title="Ordens de serviço"
      subtitle={`${list.length} ordem(ns)`}
      action={
        can(me, "cadastrar_os") ? (
          <Button asChild size="sm">
            <Link to="/os/nova">
              <Plus className="size-4" /> Nova
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por placa, cliente, empresa…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mt-3">
        <TabsList className="w-full">
          <TabsTrigger value="abertas" className="flex-1">
            Abertas
          </TabsTrigger>
          <TabsTrigger value="express" className="flex-1">
            Express
          </TabsTrigger>
          <TabsTrigger value="analise" className="flex-1">
            Análise
          </TabsTrigger>
          <TabsTrigger value="finalizadas" className="flex-1">
            Prontas
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-3 space-y-2">
        {list.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
        {list.length === 0 ? (
          <p className="panel p-6 text-center text-sm text-muted-foreground">
            Nenhuma ordem encontrada.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
