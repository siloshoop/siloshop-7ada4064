import { handleSellerDeletion } from "../_shared/sellerDeletion.ts";
Deno.serve((req) => handleSellerDeletion(req, "store"));