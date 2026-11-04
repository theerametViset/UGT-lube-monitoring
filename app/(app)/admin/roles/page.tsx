import { redirect } from "next/navigation";
import { hasPermission, listRolesWithPermissions } from "@/lib/queries/permissions";
import { RolesClient } from "@/components/admin/RolesClient";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  if (!(await hasPermission("users:manage"))) redirect("/dashboard");

  const { roles, permissions, grants } = await listRolesWithPermissions();
  return <RolesClient roles={roles} permissions={permissions} grants={grants} />;
}
