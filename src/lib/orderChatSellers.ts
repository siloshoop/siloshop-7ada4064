export const orderChatSellers = (items: { vendor_id?: string | null }[]) =>
  [...new Set(items.flatMap((item) => item.vendor_id ? [item.vendor_id] : []))];