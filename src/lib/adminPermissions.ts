export const STAFF_PERMISSIONS = [
  { key: "customers.view", label: "عرض العملاء" },
  { key: "customers.manage", label: "إدارة حسابات العملاء" },
  { key: "sellers.view", label: "عرض البائعين والمتاجر" },
  { key: "sellers.manage", label: "إدارة البائعين والمتاجر" },
  { key: "ads.view", label: "عرض الإعلانات" },
  { key: "ads.manage", label: "إدارة الإعلانات" },
] as const;
export type StaffPermission = typeof STAFF_PERMISSIONS[number]["key"];
export function hasPermission(permissions: readonly string[], key: string) {
  return permissions.includes(key) || (key.endsWith(".view") && permissions.includes(key.replace(".view", ".manage")));
}