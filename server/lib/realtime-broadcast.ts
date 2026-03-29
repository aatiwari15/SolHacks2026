import { supabaseAdmin } from "@/server/lib/supabase";

/**
 * Supabase Realtime broadcast only delivers after the channel is subscribed.
 * Calling .send() on a fresh channel without subscribe usually drops the message
 * for web clients — which is why Dante submissions never appeared in UNIDAD chat.
 */
export async function broadcastFormSubmitted(payload: Record<string, unknown>): Promise<void> {
  const channel = supabaseAdmin.channel("unidad:agents");

  await new Promise<void>((resolve) => {
    const finish = () => {
      void supabaseAdmin.removeChannel(channel);
      resolve();
    };

    let finished = false;

    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        console.warn("[Unidad] broadcast: subscribe timeout, skipping send");
        finish();
      }
    }, 8000);

    let sent = false;

    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED" && !sent) {
        sent = true;
        void (async () => {
          try {
            await channel.send({
              type: "broadcast",
              event: "form_submitted",
              payload,
            });
          } catch (e) {
            console.warn("[Unidad] broadcast send failed:", e);
          } finally {
            if (!finished) {
              finished = true;
              clearTimeout(timeout);
              finish();
            }
          }
        })();
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          if (err) console.warn("[Unidad] broadcast channel:", status, err.message);
          finish();
        }
      }
    });
  });
}
