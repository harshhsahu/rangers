import React from "react";

/** Wordmark drawn by the loader. */
const WORDMARK = "RANGERS";
/** Per-letter stagger so the word types itself in. */
const LETTER_STAGGER = 0.1;

function LoadingSpinner({
  height = "100vh",
  width = "100vw",
  marginLeft = "0px",
  marginTop = "0px",
  margin = "auto",
  inline = false,
  size = 88,
  className = "",
}) {
  return (
    <div
      data-testid="loading-spinner"
      className={`${inline ? "flex items-center justify-center" : "fixed inset-0 bg-base-200 flex flex-col justify-center items-center z-very-high"} ${className}`}
      style={{ height, width, margin, marginLeft, marginTop }}
    >
      <svg
        viewBox="0 0 220 220"
        aria-label={`${WORDMARK} loading animation`}
        className="overflow-visible"
        style={{ width: size, height: size }}
      >
        {/* Sweeping arc in the accent orange */}
        <path
          d="M50 78 A60 60 0 0 1 170 78"
          fill="none"
          stroke="var(--acc)"
          strokeWidth="10"
          strokeLinecap="butt"
          strokeDasharray="220"
          strokeDashoffset="220"
        >
          <animate attributeName="stroke-dashoffset" values="220;0;-220" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.2;1;0.2" dur="2s" repeatCount="indefinite" />
        </path>

        <text
          x="110"
          y="122"
          textAnchor="middle"
          fill="var(--ink)"
          className="font-mono text-[26px] font-extrabold tracking-[0.02em]"
        >
          {WORDMARK.split("").map((letter, i) => (
            <tspan key={i}>
              {letter}
              <animate
                attributeName="opacity"
                values="0;0;1;1;0;0"
                keyTimes="0;0.1;0.25;0.75;0.9;1"
                dur="2s"
                begin={`${i * LETTER_STAGGER}s`}
                repeatCount="indefinite"
              />
            </tspan>
          ))}
        </text>
      </svg>
    </div>
  );
}
export default LoadingSpinner;
