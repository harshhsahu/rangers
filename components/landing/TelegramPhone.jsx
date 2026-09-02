"use client";

import { useState } from "react";
import { TelegramIcon } from "@/components/rangers/ChannelIcons";

/**
 * Drop the screen recording here and it plays automatically.
 * Any file <video> can decode works — mp4 (h.264) is the safe default.
 */
export const TELEGRAM_DEMO_VIDEO = "/videos/telegram-ranger.mp4";
export const TELEGRAM_DEMO_POSTER = "/videos/telegram-ranger.jpg";

const TELEGRAM_BLUE = "#229ED9";

/** Shown until the recording is added, so the hero never renders an empty slot. */
const FALLBACK_THREAD = [
  { from: "them", text: "summarise today's failed payments" },
  { from: "bot", text: "4 failed in eu-west-1 — 3 card declines, 1 timeout. Total €218." },
  { from: "them", text: "retry the timeout one" },
  { from: "bot", text: "Retried #8821 — captured ✅" },
];

const TelegramPhone = () => {
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[290px]">
      {/* Phone shell */}
      <div className="relative rounded-[34px] border-2 border-stroke bg-ink p-[9px] shadow-sm">
        {/* Speaker notch */}
        <div className="absolute left-1/2 top-[15px] z-10 h-[5px] w-[54px] -translate-x-1/2 rounded-full bg-paper/25" />

        <div className="overflow-hidden rounded-[26px] bg-card">
          {/* Chat header */}
          <div
            className="flex items-center gap-2.5 px-3.5 pb-2.5 pt-[26px] text-white"
            style={{ backgroundColor: TELEGRAM_BLUE }}
          >
            <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-full bg-white/20">
              <TelegramIcon height={15} width={15} />
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-bold">Ops Ranger</span>
              <span className="block font-mono text-[9.5px] text-white/80">online</span>
            </span>
          </div>

          {/* Screen */}
          <div className="relative aspect-[9/16] bg-paper">
            {videoFailed ? (
              <div className="flex h-full flex-col justify-end gap-2 p-3">
                {FALLBACK_THREAD.map((m, i) => (
                  <div key={i} className={`flex ${m.from === "them" ? "justify-end" : "justify-start"}`}>
                    <span
                      className={`max-w-[82%] rounded-[13px] border-2 border-stroke px-2.5 py-1.5 text-[11.5px] leading-[1.35] ${
                        m.from === "them" ? "bg-acc text-acc-ink" : "bg-card text-ink"
                      }`}
                    >
                      {m.text}
                    </span>
                  </div>
                ))}
                <span className="pt-1 text-center font-mono text-[9px] uppercase tracking-[.12em] text-soft">
                  add {TELEGRAM_DEMO_VIDEO} to play the recording
                </span>
              </div>
            ) : (
              <video
                className="h-full w-full object-cover"
                src={TELEGRAM_DEMO_VIDEO}
                poster={TELEGRAM_DEMO_POSTER}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Talking to a ranger on Telegram"
                onError={() => setVideoFailed(true)}
                // Safari and some mobile browsers ignore the autoplay attribute
                // but allow a muted play() once the data is in.
                onLoadedData={(event) => {
                  const play = event.currentTarget.play();
                  if (play?.catch) play.catch(() => {});
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 text-center font-mono text-[11px] text-soft">the same agent, over Telegram</div>
    </div>
  );
};

export default TelegramPhone;
