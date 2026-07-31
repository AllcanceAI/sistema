import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { APP_ROLES } from "@/lib/roles";

const roleEnum = z.enum(APP_ROLES);

async function assertOwner(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "dono")
    .maybeSingle();
  if (error || !data) throw new Error("Apenas o dono pode executar esta ação.");
}

/** Cria o primeiro acesso (dono) quando ainda não existe nenhum usuário. */
export const bootstrapOwner = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        fullName: z.string().trim().min(2).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: countError } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (countError) throw new Error(countError.message);
    // A verificação da tela pode ficar desatualizada entre a consulta e o envio.
    // Nesse caso, não tente recriar o dono: deixe o cliente seguir com o login.
    if ((count ?? 0) > 0) return { ok: true, created: false };

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar o acesso.");

    await supabaseAdmin
      .from("profiles")
      .insert({ id: created.user.id, full_name: data.fullName, job_title: "Dono" });
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "dono" });

    return { ok: true, created: true };
  });

/** Indica se o sistema ainda não tem nenhum usuário (mostra a tela de primeiro acesso). */
export const needsBootstrap = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  return { needsBootstrap: (count ?? 0) === 0 };
});

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, job_title, active, created_at")
      .order("created_at");
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });

    return (profiles ?? []).map((p) => ({
      ...p,
      email: users?.users.find((u) => u.id === p.id)?.email ?? "",
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        fullName: z.string().trim().min(2).max(120),
        phone: z.string().trim().max(30).optional(),
        jobTitle: z.string().trim().max(80).optional(),
        roles: z.array(roleEnum).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar o usuário.");

    await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      full_name: data.fullName,
      phone: data.phone ?? null,
      job_title: data.jobTitle ?? null,
    });
    await supabaseAdmin
      .from("user_roles")
      .insert(data.roles.map((role) => ({ user_id: created.user!.id, role })));

    return { ok: true, id: created.user.id };
  });

export const updateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        fullName: z.string().trim().min(2).max(120).optional(),
        phone: z.string().trim().max(30).optional(),
        jobTitle: z.string().trim().max(80).optional(),
        active: z.boolean().optional(),
        roles: z.array(roleEnum).optional(),
        newPassword: z.string().min(8).max(72).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: {
      full_name?: string;
      phone?: string | null;
      job_title?: string | null;
      active?: boolean;
    } = {};
    if (data.fullName !== undefined) patch.full_name = data.fullName;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.jobTitle !== undefined) patch.job_title = data.jobTitle;
    if (data.active !== undefined) patch.active = data.active;
    if (Object.keys(patch).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
      if (error) throw new Error(error.message);
    }

    if (data.roles) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      if (data.roles.length > 0) {
        await supabaseAdmin
          .from("user_roles")
          .insert(data.roles.map((role) => ({ user_id: data.userId, role })));
      }
    }

    if (data.newPassword) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.newPassword,
      });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const setRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        role: roleEnum,
        permission: z.string().trim().min(2).max(60),
        allowed: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("role_permissions")
      .upsert(
        { role: data.role, permission: data.permission, allowed: data.allowed, updated_at: new Date().toISOString() },
        { onConflict: "role,permission" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
