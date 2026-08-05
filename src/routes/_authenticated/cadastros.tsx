import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Car, Users, Pen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useMe, can, hasRole } from "@/hooks/useMe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const editable = can(me, "cadastrar_os") || hasRole(me, "secretaria", "gerente");
  const [company, setCompany] = useState({ name: "", cnpj: "", contact: "", phone: "", email: "" });

  const [editingClient, setEditingClient] = useState<{
    id: string;
    name: string;
    phone: string;
    email: string;
  } | null>(null);

  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [newClient, setNewClient] = useState({ name: "", phone: "", email: "" });
  
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [newVehicle, setNewVehicle] = useState({ plate: "", brand: "", model: "", year: "", color: "", client_id: "none", company_id: "none" });

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

  const updateCompany = useMutation({
    mutationFn: async (comp: any) => {
      const { error } = await supabase.from("companies").update({
        name: comp.name.trim(),
        cnpj: comp.cnpj.trim() || null,
        contact_name: comp.contact.trim() || null,
        phone: comp.phone.trim() || null,
        email: comp.email.trim() || null,
      }).eq("id", comp.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setEditingCompany(null);
      toast.success("Empresa atualizada.");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteCompany = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Empresa excluída.");
      queryClient.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (error: Error) => toast.error("Não é possível excluir empresa que possui Ordens de Serviço."),
  });

  const createClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").insert({
        name: newClient.name.trim(),
        phone: newClient.phone.trim() || null,
        email: newClient.email.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNewClient({ name: "", phone: "", email: "" });
      toast.success("Cliente cadastrado.");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateClient = useMutation({
    mutationFn: async (client: { id: string; name: string; phone: string; email: string }) => {
      const { error } = await supabase
        .from("clients")
        .update({
          name: client.name.trim(),
          phone: client.phone.trim() || null,
          email: client.email.trim() || null,
        })
        .eq("id", client.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setEditingClient(null);
      toast.success("Cliente atualizado.");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Cliente excluído.");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (error: Error) => toast.error("Não é possível excluir cliente que possui Ordens de Serviço."),
  });

  const createVehicle = useMutation({
    mutationFn: async () => {
      const payload = {
        plate: newVehicle.plate.trim().toUpperCase(),
        brand: newVehicle.brand.trim() || null,
        model: newVehicle.model.trim() || null,
        year: newVehicle.year ? Number(newVehicle.year) : null,
        color: newVehicle.color.trim() || null,
        client_id: newVehicle.client_id !== "none" ? newVehicle.client_id : null,
        company_id: newVehicle.company_id !== "none" ? newVehicle.company_id : null,
      };
      if (!payload.plate) throw new Error("Placa é obrigatória");
      const { error } = await supabase.from("vehicles").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setNewVehicle({ plate: "", brand: "", model: "", year: "", color: "", client_id: "none", company_id: "none" });
      toast.success("Veículo cadastrado.");
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateVehicle = useMutation({
    mutationFn: async (veh: any) => {
      const payload = {
        plate: veh.plate.trim().toUpperCase(),
        brand: veh.brand?.trim() || null,
        model: veh.model?.trim() || null,
        year: veh.year ? Number(veh.year) : null,
        color: veh.color?.trim() || null,
        client_id: veh.client_id !== "none" ? veh.client_id : null,
        company_id: veh.company_id !== "none" ? veh.company_id : null,
      };
      if (!payload.plate) throw new Error("Placa é obrigatória");
      const { error } = await supabase.from("vehicles").update(payload).eq("id", veh.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setEditingVehicle(null);
      toast.success("Veículo atualizado.");
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Veículo excluído.");
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (error: Error) => toast.error("Não é possível excluir veículo que possui Ordens de Serviço."),
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
              {editingCompany?.id === c.id ? (
                <div className="space-y-3">
                  <Input placeholder="Nome" value={editingCompany.name} onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input placeholder="CNPJ" value={editingCompany.cnpj} onChange={(e) => setEditingCompany({ ...editingCompany, cnpj: e.target.value })} />
                    <Input placeholder="Contato" value={editingCompany.contact} onChange={(e) => setEditingCompany({ ...editingCompany, contact: e.target.value })} />
                    <Input placeholder="Telefone" value={editingCompany.phone} onChange={(e) => setEditingCompany({ ...editingCompany, phone: e.target.value })} />
                    <Input placeholder="E-mail" value={editingCompany.email} onChange={(e) => setEditingCompany({ ...editingCompany, email: e.target.value })} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingCompany(null)}>Cancelar</Button>
                    <Button size="sm" onClick={() => updateCompany.mutate(editingCompany)} disabled={updateCompany.isPending}>Salvar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[c.cnpj, c.contact_name, c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  {editable && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditingCompany({ id: c.id, name: c.name, cnpj: c.cnpj || "", contact: c.contact_name || "", phone: c.phone || "", email: c.email || "" })}>
                        <Pen className="size-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 hover:bg-red-50 hover:text-red-600" onClick={() => { if (confirm("Excluir empresa?")) deleteCompany.mutate(c.id); }}>
                        <Trash2 className="size-4 text-muted-foreground hover:text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="clientes" className="mt-3 space-y-2">
          {editable ? (
            <form
              className="panel space-y-3 p-4 mb-4"
              onSubmit={(e) => {
                e.preventDefault();
                createClient.mutate();
              }}
            >
              <h2 className="flex items-center gap-2 font-display text-lg">
                <Users className="size-4 text-primary" /> Novo cliente particular
              </h2>
              <div className="space-y-2">
                <Label htmlFor="clname">Nome do cliente</Label>
                <Input id="clname" required value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clphone">Telefone</Label>
                  <Input id="clphone" type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clemail">E-mail</Label>
                  <Input id="clemail" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createClient.isPending}>
                Cadastrar cliente
              </Button>
            </form>
          ) : null}

          {(clients.data ?? []).map((c) => (
            <div key={c.id} className="panel p-3 text-sm">
              {editingClient?.id === c.id ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Nome"
                    value={editingClient.name}
                    onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Telefone"
                      value={editingClient.phone}
                      onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                    />
                    <Input
                      placeholder="E-mail"
                      value={editingClient.email}
                      onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingClient(null)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={() => updateClient.mutate(editingClient)} disabled={updateClient.isPending}>
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 font-medium">
                      <Users className="size-4 text-primary" /> {c.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {[c.phone, c.email, c.companies?.name].filter(Boolean).join(" · ") || "Sem mais dados"}
                    </p>
                  </div>
                  {editable && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() =>
                          setEditingClient({
                            id: c.id,
                            name: c.name,
                            phone: c.phone || "",
                            email: c.email || "",
                          })
                        }
                      >
                        <Pen className="size-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:bg-red-50 hover:text-red-600"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja excluir este cliente?")) {
                            deleteClient.mutate(c.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-red-600" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {(clients.data ?? []).length === 0 ? (
            <p className="panel p-6 text-center text-sm text-muted-foreground">
              Nenhum cliente cadastrado ainda.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="veiculos" className="mt-3 space-y-2">
          {editable ? (
            <form
              className="panel space-y-3 p-4 mb-4"
              onSubmit={(e) => {
                e.preventDefault();
                createVehicle.mutate();
              }}
            >
              <h2 className="flex items-center gap-2 font-display text-lg">
                <Car className="size-4 text-primary" /> Novo veículo
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="vplate">Placa</Label>
                  <Input id="vplate" required value={newVehicle.plate} onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vbrand">Marca</Label>
                  <Input id="vbrand" value={newVehicle.brand} onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vmodel">Modelo</Label>
                  <Input id="vmodel" value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vcolor">Cor</Label>
                  <Input id="vcolor" value={newVehicle.color} onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Vincular a Empresa/Locadora</Label>
                  <Select value={newVehicle.company_id} onValueChange={(val) => setNewVehicle({ ...newVehicle, company_id: val })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {(companies.data ?? []).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Vincular a Cliente Particular</Label>
                  <Select value={newVehicle.client_id} onValueChange={(val) => setNewVehicle({ ...newVehicle, client_id: val })}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {(clients.data ?? []).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createVehicle.isPending}>
                Cadastrar veículo
              </Button>
            </form>
          ) : null}

          {(vehicles.data ?? []).map((v) => (
            <div key={v.id} className="panel p-3 text-sm flex items-start justify-between gap-4">
              {editingVehicle?.id === v.id ? (
                <div className="w-full space-y-3">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <Input placeholder="Placa" required value={editingVehicle.plate} onChange={(e) => setEditingVehicle({ ...editingVehicle, plate: e.target.value })} />
                    <Input placeholder="Marca" value={editingVehicle.brand || ""} onChange={(e) => setEditingVehicle({ ...editingVehicle, brand: e.target.value })} />
                    <Input placeholder="Modelo" value={editingVehicle.model || ""} onChange={(e) => setEditingVehicle({ ...editingVehicle, model: e.target.value })} />
                    <Input placeholder="Cor" value={editingVehicle.color || ""} onChange={(e) => setEditingVehicle({ ...editingVehicle, color: e.target.value })} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={editingVehicle.company_id || "none"} onValueChange={(val) => setEditingVehicle({ ...editingVehicle, company_id: val })}>
                      <SelectTrigger><SelectValue placeholder="Empresa vinculada..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma empresa</SelectItem>
                        {(companies.data ?? []).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={editingVehicle.client_id || "none"} onValueChange={(val) => setEditingVehicle({ ...editingVehicle, client_id: val })}>
                      <SelectTrigger><SelectValue placeholder="Cliente vinculado..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum cliente</SelectItem>
                        {(clients.data ?? []).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingVehicle(null)}>Cancelar</Button>
                    <Button size="sm" onClick={() => updateVehicle.mutate(editingVehicle)} disabled={updateVehicle.isPending}>Salvar</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <p className="flex items-center gap-2 font-display text-xl leading-none">
                      <Car className="size-4 text-primary" /> {v.plate}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[v.brand, v.model, v.year, v.color, v.companies?.name ?? v.clients?.name]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  {editable && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Link to="/os/nova" search={{ plate: v.plate, clientName: v.clients?.name }}>
                          <Car className="size-4" /> Dar Entrada
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => setEditingVehicle({
                          id: v.id,
                          plate: v.plate,
                          brand: v.brand,
                          model: v.model,
                          color: v.color,
                          year: v.year,
                          client_id: v.client_id,
                          company_id: v.company_id,
                        })}
                      >
                        <Pen className="size-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:bg-red-50 hover:text-red-600"
                        onClick={() => {
                          if (confirm(`Tem certeza que deseja excluir o veículo ${v.plate}?`)) {
                            deleteVehicle.mutate(v.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-red-600" />
                      </Button>
                    </div>
                  )}
                </>
              )}
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
