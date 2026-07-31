import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Car, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useMe, can } from "@/hooks/useMe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({
    meta: [
      { title: "Cadastros — Oficina" },
      { name: "description", content: "Empresas credenciadas, clientes e veículos da oficina." },
      { property: "og:title", content: "Cadastros — Oficina" },
      { property: "og:description", content: "Empresas credenciadas, clientes e frota atendida." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Cadastros,
});

function Cadastros() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const editable = can(me, "cadastrar_os");
  const [company, setCompany] = useState({ name: "", cnpj: "", contact: "", phone: "", email: "" });

  const companies = useQuery({
    queryKey: ["companies", "all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const clients = useQuery({
    queryKey: ["clients", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, companies(name)")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const vehicles = useQuery({
    queryKey: ["vehicles", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, companies(name), clients(name)")
        .order("plate");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const createCompany = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").insert({
        name: company.name.trim(),
        cnpj: company.cnpj.trim() || null,
        contact_name: company.contact.trim() || null,
        phone: company.phone.trim() || null,
        email: company.email.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setCompany({ name: "", cnpj: "", contact: "", phone: "", email: "" });
      toast.success("Empresa credenciada cadastrada.");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell title="Cadastros" subtitle="Empresas, clientes e frota">
      <Tabs defaultValue="empresas">
        <TabsList className="w-full">
          <TabsTrigger value="empresas" className="flex-1">
            Empresas
          </TabsTrigger>
          <TabsTrigger value="clientes" className="flex-1">
            Clientes
          </TabsTrigger>
          <TabsTrigger value="veiculos" className="flex-1">
            Veículos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="empresas" className="mt-3 space-y-3">
          {editable ? (
            <form
              className="panel space-y-3 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                createCompany.mutate();
              }}
            >
              <h2 className="flex items-center gap-2 font-display text-lg">
                <Building2 className="size-4 text-primary" /> Nova empresa credenciada
              </h2>
              <div className="space-y-2">
                <Label htmlFor="cname">Nome da empresa</Label>
                <Input
                  id="cname"
                  required
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={company.cnpj}
                    onChange={(e) => setCompany({ ...company, cnpj: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">Contato</Label>
                  <Input
                    id="contact"
                    value={company.contact}
                    onChange={(e) => setCompany({ ...company, contact: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cphone">Telefone</Label>
                  <Input
                    id="cphone"
                    type="tel"
                    value={company.phone}
                    onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cemail">E-mail</Label>
                  <Input
                    id="cemail"
                    type="email"
                    value={company.email}
                    onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createCompany.isPending}>
                Cadastrar empresa
              </Button>
            </form>
          ) : null}

          {(companies.data ?? []).map((c) => (
            <div key={c.id} className="panel p-3 text-sm">
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {[c.cnpj, c.contact_name, c.phone, c.email].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="clientes" className="mt-3 space-y-2">
          {(clients.data ?? []).map((c) => (
            <div key={c.id} className="panel p-3 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Users className="size-4 text-primary" /> {c.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {[c.phone, c.email, c.companies?.name].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          ))}
          {(clients.data ?? []).length === 0 ? (
            <p className="panel p-6 text-center text-sm text-muted-foreground">
              Clientes são criados junto com a ordem de serviço.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="veiculos" className="mt-3 space-y-2">
          {(vehicles.data ?? []).map((v) => (
            <div key={v.id} className="panel p-3 text-sm">
              <p className="flex items-center gap-2 font-display text-xl leading-none">
                <Car className="size-4 text-primary" /> {v.plate}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {[v.brand, v.model, v.year, v.color, v.companies?.name ?? v.clients?.name]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
          ))}
          {(vehicles.data ?? []).length === 0 ? (
            <p className="panel p-6 text-center text-sm text-muted-foreground">
              Nenhum veículo cadastrado ainda.
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
