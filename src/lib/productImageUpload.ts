import { supabase } from "@/integrations/supabase/client";
import { UploadError, describeUploadError } from "@/lib/uploadErrors";

/** Uploads one approved product picture unchanged to the owner's folder and returns its public URL. */
export const uploadProductImage = async (userId: string, file: File, folder?: string): Promise<string> => {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${folder ? `${folder}/` : ""}${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file);
  if (error) throw new UploadError(describeUploadError(error, file));
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
};
