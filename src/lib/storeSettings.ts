import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { phoneDigits } from "@/lib/phone";
const text = (max: number) => z.string().trim().max(max, "الحقل يتجاوز الطول المسموح");
const image = text(2048).refine((v) => !v || /^https:\/\/[^\s]+$/.test(v) || /^[a-f0-9-]+\/[^\s]+\.(jpg|jpeg|png|webp|gif)$/i.test(v), "رابط الصورة غير صالح");
export const storeSettingsSchema = z.object({
  store_name: text(150).min(1, "اسم المتجر مطلوب"), store_description: text(5000),
  contact_email: text(255).refine((v) => !v || z.string().email().safeParse(v).success, "البريد الإلكتروني غير صالح"),
  contact_phone: text(30).transform((value, ctx) => {
    if (!value) return "";
    const phone = parsePhoneNumberFromString(`${value.startsWith("+") ? "+" : ""}${phoneDigits(value)}`, "SY");
    if (!phone?.isValid()) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "رقم الهاتف غير صالح؛ أدخل رقمًا صحيحًا مع رمز الدولة" }); return z.NEVER; }
    return phone.number;
  }),
  address: text(1000), city: text(100), logo_url: image, cover_image_url: image,
  working_hours: text(500), return_policy: text(5000), shipping_policy: text(5000), business_info: text(3000),
});
export type StoreSettings = z.input<typeof storeSettingsSchema>;
export const EMPTY_STORE: StoreSettings = { store_name: "", store_description: "", contact_email: "", contact_phone: "", address: "", city: "", logo_url: "", cover_image_url: "", working_hours: "", return_policy: "", shipping_policy: "", business_info: "" };
export const storeSettingsArgs = (d: z.output<typeof storeSettingsSchema>) => ({ _store_name: d.store_name, _store_description: d.store_description, _contact_email: d.contact_email, _contact_phone: d.contact_phone, _address: d.address, _city: d.city, _logo_url: d.logo_url, _cover_image_url: d.cover_image_url, _working_hours: d.working_hours, _return_policy: d.return_policy, _shipping_policy: d.shipping_policy, _business_info: d.business_info });