import { useAuthStore } from "../stores/authStore";

export function usePermission(flag) {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  if (user.role === "admin") return true;
  const permissions = user.permissions || [];
  const moduleWildcard = `${String(flag).split(":")[0]}:*`;
  return permissions.includes("*") || permissions.includes(flag) || permissions.includes(moduleWildcard);
}
