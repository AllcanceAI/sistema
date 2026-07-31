import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, PermissionKey } from "@/lib/roles";

export type Me = {
  userId: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  active: boolean;
  roles: AppRole[];
  permissions: Record<string, boolean>;
};

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;

      const [{ data: profile }, { data: roleRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, job_title, active")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      const roles = (roleRows ?? []).map((r) => r.role as AppRole);

      const { data: permRows } = await supabase
        .from("role_permissions")
        .select("role, permission, allowed");

      const permissions: Record<string, boolean> = {};
      for (const row of permRows ?? []) {
        if (roles.includes(row.role as AppRole) && row.allowed) permissions[row.permission] = true;
      }

      return {
        userId: user.id,
        email: user.email ?? "",
        fullName: profile?.full_name ?? "",
        jobTitle: profile?.job_title ?? null,
        active: profile?.active ?? false,
        roles,
        permissions,
      };
    },
  });
}

export function can(me: Me | null | undefined, permission: PermissionKey) {
  if (!me) return false;
  if (me.roles.includes("dono")) return true;
  return me.permissions[permission] === true;
}

export function hasRole(me: Me | null | undefined, ...roles: AppRole[]) {
  return !!me && roles.some((r) => me.roles.includes(r));
}
