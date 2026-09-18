import { supabase } from "@/integrations/supabase/client";

export const ACTIVATION_CHANNEL = "activation-updates";

export const broadcastActivationChange = async (table: string, id: string) => {
  const channel = supabase.channel(`${ACTIVATION_CHANNEL}-${crypto.randomUUID()}`);
  try {
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve();
      });
    });
    await channel.send({
      type: "broadcast",
      event: "changed",
      payload: { table, id },
    });
  } finally {
    await supabase.removeChannel(channel);
  }
};