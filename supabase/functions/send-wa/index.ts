// =============================================================
// EDGE FUNCTION: send-wa
// Fungsi: kirim WA via FONTE + catat ke notifications_log
// =============================================================

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendWaPayload {
  prescription_id?: string | null;
  tipe: "resep_baru" | "h1_reminder" | "h1_followup" | "manual";
  target_wa: string;
  pesan: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---------------------------------------------------------
    // 1. Inisialisasi Supabase client (pakai service role)
    // ---------------------------------------------------------
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ---------------------------------------------------------
    // 2. Ambil token FONTE dari tabel settings
    // ---------------------------------------------------------
    const { data: settingRows, error: settingErr } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["fonnte_token"]);

    if (settingErr) throw settingErr;

    const fonnteToken = settingRows?.find((r) => r.key === "fonnte_token")?.value;
    if (!fonnteToken) {
      throw new Error("Token FONTE belum diisi di tabel settings");
    }

    // ---------------------------------------------------------
    // 3. Parse payload dari frontend
    // ---------------------------------------------------------
    const payload: SendWaPayload = await req.json();

    if (!payload.target_wa || !payload.pesan) {
      return new Response(
        JSON.stringify({ ok: false, error: "target_wa dan pesan wajib diisi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------------------------------------------------------
    // 4. Kirim ke FONTE
    // ---------------------------------------------------------
    const formData = new FormData();
    formData.append("target", payload.target_wa);
    formData.append("message", payload.pesan);
    formData.append("countryCode", "62"); // otomatis tambah 62 jika perlu

    const fonnteRes = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: fonnteToken,
      },
      body: formData,
    });

    const fonnteJson = await fonnteRes.json();
    const isSuccess = fonnteRes.ok && fonnteJson?.status === true;

    // ---------------------------------------------------------
    // 5. Catat ke notifications_log
    // ---------------------------------------------------------
    await supabase.from("notifications_log").insert({
      prescription_id: payload.prescription_id ?? null,
      tipe: payload.tipe,
      target_wa: payload.target_wa,
      pesan: payload.pesan,
      status: isSuccess ? "sent" : "failed",
      response_fonnte: fonnteJson,
    });

    // ---------------------------------------------------------
    // 6. Kembalikan response
    // ---------------------------------------------------------
    return new Response(
      JSON.stringify({
        ok: isSuccess,
        fonnte: fonnteJson,
      }),
      {
        status: isSuccess ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("send-wa error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
