"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Landing hero — a phone running a scripted Telegram conversation with a
 * ranger. Ported from the "Landing Hero Telegram" design canvas; the colours
 * and metrics here are Telegram's own chrome, so they are literals rather than
 * theme tokens and do not follow the app's light/dark palette.
 *
 * `bubbleIn` and `tgDot` live in app/globals.css.
 */

const SCRIPT = [
  { role: "user", text: "summarise today's failed payments", time: "4:59 PM", pause: 900 },
  {
    role: "agent",
    text: "4 payments failed today, $612 in total.\n\n• 3 card_declined\n• 1 insufficient_funds\n\nBiggest: Acme Ltd, $420",
    time: "4:59 PM",
    think: 1700,
    pause: 1600,
  },
  { role: "user", text: "retry the Acme one", time: "5:00 PM", pause: 1000 },
  {
    role: "agent",
    text: "Retried and it went through. Receipt sent to billing@acme.com",
    time: "5:00 PM",
    think: 1500,
    pause: 3200,
  },
];

const SCREEN_BG = [
  "radial-gradient(120% 90% at 8% 0%, #E7F5A9 0%, rgba(231,245,169,0) 55%)",
  "radial-gradient(130% 110% at 100% 55%, #63BE8E 0%, rgba(99,190,142,0) 60%)",
  "linear-gradient(165deg, #C9E79A 0%, #9AD69B 42%, #7ECB9B 74%, #64BE8E 100%)",
].join(", ");

const GLASS = { background: "rgba(240,250,230,.72)", backdropFilter: "blur(14px)" };

const bubbleStyle = (mine) => ({
  maxWidth: "80%",
  background: mine ? "#EEFCD3" : "#FFFFFF",
  color: "#0F1A0E",
  borderRadius: mine ? "17px 17px 5px 17px" : "17px 17px 17px 5px",
  padding: "3px 10px 3px 11px",
  fontSize: "15px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  lineHeight: "1.2",
  whiteSpace: "pre-line",
  display: "flex",
  alignItems: "flex-end",
  gap: "7px",
  boxShadow: "0 1px 2px rgba(15,26,14,.14)",
  animation: "bubbleIn .34s cubic-bezier(.2,.8,.3,1) both",
});

const metaStyle = (mine) => ({
  display: "flex",
  alignItems: "center",
  gap: "2px",
  flex: "none",
  paddingBottom: "1px",
  fontSize: "11px",
  fontWeight: 600,
  color: mine ? "#5AA84A" : "#8E9C8B",
});

const TelegramPhone = () => {
  const [count, setCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    // The whole schedule is driven by chained timeouts; every id is collected
    // so a unmount mid-conversation cannot leave one firing into dead state.
    const timers = timersRef.current;
    const prefersReducedMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setCount(SCRIPT.length);
      return undefined;
    }

    const wait = (ms, fn) => {
      timers.push(setTimeout(fn, ms));
    };

    const run = (index) => {
      if (index >= SCRIPT.length) {
        wait(SCRIPT[SCRIPT.length - 1].pause, () => {
          setCount(0);
          setTyping(false);
          wait(900, () => run(0));
        });
        return;
      }

      const step = SCRIPT[index];
      const show = () => {
        setCount(index + 1);
        setTyping(false);
        wait(step.pause, () => run(index + 1));
      };

      if (step.think) {
        setTyping(true);
        wait(step.think, show);
      } else {
        wait(index === 0 ? 700 : 200, show);
      }
    };

    run(0);
    return () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
    };
  }, []);

  const messages = SCRIPT.slice(0, count);

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div
        style={{
          // The canvas has no box-sizing reset, so its `width: 330px` is the
          // content box: 330 screen + 11px padding + 2px border a side = 356px
          // overall. Tailwind applies border-box globally, so the width has to
          // be the outer total to land on the same 330px screen.
          width: "min(356px, 100%)",
          borderRadius: 54,
          border: "2px solid #14110D",
          background: "#14110D",
          padding: 11,
          boxShadow: "9px 11px 0 rgba(20,17,13,.13)",
        }}
      >
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 44,
            height: 660,
            display: "flex",
            flexDirection: "column",
            fontFamily: "-apple-system, 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', sans-serif",
            backgroundImage: SCREEN_BG,
          }}
        >
          {/* Notch */}
          <div
            style={{
              position: "absolute",
              top: 9,
              left: "50%",
              transform: "translateX(-50%)",
              width: 92,
              height: 27,
              borderRadius: 999,
              background: "#14110D",
              zIndex: 6,
            }}
          />

          <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 5 }}>
            {/* Status bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 44,
                padding: "0 22px",
                fontSize: 13.5,
                fontWeight: 700,
                color: "#142013",
                letterSpacing: ".01em",
              }}
            >
              <span style={{ width: 62, fontSize: 13.5 }}>12:19</span>
              <span style={{ width: 92 }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, width: 62 }}>
                <span style={{ display: "flex", alignItems: "flex-end", gap: 1.5 }}>
                  {[4, 6, 8].map((height) => (
                    <span key={height} style={{ width: 3, height, background: "#142013", borderRadius: 1 }} />
                  ))}
                  <span style={{ width: 3, height: 10, background: "rgba(20,32,19,.3)", borderRadius: 1 }} />
                </span>
                <span
                  style={{
                    width: 22,
                    height: 11,
                    borderRadius: 3,
                    padding: 1.5,
                    display: "block",
                    background: "#F03A3A",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: "100%",
                      height: "100%",
                      borderRadius: 1,
                      color: "#fff",
                      fontSize: 8,
                      fontWeight: 700,
                      textAlign: "center",
                      lineHeight: "8px",
                    }}
                  >
                    18
                  </span>
                </span>
              </div>
            </div>

            {/* Chat header */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px" }}>
              <span
                style={{
                  ...GLASS,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  padding: "7px 12px 7px 9px",
                }}
              >
                <span style={{ fontSize: 21, lineHeight: 1, fontWeight: 400, color: "#142013", marginTop: -3 }}>‹</span>
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 19,
                    height: 19,
                    borderRadius: 999,
                    background: "#142013",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  8
                </span>
              </span>

              <div
                style={{
                  ...GLASS,
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minWidth: 0,
                  borderRadius: 999,
                  padding: "5px 14px 6px",
                }}
              >
                <span
                  style={{
                    fontSize: 15.5,
                    fontWeight: 700,
                    letterSpacing: "-.01em",
                    whiteSpace: "nowrap",
                    color: "#142013",
                  }}
                >
                  rangers ops agent
                </span>
                <span style={{ fontSize: 11.5, color: "#6E7C6B", lineHeight: 1.1 }}>
                  {typing ? "typing…" : "bot · online"}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  height: 38,
                  width: 38,
                  borderRadius: 999,
                  background: "#F2540B",
                  color: "#FFF6EE",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 15,
                  fontWeight: 700,
                  flex: "none",
                  boxShadow: "0 0 0 2.5px rgba(240,250,230,.72)",
                }}
              >
                R
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              gap: 5,
              padding: "96px 9px 8px",
            }}
          >
            {messages.map((message, index) => {
              const mine = message.role === "user";
              return (
                <div
                  key={`${index}-${message.time}`}
                  style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}
                >
                  <div style={bubbleStyle(mine)}>
                    {/* Sizes repeated on the spans themselves: a global
                        `p, span, div { font-size: .875rem }` under 640px in
                        globals.css beats the inherited value, and inline
                        styles are what override it. */}
                    <span style={{ fontSize: 15 }}>{message.text}</span>
                    <span style={metaStyle(mine)}>
                      <span style={{ fontSize: 11 }}>{message.time}</span>
                      {mine && (
                        <svg
                          width="17"
                          height="11"
                          viewBox="0 0 17 11"
                          fill="none"
                          stroke="#4FAE4E"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M1 6.1 4.2 9.4 10.4 1.6" />
                          <path d="M6.6 6.1 9.8 9.4 16 1.6" />
                        </svg>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}

            {typing && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#fff",
                    borderRadius: "14px 14px 14px 4px",
                    padding: "12px 14px",
                    boxShadow: "0 1px 1px rgba(16,35,47,.12)",
                    animation: "bubbleIn .3s ease-out both",
                  }}
                >
                  {[0, 0.2, 0.4].map((delay) => (
                    <span
                      key={delay}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "#527DA3",
                        animation: `tgDot 1.2s ${delay}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div style={{ flex: "none", padding: "6px 9px 4px", display: "flex", alignItems: "center", gap: 7 }}>
            <span
              style={{
                ...GLASS,
                display: "grid",
                placeItems: "center",
                width: 36,
                height: 36,
                borderRadius: 999,
                flex: "none",
              }}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4C5C49"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20.5 11.5 12 20a4.6 4.6 0 0 1-6.5-6.5l8-8a3 3 0 0 1 4.3 4.3l-8 8a1.5 1.5 0 0 1-2.1-2.1l7.3-7.3" />
              </svg>
            </span>

            <span
              style={{
                ...GLASS,
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: 999,
                padding: "9px 14px",
                fontSize: 15,
                fontWeight: 500,
                color: "#6E7C6B",
              }}
            >
              Message
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4C5C49"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12a9 9 0 1 1-9-9c0 5 4 9 9 9Z" />
                <path d="M21 12c-3.2 0-5.6 2.4-5.6 5.6" />
              </svg>
            </span>

            <span
              style={{
                ...GLASS,
                display: "grid",
                placeItems: "center",
                width: 36,
                height: 36,
                borderRadius: 999,
                flex: "none",
              }}
            >
              {/* A real mic, matching the design file — this was two stacked
                  rounded divs, which read as a pill above a dash, not a mic. */}
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4C5C49"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="9" y="2.5" width="6" height="10.5" rx="3" />
                <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
                <path d="M12 17.5V21" />
              </svg>
            </span>
          </div>

          {/* Home indicator */}
          <div style={{ flex: "none", display: "flex", justifyContent: "center", padding: "2px 0 8px" }}>
            <span style={{ width: 118, height: 5, borderRadius: 999, background: "rgba(20,32,19,.32)" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramPhone;
