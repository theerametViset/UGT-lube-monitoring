import { listUsers } from "@/lib/queries/users";
import { hasPermission, listRoles } from "@/lib/queries/permissions";
import { getReference } from "@/lib/queries/assets";
import { redirect } from "next/navigation";
import { UsersClient } from "@/components/admin/UsersClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { q?: string; page?: string; pageSize?: string };
}

export default async function UsersPage({ searchParams }: PageProps) {
  if (!(await hasPermission("users:manage"))) redirect("/dashboard");

  const q = searchParams.q ?? "";
  const page = Number(searchParams.page ?? "1") || 1;
  const pageSize = Number(searchParams.pageSize ?? "20") || 20;

  const [list, roles, reference] = await Promise.all([
    listUsers({ q, page, pageSize }),
    listRoles(),
    getReference(),
  ]);
  return <UsersClient list={list} q={q} roles={roles} sites={reference.sites} />;
}
