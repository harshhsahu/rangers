"use client";

import { useRouter } from "next/navigation";
import { getIconOfService } from "@/utils/utility";
import { RANGER_CHANNELS } from "@/components/rangers/rangerConstants";
import TelegramPhone from "@/components/landing/TelegramPhone";

const MARQUEE = RANGER_CHANNELS.map(({ key, label, icon, brand }) => ({ key, label, Icon: icon, brand }));

/**
 * The track is two identical halves and the animation shifts it by exactly -50%,
 * so the second half lands where the first started and the loop is seamless.
 * That only holds while one half is wider than the viewport — with a single set
 * of six channels (~735px) a 1080p screen showed ~450px of empty bar at the
 * wrap. REPEATS keeps each half comfortably wider than any desktop.
 */
const MARQUEE_REPEATS = 4;
const MARQUEE_HALF = Array.from({ length: MARQUEE_REPEATS }, (_, i) => i);

const SERVICES = [
  ["openai", "Openai", "openai", "cool"],
  ["anthropic", "Anthropic", "anthropic", "acc"],
  ["gemini", "Gemini", "gemini", "cool"],
  ["groq", "Groq", "groq", "plain"],
  ["mistral", "Mistral", "mistral", "plain"],
  ["grok", "Grok", "grok", "plain"],
  ["moonshot", "Moonshot", "moonshot", "plain"],
  ["deepseek", "Deepseek", "deepseek", "plain"],
  ["deepgram", "Deepgram", "deepgram", "plain"],
  ["open_router", "Open Router", "open_router", "plain"],
  ["google", "Google", "google", "plain"],
  ["ai_ml", "AI / ML", "ai_ml", "plain"],
  ["minimax", "MiniMax", "minimax", "plain"],
];

const HOW = [
  {
    n: "1",
    t: "Prompt",
    b: "Role, goal and instruction, with variables and a response format. Every save is a version you can roll back.",
  },
  {
    n: "2",
    t: "Model",
    b: "Pick a provider and model, set temperature, tokens and tool choice, add a fallback model for rate limits.",
  },
  { n: "3", t: "Connectors", b: "Attach tools, other agents, knowledge bases and MCP servers to the same agent." },
  { n: "4", t: "Memory", b: "Turn on conversation memory and tell the agent what to remember between calls." },
];

const CAPABILITIES = [
  { t: "Tools", b: "Built-in web search and image generation, or your own functions with a JSON schema." },
  { t: "Connected agents", b: "Hand a task to another agent and get its answer back in the same run." },
  { t: "Knowledge base", b: "PDFs, CSVs and URLs, chunked semantically, recursively or by hand." },
  { t: "MCP servers", b: "Point at any MCP endpoint. Its tools show up in the agent immediately." },
];

const TINTS = { cool: "bg-cool", acc: "bg-acc", plain: "bg-card" };

const Page = () => {
  const router = useRouter();
  const toConsole = () => router.push("/login");

  return (
    <main className="min-h-screen bg-paper text-ink font-sans">
      {/* ------------------------------- Header ------------------------------ */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-6 border-b-2 border-stroke bg-paper px-6 py-4 md:px-9">
        <div className="flex items-center gap-3">
          <div className="grid h-[30px] w-[30px] place-items-center rounded-[9px] border-2 border-stroke bg-acc font-mono text-[15px] font-bold text-acc-ink">
            R
          </div>
          <div className="text-[21px] font-extrabold tracking-[-0.03em]">rangers</div>
        </div>
        <nav className="hidden gap-7 text-[15px] font-medium md:flex">
          <a className="text-ink hover:text-acc" href="#build">
            How it works
          </a>
          <a className="text-ink hover:text-acc" href="#models">
            Models
          </a>
          <a className="text-ink hover:text-acc" href="#connect">
            Connectors
          </a>
          <a className="text-ink hover:text-acc" href="#ship">
            Ship
          </a>
        </nav>
        <button
          onClick={toConsole}
          className="rounded-full border-2 border-stroke bg-ink px-5 py-2 text-[15px] font-bold text-paper"
        >
          Open console
        </button>
      </header>

      {/* -------------------------------- Hero ------------------------------- */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-14 px-6 pb-10 pt-16 md:px-9 md:pt-20 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-full border-2 border-stroke bg-card px-4 py-1.5 font-mono text-[12px] font-medium">
            <span className="relative inline-block h-2 w-2">
              <span
                className="absolute inset-0 rounded-full bg-acc"
                style={{ animation: "rgHalo 2.2s ease-out infinite" }}
              />
              <span className="absolute inset-0 rounded-full bg-acc" />
            </span>
            one agent · every model provider · your own MCP servers
          </div>

          <h1 className="mt-6 text-[46px] font-extrabold leading-[.92] tracking-[-0.05em] sm:text-[64px] lg:text-[86px]">
            Build the agent once. Call it from{" "}
            <span className="inline-block -rotate-[1.5deg] rounded-[14px] bg-acc px-2.5 text-acc-ink">anywhere</span>
          </h1>

          <p className="mt-6 max-w-[54ch] text-[19px] leading-[1.55] text-soft">
            Write the prompt, pick any model from thirteen providers, attach tools, knowledge bases and MCP servers,
            then reach the agent over the API or wire it to a Telegram trigger. Versions, history and token metrics come
            with it.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={toConsole}
              className="rounded-full border-2 border-stroke bg-acc px-7 py-4 text-[17px] font-bold text-acc-ink shadow-sm transition-transform"
            >
              Create an agent
            </button>
            <a
              href="#build"
              className="rounded-full border-2 border-stroke bg-card px-7 py-4 text-[17px] font-semibold text-ink"
            >
              Read the API guide
            </a>
          </div>

          <div className="mt-6 font-mono text-[12px] text-soft">bring your own keys · free tier · no card</div>
        </div>

        {/* Right column — the agent answering on Telegram */}
        <TelegramPhone />
      </section>

      {/* ------------------------------ Marquee ------------------------------ */}
      <div className="overflow-hidden border-y-2 border-stroke bg-ink py-[15px] text-paper">
        <div className="flex w-max" style={{ animation: "rgMarquee 34s linear infinite" }} aria-hidden="true">
          {[0, 1].map((half) => (
            <div key={half} className="flex">
              {MARQUEE_HALF.map((dup) => (
                <div key={dup} className="flex items-center whitespace-nowrap">
                  {MARQUEE.map(({ key, label, Icon, brand }) => (
                    <span key={`${half}-${dup}-${key}`} className="flex items-center">
                      <span className="flex items-center gap-2.5 px-[22px]">
                        <span className="grid h-[18px] w-[18px] flex-none place-items-center" style={{ color: brand }}>
                          <Icon height={18} width={18} />
                        </span>
                        <span className="font-mono text-[13px] font-medium uppercase leading-none tracking-[.11em]">
                          {label}
                        </span>
                      </span>
                      <span className="h-[3px] w-[3px] flex-none rounded-full bg-paper/35" />
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------------------- How it works --------------------------- */}
      <section id="build" className="mx-auto max-w-[1240px] px-6 py-20 md:px-9">
        <h2 className="mb-10 max-w-[20ch] text-[36px] font-extrabold tracking-[-0.04em] md:text-[48px]">
          Four tabs. That is the whole agent.
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW.map((s) => (
            <div
              key={s.n}
              className="flex flex-col gap-3 rounded-[18px] border-2 border-stroke bg-card p-[22px] shadow-sm"
            >
              <div className="grid h-[34px] w-[34px] place-items-center rounded-full border-2 border-stroke bg-acc font-mono text-[14px] font-bold text-acc-ink">
                {s.n}
              </div>
              <div className="text-[22px] font-bold tracking-[-0.025em]">{s.t}</div>
              <div className="text-[14.5px] leading-[1.6] text-soft">{s.b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------- Models ------------------------------ */}
      <section id="models" className="border-t-2 border-stroke bg-card">
        <div className="mx-auto max-w-[1240px] px-6 py-20 md:px-9">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-[18ch] text-[36px] font-extrabold tracking-[-0.04em] md:text-[48px]">
              Thirteen providers, one configuration
            </h2>
            <span className="font-mono text-[13px] text-soft">switch provider without touching your prompt</span>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map(([slug, label, value, tint]) => (
              <div key={value} className="flex items-center gap-3 rounded-[16px] border-2 border-stroke bg-paper p-4">
                <div
                  className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] border-2 border-ink ${TINTS[tint]}`}
                >
                  {getIconOfService(slug, 16, 16)}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{label}</span>
                  <span className="font-mono text-[10px] text-soft">{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------- Connectors ---------------------------- */}
      <section id="connect" className="mx-auto max-w-[1240px] px-6 py-20 md:px-9">
        <h2 className="mb-3 max-w-[20ch] text-[36px] font-extrabold tracking-[-0.04em] md:text-[48px]">
          Give it hands
        </h2>
        <p className="mb-8 max-w-[60ch] text-[17px] leading-[1.55] text-soft">
          Tools, other agents, knowledge bases and MCP servers all attach to the same agent from the Connectors tab.
        </p>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((c) => (
            <div key={c.t} className="flex flex-col gap-2.5 rounded-[16px] border-2 border-stroke bg-card p-5">
              <span className="text-[18px] font-extrabold tracking-[-0.02em]">{c.t}</span>
              <span className="text-[14px] leading-[1.55] text-soft">{c.b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------- Ship ------------------------------- */}
      <section id="ship" className="border-t-2 border-stroke">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-10 px-6 py-20 md:px-9">
          <div>
            <div className="max-w-[17ch] text-[40px] font-extrabold leading-none tracking-[-0.045em] md:text-[50px]">
              Versioned, testable, measurable.
            </div>
            <div className="mt-4 max-w-[52ch] text-[17px] text-soft">
              Publish a version, keep the old one, run your test cases, and watch tokens and cost per agent in metrics.
            </div>
          </div>
          <button
            onClick={toConsole}
            className="rounded-full border-2 border-stroke bg-acc px-8 py-4 text-[18px] font-bold text-acc-ink shadow-sm transition-transform"
          >
            Start building
          </button>
        </div>
        <div className="flex flex-wrap justify-between gap-5 border-t-2 border-stroke px-6 py-5 font-mono text-[11.5px] text-soft md:px-9">
          <span>rangers — agents, models and MCP in one place</span>
          <span>docs · status · privacy · © 2026</span>
        </div>
      </section>
    </main>
  );
};

export default Page;
