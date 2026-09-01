import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  Check,
  CircleAlert,
  CircleHelp,
  Footprints,
  Gamepad2,
  HeartPulse,
  LoaderCircle,
  MessageCircle,
  Minus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkle,
  Wifi,
  Wind,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";

import {
  Conversation,
  ConversationContent,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { askWatchAssistant } from "@/lib/watch.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PulseOS — Smartwatch Telemetry" },
      { name: "description", content: "Live smartwatch vitals, activity trends, and calm AI health insights." },
      { property: "og:title", content: "PulseOS — Smartwatch Telemetry" },
      { property: "og:description", content: "Live smartwatch vitals, activity trends, and calm AI health insights." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

type WatchEvent = Database["public"]["Tables"]["watch_events"]["Row"];
type ChatMessage = { id: string; from: "user" | "assistant"; text: string };

const formatTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value))
    : "Awaiting signal";

const formatChartTime = (value: string) =>
  new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const latestOf = (events: WatchEvent[], type: WatchEvent["event_type"]) =>
  events.find((event) => event.event_type === type) ?? null;

function Dashboard() {
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: "welcome", from: "assistant", text: "Hi, I’m PulseOS. I can read your latest watch data. Ask me anything about your vitals 👋" },
  ]);
  const [isChatting, setIsChatting] = useState(false);
  const chatAssistant = useServerFn(askWatchAssistant);

  const loadTelemetry = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    setError(null);
    const result = await supabase
      .from("watch_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (result.error) {
      setError("Telemetry is temporarily unavailable. Try refreshing again.");
    } else {
      setEvents(result.data ?? []);
      setLastUpdated(new Date().toISOString());
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    void loadTelemetry();
  }, [loadTelemetry]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = window.setInterval(() => void loadTelemetry(), 5000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, loadTelemetry]);

  const vitals = useMemo(() => latestOf(events, "vitals"), [events]);
  const stepsEvent = useMemo(() => latestOf(events, "steps"), [events]);
  const scoreEvent = useMemo(() => latestOf(events, "game_score"), [events]);
  const heartRate = vitals?.heart_rate ?? null;
  const spo2 = vitals?.spo2 ?? null;
  const steps = stepsEvent?.steps ?? null;
  const score = scoreEvent?.score ?? null;

  const heartChart = useMemo(
    () => events.filter((event) => event.event_type === "vitals" && event.heart_rate != null).slice(0, 20).reverse().map((event) => ({ time: formatChartTime(event.created_at), value: event.heart_rate })),
    [events],
  );
  const spo2Chart = useMemo(
    () => events.filter((event) => event.event_type === "vitals" && event.spo2 != null).slice(0, 20).reverse().map((event) => ({ time: formatChartTime(event.created_at), value: event.spo2 })),
    [events],
  );
  const stepsChart = useMemo(
    () => events.filter((event) => event.event_type === "steps" && event.steps != null).slice(0, 20).reverse().map((event) => ({ time: formatChartTime(event.created_at), value: event.steps })),
    [events],
  );

  const alerts = useMemo(() => {
    const items: Array<{ tone: "critical" | "warning" | "normal"; title: string; detail: string }> = [];
    if (heartRate != null && heartRate > 100) items.push({ tone: "critical", title: "High heart rate", detail: `${heartRate} bpm detected` });
    if (heartRate != null && heartRate < 50) items.push({ tone: "warning", title: "Low heart rate", detail: `${heartRate} bpm detected` });
    if (spo2 != null && spo2 < 95) items.push({ tone: "critical", title: "Low oxygen level", detail: `SpO2 at ${spo2}%` });
    if (steps != null && steps < 500) items.push({ tone: "warning", title: "Low activity today", detail: `${steps.toLocaleString()} steps recorded` });
    if (items.length === 0) items.push({ tone: "normal", title: "All signals nominal", detail: "No rule-based alerts right now" });
    return items;
  }, [heartRate, spo2, steps]);

  const insight = useMemo(() => {
    const parts: string[] = [];
    if (heartRate != null && heartRate > 100) parts.push("Heart rate is high — take a rest ❤️");
    else if (heartRate != null && heartRate < 50) parts.push("Heart rate is low — take it easy and recheck ❤️");
    if (spo2 != null && spo2 < 95) parts.push("Oxygen level is low — monitor closely 🫁");
    if (steps != null && steps < 500) parts.push("Low activity today — consider a short walk 🚶");
    return parts.length ? parts.join(" ") : "Your vitals look normal — keep listening to your body 👍";
  }, [heartRate, spo2, steps]);

  const handleChat = async ({ text }: { text: string }) => {
    const question = text.trim();
    if (!question || isChatting) return;
    setChatMessages((current) => [...current, { id: `${Date.now()}-user`, from: "user", text: question }]);
    setIsChatting(true);
    try {
      const response = await chatAssistant({ data: { question } });
      setChatMessages((current) => [...current, { id: `${Date.now()}-assistant`, from: "assistant", text: response.content }]);
    } catch {
      setChatMessages((current) => [...current, { id: `${Date.now()}-error`, from: "assistant", text: "I couldn’t reach the assistant just now. Please try again in a moment." }]);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <main className="min-h-screen bg-ink text-ash antialiased">
      <div className="mx-auto max-w-[1440px] px-5 py-5 md:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line/70 pb-5">
          <div className="flex items-center gap-4">
            <div className="grid size-11 place-items-center rounded-full border border-gold/50">
              <Activity className="size-5 text-gold" />
            </div>
            <div>
              <p className="font-serif text-2xl leading-none tracking-tight md:text-[28px]">PULSEOS</p>
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.34em] text-mute">Smartwatch Telemetry · Noir</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-line bg-panel-2 px-3.5 py-2 sm:flex">
              <span className="size-2 rounded-full bg-ok animate-pulse" />
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Live</span>
            </div>
            <Button type="button" variant="outline" className="rounded-full border-line bg-panel-2 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ash hover:border-gold/50 sm:px-4 sm:text-[11px]" onClick={() => setAutoRefresh((value) => !value)}>
              <Wifi className="size-3.5" /> Auto {autoRefresh ? "On" : "Off"}
            </Button>
            <Button type="button" className="rounded-full bg-gold px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ink hover:bg-gold/90 sm:px-4 sm:text-[11px]" onClick={() => void loadTelemetry(true)} disabled={isRefreshing}>
              <RefreshCw className={isRefreshing ? "size-3.5 animate-spin" : "size-3.5"} /> Refresh
            </Button>
          </div>
        </header>

        <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div className="flex items-end justify-between gap-4">
              <h1 className="font-serif text-[34px] leading-[1.02] tracking-tight md:text-[44px]">Your body,<br />in <span className="italic text-gold">real time.</span></h1>
              <p className="hidden text-right font-mono text-[11px] leading-relaxed text-mute sm:block">LAST UPDATED<br /><span className="text-ash">{formatTime(lastUpdated)}</span></p>
            </div>

            {error && <div className="flex items-center gap-3 rounded-xl border border-crit/40 bg-crit/10 px-4 py-3 text-sm text-ash"><CircleAlert className="size-4 shrink-0 text-crit" /> {error}</div>}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <MetricCard icon={<HeartPulse />} label="Heart Rate" unit="BPM" value={heartRate} status={heartRate != null && heartRate > 100 ? "High" : heartRate != null && heartRate < 50 ? "Low" : "Stable"} tone={heartRate != null && (heartRate > 100 || heartRate < 50) ? "crit" : "ok"} loading={isLoading} delay="50ms" />
              <MetricCard icon={<Wind />} label="SpO2" unit="%" value={spo2} status={spo2 != null && spo2 < 95 ? "Monitor" : "Stable"} tone={spo2 != null && spo2 < 95 ? "crit" : "ok"} loading={isLoading} delay="120ms" />
              <MetricCard icon={<Footprints />} label="Steps" unit="TODAY" value={steps} status={steps != null && steps < 500 ? "Low" : "Moving"} tone={steps != null && steps < 500 ? "warn" : "ok"} loading={isLoading} delay="190ms" />
              <MetricCard icon={<Gamepad2 />} label="Game Score" unit="POINTS" value={score} status="Latest" tone="ok" loading={isLoading} delay="260ms" />
            </div>

            <section className="animate-gold-pulse animate-fade-up flex items-start gap-4 rounded-2xl border border-gold/40 bg-panel-2 p-5" aria-label="Smart insight">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-gold/30 bg-ink text-gold"><BrainCircuit className="size-5" /></div>
              <div><p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-gold">Smart Insight</p><p className="text-[15px] leading-snug text-ash">{insight}</p></div>
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ChartCard title="Heart Rate" meta="BPM · last 20 readings" color="var(--color-crit)" data={heartChart} type="line" empty={isLoading} />
              <ChartCard title="SpO2" meta="% · last 20 readings" color="var(--color-ok)" data={spo2Chart} type="line" empty={isLoading} />
              <div className="sm:col-span-2"><ChartCard title="Steps" meta="total · last 20 readings" color="var(--color-gold)" data={stepsChart} type="bar" empty={isLoading} /></div>
            </div>

            <section>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.28em] text-mute">Health Alerts</p>
              <div className="space-y-3">{alerts.map((alert) => <AlertRow key={alert.title} {...alert} />)}</div>
            </section>
          </div>

          <aside className="lg:col-span-4">
            <div className="flex h-[640px] flex-col rounded-2xl border border-line bg-panel lg:sticky lg:top-5">
              <div className="flex items-center gap-3 border-b border-line px-5 py-4">
                <div className="grid size-9 place-items-center rounded-full border border-gold/40 bg-panel-2 text-gold"><MessageCircle className="size-4" /></div>
                <div><p className="font-serif text-base leading-none tracking-tight">PulseOS AI</p><p className="mt-1 font-mono text-[10px] text-mute">Health companion · Lovable AI</p></div>
                <ShieldCheck className="ml-auto size-4 text-ok" />
              </div>
              <Conversation className="min-h-0 flex-1"><ConversationContent className="gap-4 px-5 py-4">
                {chatMessages.map((message) => <Message key={message.id} from={message.from} className="max-w-[92%]"><MessageContent className={message.from === "user" ? "rounded-2xl rounded-tr-sm bg-gold px-4 py-3 font-medium text-ink" : "rounded-2xl rounded-tl-sm border border-line bg-panel-2 px-4 py-3 leading-relaxed text-ash"}><MessageResponse>{message.text}</MessageResponse></MessageContent></Message>)}
                {isChatting && <Message from="assistant"><MessageContent className="rounded-2xl rounded-tl-sm border border-line bg-panel-2 px-4 py-3"><Shimmer className="font-mono text-xs text-mute">Reading your latest signals…</Shimmer></MessageContent></Message>}
              </ConversationContent></Conversation>
              <div className="border-t border-line p-4"><PromptInput onSubmit={handleChat} className="border-line bg-panel-2"><PromptInputTextarea placeholder="Ask about your health…" /><PromptInputFooter className="justify-end"><PromptInputSubmit status={isChatting ? "submitted" : undefined} aria-label="Send question" className="rounded-full bg-gold text-ink hover:bg-gold/90" /></PromptInputFooter></PromptInput></div>
            </div>
          </aside>
        </div>

        <footer className="mt-8 flex items-center justify-between border-t border-line/60 pt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-faint"><span>PULSEOS · Secure telemetry</span><span>Read-only · 5s refresh</span></footer>
      </div>
    </main>
  );
}

function MetricCard({ icon, label, unit, value, status, tone, loading, delay }: { icon: React.ReactNode; label: string; unit: string; value: number | null; status: string; tone: "crit" | "warn" | "ok"; loading: boolean; delay: string }) {
  const toneClass = tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-ok";
  return <div className="animate-fade-up rounded-2xl border border-line bg-panel p-4" style={{ animationDelay: delay }}><div className="flex items-center justify-between"><span className="text-gold">{icon}</span><span className="font-mono text-[9px] uppercase tracking-[0.18em] text-faint">{unit}</span></div>{loading ? <div className="mt-5 h-10 w-24 animate-pulse rounded bg-panel-2" /> : <p className="mt-4 font-mono text-4xl tabular-nums text-ash">{value == null ? "—" : value.toLocaleString()}</p>}<p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.12em] ${toneClass}`}>{status}</p><p className="mt-2 font-mono text-[9px] text-faint">{label}</p></div>;
}

function ChartCard({ title, meta, color, data, type, empty }: { title: string; meta: string; color: string; data: Array<{ time: string; value: number | null }>; type: "line" | "bar"; empty: boolean }) {
  return <section className="animate-fade-up rounded-2xl border border-line bg-panel p-5"><div className="mb-4 flex items-center justify-between"><p className="font-serif text-lg tracking-tight text-ash">{title}</p><span className="font-mono text-[10px] text-faint">{meta}</span></div><div className="h-40">{empty ? <div className="h-full animate-pulse rounded bg-panel-2" /> : data.length === 0 ? <div className="grid h-full place-items-center font-mono text-xs text-faint">No readings yet</div> : <ResponsiveContainer width="100%" height="100%">{type === "line" ? <LineChart data={data}><CartesianGrid stroke="var(--color-line)" vertical={false} /><XAxis dataKey="time" hide /><YAxis hide domain={["auto", "auto"]} /><Tooltip contentStyle={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", borderRadius: "10px", color: "var(--color-ash)" }} labelStyle={{ color: "var(--color-mute)" }} /><Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: color, stroke: "var(--color-ink)" }} /></LineChart> : <BarChart data={data}><CartesianGrid stroke="var(--color-line)" vertical={false} /><XAxis dataKey="time" hide /><YAxis hide domain={[0, "auto"]} /><Tooltip contentStyle={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", borderRadius: "10px", color: "var(--color-ash)" }} /><Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} /></BarChart>}</ResponsiveContainer>}</div><div className="mt-2 flex justify-between font-mono text-[9px] text-faint"><span>{data[0]?.time ?? "—"}</span><span>{data.at(-1)?.time ?? "—"}</span></div></section>;
}

function AlertRow({ tone, title, detail }: { tone: "critical" | "warning" | "normal"; title: string; detail: string }) {
  const classes = tone === "critical" ? "border-crit/40 bg-crit/10 text-crit" : tone === "warning" ? "border-warn/40 bg-warn/10 text-warn" : "border-ok/30 bg-ok/5 text-ok";
  const Icon = tone === "critical" ? CircleAlert : tone === "warning" ? CircleHelp : Check;
  return <div className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 ${classes}`}><Icon className="size-4 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-ash">{title}</p><p className="mt-0.5 font-mono text-[10px] text-mute">{detail}</p></div><span className="font-mono text-[10px] uppercase tracking-[0.16em]">{tone === "normal" ? "Normal" : tone === "critical" ? "Critical" : "Warning"}</span></div>;
}