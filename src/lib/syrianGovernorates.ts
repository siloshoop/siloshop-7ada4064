export const SYRIAN_GOVERNORATES = [
  "دمشق",
  "ريف دمشق",
  "حلب",
  "حمص",
  "حماة",
  "اللاذقية",
  "طرطوس",
  "إدلب",
  "درعا",
  "السويداء",
  "القنيطرة",
  "الرقة",
  "دير الزور",
  "الحسكة",
] as const;

export type SyrianGovernorate = (typeof SYRIAN_GOVERNORATES)[number];