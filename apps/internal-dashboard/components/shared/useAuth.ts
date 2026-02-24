export type Role = "admin" | "manager" | "agent";

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  companyId: string;
}

export interface Permissions {
  canManageKb: boolean;
  canViewWebhooks: boolean;
  canViewAuditLog: boolean;
  canViewAnalytics: boolean;
}

export const getPermissions = (role: string | undefined): Permissions => ({
  canManageKb: role === "admin" || role === "manager",
  canViewWebhooks: role === "admin",
  canViewAuditLog: role === "admin" || role === "manager",
  canViewAnalytics: role === "admin" || role === "manager"
});
