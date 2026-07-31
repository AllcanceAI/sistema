import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { KeyRound, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useMe, hasRole } from "@/hooks/useMe";
import { APP_ROLES, PERMISSIONS, ROLE_LABELS, type AppRole } from "@/lib/roles";
import { createStaff, listStaff, setRolePermission, updateStaff } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Equipe e permissões — Oficina" },
      { name: "description", content: "O dono cria acessos, define funções e permissões de cada funcionário." },
      { property: "og:title", content: "Equipe e permissões — Oficina" },
      { property: "og:description", content: "Gestão de acessos, funções e permissões da oficina." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Usuarios,
});

function Usuarios() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const fetchStaff = useServerFn(listStaff);
  const addStaff = useServerFn(createStaff);
  const patchStaff = useServerFn(updateStaff);
  const patchPermission = useServerFn(setRolePermission);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    jobTitle: "",
    roles: ["funcionario"] as AppRole[],
  });

  const owner = hasRole(me, "dono");

  const staff = useQuery({
    enabled: owner,
    queryKey: ["staff"],
    queryFn: () => fetchStaff(),
  });

  const permissions = useQuery({
    enabled: owner,
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("*");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: () =>
      addStaff({
        data: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || undefined,
          jobTitle: form.jobTitle.trim() || undefined,
          roles: form.roles,
        },
      }),
    onSuccess: () => {
      setForm({ fullName: "", email: "", password: "", phone: "", jobTitle: "", roles: ["funcionario"] });
      toast.success("Acesso criado. Informe o e-mail e a senha ao funcionário.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: (input: {
      userId: string;
      active?: boolean;
      newPassword?: string;
      roles?: AppRole[];
    }) => patchStaff({ data: input }),
    onSuccess: () => {
      toast.success("Atualizado.");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const togglePermission = useMutation({
    mutationFn: (input: { role: AppRole; permission: string; allowed: boolean }) =>
      patchPermission({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["role_permissions"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (!owner) {
    return (
      <AppShell title="Equipe">
        <p className="panel p-6 text-center text-sm text-muted-foreground">
          Apenas o dono pode gerenciar acessos e permissões.
        </p>
      </AppShell>
    );
  }

  const allowed = (role: AppRole, permission: string) =>
    (permissions.data ?? []).some(
      (p) => p.role === role && p.permission === permission && p.allowed,
    );

  return (
    <AppShell title="Equipe e permissões" subtitle="Acesso exclusivo do dono">
      <Tabs defaultValue="usuarios">
        <TabsList className="w-full">
          <TabsTrigger value="usuarios" className="flex-1">
            Usuários
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="flex-1">
            Permissões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-3 space-y-3">
          <form
            className="panel space-y-3 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <h2 className="flex items-center gap-2 font-display text-lg">
              <UserPlus className="size-4 text-primary" /> Criar acesso
            </h2>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                id="fullName"
                required
                minLength={2}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail de login</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha (mín. 8)</Label>
                <Input
                  id="password"
                  type="text"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Cargo</Label>
                <Input
                  id="jobTitle"
                  value={form.jobTitle}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Funções</Label>
              <div className="grid grid-cols-2 gap-2">
                {APP_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.roles.includes(role)}
                      onCheckedChange={(checked) =>
                        setForm({
                          ...form,
                          roles: checked
                            ? [...form.roles, role]
                            : form.roles.filter((r) => r !== role),
                        })
                      }
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Criar acesso
            </Button>
          </form>

          {(staff.data ?? []).map((person) => (
            <div key={person.id} className="panel space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{person.full_name || "Sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {person.roles.map((r) => (
                      <Badge key={r} variant="outline">
                        {ROLE_LABELS[r as AppRole] ?? r}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{person.active ? "Ativo" : "Inativo"}</span>
                  <Switch
                    checked={person.active}
                    onCheckedChange={(active) => update.mutate({ userId: person.id, active })}
                  />
                </div>
              </div>

              <ResetPassword
                onSubmit={(newPassword) => update.mutate({ userId: person.id, newPassword })}
              />

              <div className="grid grid-cols-2 gap-2">
                {APP_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
                    <Checkbox
                      checked={person.roles.includes(role)}
                      onCheckedChange={(checked) =>
                        update.mutate({
                          userId: person.id,
                          roles: (checked
                            ? [...person.roles, role]
                            : person.roles.filter((r) => r !== role)) as AppRole[],
                        })
                      }
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="permissoes" className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            O dono sempre tem acesso total. Marque abaixo o que cada função pode fazer.
          </p>
          {APP_ROLES.filter((r) => r !== "dono").map((role) => (
            <div key={role} className="panel space-y-2 p-4">
              <h3 className="font-display text-lg">{ROLE_LABELS[role]}</h3>
              {PERMISSIONS.map((permission) => (
                <label
                  key={permission.key}
                  className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2 text-sm"
                >
                  {permission.label}
                  <Switch
                    checked={allowed(role, permission.key)}
                    onCheckedChange={(value) =>
                      togglePermission.mutate({
                        role,
                        permission: permission.key,
                        allowed: value,
                      })
                    }
                  />
                </label>
              ))}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function ResetPassword({ onSubmit }: { onSubmit: (password: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex gap-2">
      <Input
        placeholder="Nova senha (mín. 8)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        variant="secondary"
        onClick={() => {
          if (value.length < 8) {
            toast.error("A senha precisa de no mínimo 8 caracteres.");
            return;
          }
          onSubmit(value);
          setValue("");
        }}
      >
        <KeyRound className="size-4" /> Trocar
      </Button>
    </div>
  );
}
