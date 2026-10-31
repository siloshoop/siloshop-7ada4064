import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleSellerDeletion } from "../_shared/sellerDeletion.ts";
for (const scope of ["account", "store"] as const) {
  Deno.test(`${scope}: missing bearer never starts cleanup`, async () => {
    const response = await handleSellerDeletion(new Request("https://example.test", { method: "POST", body: "{}" }), scope);
    assertEquals(response.status, 401);
    assertEquals(await response.json(), { error: "unauthorized" });
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  });
  Deno.test(`${scope}: CORS preflight does not require authentication`, async () => {
    const response = await handleSellerDeletion(new Request("https://example.test", { method: "OPTIONS" }), scope);
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  });
}