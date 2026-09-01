import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

const chatInput = z.object({
  question: z.string().trim().min(1).max(500),
});

type WatchEvent = Database["public"]["Tables"]["watch_events"]["Row"];

const latestByType = (events: WatchEvent[], eventType: string) =>
  events.find((event) => event.event_type === eventType) ?? null;

export const askWatchAssistant = createServerFn({ method: "POST" })
  .inputValidator((data) => chatInput.parse(data))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    const lovableApiKey = process.env["LOVABLE_API_KEY"];

    if (!url || !publishableKey || !lovableApiKey) {
      throw new Error("The assistant is not configured yet.");
    }

    const supabase = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: events, error } = await supabase
      .from("watch_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw new Error("Could not read the latest watch data.");
    }

    const rows = events ?? [];
    const vitals = latestByType(rows, "vitals");
    const steps = latestByType(rows, "steps");
    const score = latestByType(rows, "game_score");
    const context = [
      `Heart Rate: ${vitals?.heart_rate ?? "not available"} bpm`,
      `SpO2: ${vitals?.spo2 ?? "not available"}%`,
      `Steps: ${steps?.steps ?? "not available"}`,
      `Game Score: ${score?.score ?? "not available"}`,
    ].join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are PulseOS AI, a concise and friendly smartwatch health companion. Use the supplied readings to answer simply in 1-3 short sentences. Do not diagnose, alarm, or claim certainty. Suggest rest, hydration, gentle movement, or checking with a clinician when appropriate. Mention that watch readings are informational when health concerns are raised.",
          },
          {
            role: "user",
            content: `User health data:\n${context}\n\nUser question: ${data.question}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("The assistant could not respond right now.");
    }

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = result.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("The assistant returned an empty response.");
    }

    return { content };
  });