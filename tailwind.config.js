const defaultTheme = require("./public/themes/default-user-theme.json");

/* Neo-brutalist paper shapes: hard 2px ink strokes, pill buttons, soft-cornered boxes. */
const shapeTokens = {
  "--rounded-box": "0.875rem",
  "--rounded-btn": "9999px",
  "--rounded-badge": "9999px",
  "--border-btn": "2px",
  "--tab-radius": "0.5rem",
  "--btn-text-case": "none",
  "--animation-btn": "0.15s",
  "--animation-input": "0.15s",
  "--btn-focus-scale": "1",
};

const shapeTokensDark = {
  ...shapeTokens,
  "--border-select": "2px",
};

const buildTheme = (tokens, colorScheme = "light") => ({
  "color-scheme": colorScheme,
  ...tokens,
  ...(colorScheme === "dark" ? shapeTokensDark : shapeTokens),
});

const CHART_STYLE = {
  grid: "#f3f4f6",
  axis: "#9ca3af",
  tooltip: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    fontSize: "12px",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  },
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    { pattern: /bg-(red|green|yellow|orange|gray)-500\/(20|30)/ },
    { pattern: /border-(red|green|yellow|orange|gray)-500/ },
    { pattern: /border-(trace-gold|trace-blue|trace-green|trace-gold-border)/ },
    { pattern: /bg-trace-(gold|blue|green|gold-bg)/ },
    { pattern: /text-trace-(gold|blue|green|gold-bg)/ },
    { pattern: /from-trace-(gold|blue|green)/ },
    { pattern: /text-(red|green|yellow|orange|gray)-(400|500|600)/ },
  ],
  theme: {
    extend: {
      chartStyle: CHART_STYLE,
      colors: {
        "base-50": "var(--base-50, oklch(0.985 0.002 247.84))",
        "trace-gold": "oklch(var(--trace-gold) / <alpha-value>)",
        "trace-gold-bg": "oklch(var(--trace-gold-bg) / <alpha-value>)",
        "trace-gold-border": "oklch(var(--trace-gold-border) / <alpha-value>)",
        "trace-blue": "oklch(var(--trace-blue) / <alpha-value>)",
        "trace-green": "oklch(var(--trace-green) / <alpha-value>)",
        "history-page": "var(--history-page-bg)",
        /* Raw design tokens from the GTWY paper design system */
        paper: "var(--paper)",
        card: "var(--card)",
        ink: "var(--ink)",
        soft: "var(--soft)",
        line: "var(--line)",
        acc: "var(--acc)",
        "acc-ink": "var(--accInk)",
        cool: "var(--cool)",
        stroke: "var(--stroke)",
        "stroke-strong": "var(--stroke-strong)",
      },
      fontFamily: {
        sans: ["var(--font-bricolage)", '"Bricolage Grotesque"', "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", '"JetBrains Mono"', "ui-monospace", "monospace"],
        display: ["var(--font-bricolage)", '"Bricolage Grotesque"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        hard: "4px 4px 0 var(--shd-col)",
        "hard-sm": "2px 2px 0 var(--shd-col)",
        "hard-lg": "6px 6px 0 var(--shd-col)",
      },
      zIndex: {
        "very-low": "0",
        low: "1",
        "low-medium": "50",
        medium: "999",
        high: "9999",
        "very-high": "999999",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "fade-in-scale": {
          "0%": { opacity: 0, transform: "scale(0.98)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        scaleIn: {
          "0%": { opacity: 0, transform: "scale(0.95)" },
          "100%": { opacity: 1, transform: "scale(1)" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-100%)", opacity: 0 },
          "100%": { transform: "translateX(0)", opacity: 1 },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: 0 },
          "100%": { transform: "translateX(0)", opacity: 1 },
        },
        slideInRightSmooth: {
          "0%": { transform: "translateX(30%)", opacity: 0 },
          "40%": { opacity: 1 },
          "100%": { transform: "translateX(0)", opacity: 1 },
        },
        scroll: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        slideIn: {
          from: { transform: "translateX(-100%)", opacity: 0 },
          to: { transform: "translateX(0)", opacity: 1 },
        },
        spin: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        rgTick: {
          "0%,49%": { opacity: 1 },
          "50%,100%": { opacity: 0 },
        },
        rgHalo: {
          "0%,100%": { transform: "scale(1)", opacity: 1 },
          "50%": { transform: "scale(1.9)", opacity: 0 },
        },
        rgMarquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-in-scale": "fade-in-scale 300ms ease-out",
        fadeIn: "fadeIn 300ms ease-out",
        scaleIn: "scaleIn 300ms ease-out",
        scroll: "scroll 20s linear infinite",
        slideIn: "slideIn 0.3s ease-out forwards",
        "rg-tick": "rgTick 1s steps(1) infinite",
        "rg-halo": "rgHalo 2.2s ease-out infinite",
        "rg-marquee": "rgMarquee 34s linear infinite",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "bg-zoom": "linear-gradient(to left, #002eae, #3c30b9, #942ed4)",
        "hero-bg": "radial-gradient(circle farthest-side at center top, hsl(276, 100%, 50%) 0%, hsl(0, 0%, 0%) 70%)",
        "hero-bg-center":
          "radial-gradient(circle farthest-corner at center, hsl(263, 100%, 70%) 0%, hsl(0, 0%, 0%) 100%)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    require("daisyui"),
    function ({ addBase, addUtilities }) {
      addBase({
        /* Custom themed tokens */
        ':root, [data-theme="light"]': {
          /* GTWY paper design system — raw values, used by hard shadows/strokes */
          "--paper": "#EFEAE0",
          "--card": "#FFFDF8",
          "--ink": "#14110D",
          "--soft": "#6A6357",
          "--line": "#D8D0C2",
          "--acc": "#F2540B",
          "--accInk": "#FFF6EE",
          "--cool": "#C9DCC4",
          /* Borders: the design's hard ink stroke. --stroke and --shd-col are
             the single knob for border/shadow weight across the whole app. */
          "--stroke": "#14110D",
          "--stroke-strong": "#14110D",
          "--shd-col": "#14110D",
          "--bd": "2px",
          "--shd": "4px 4px 0 #14110D",
          "--base-50": "#FFFDF8",
          "--trace-gold": "0.52 0.11 62",
          "--trace-gold-bg": "0.98 0.012 75",
          "--trace-gold-border": "0.93 0.025 75",
          "--trace-blue": "0.55 0.14 250",
          "--trace-green": "0.52 0.12 165",
          "--history-page-bg": "#EFEAE0",
          "--pill-bg": "#EFEAE0",
          "--pill-bg-hover": "#E4DDD0",
          "--ai-config-header-bg": "#EFEAE0",
          "--ai-config-container-bg": "#FFFDF8",
          "--ai-config-section-header": "#EFEAE0",
          "--ai-config-section-bg": "#FFFDF8",
          "--final-response-bg": "#FFF6EE",
        },
        '[data-theme="dark"]': {
          /* Inverted paper: ink canvas, cream strokes, same orange accent */
          "--paper": "#14110D",
          "--card": "#221D18",
          "--ink": "#EFEAE0",
          "--soft": "#9A9184",
          "--line": "#3A332A",
          "--acc": "#F2540B",
          "--accInk": "#1A1611",
          "--cool": "#2E3A2C",
          "--stroke": "#EFEAE0",
          "--stroke-strong": "#EFEAE0",
          "--shd-col": "#EFEAE0",
          "--bd": "2px",
          "--shd": "4px 4px 0 #EFEAE0",
          "--base-50": "#221D18",
          "--trace-gold": "0.72 0.13 70",
          "--trace-gold-bg": "0.26 0.025 70",
          "--trace-gold-border": "0.36 0.035 70",
          "--trace-blue": "0.70 0.12 250",
          "--trace-green": "0.68 0.11 155",
          "--history-page-bg": "#14110D",
          "--pill-bg": "#221D18",
          "--pill-bg-hover": "#2C261F",
          "--ai-config-header-bg": "#221D18",
          "--ai-config-container-bg": "#1A1611",
          "--ai-config-section-header": "#221D18",
          "--ai-config-section-bg": "#1A1611",
          "--final-response-bg": "#241C14",
        },
        /* Scrollbars are hidden everywhere — scrolling (wheel, trackpad, keys,
           programmatic scrollTo) is untouched, only the visible bar is gone. */
        "::-webkit-scrollbar": {
          width: "0px",
          height: "0px",
        },
        "::-webkit-scrollbar-track": {
          background: "transparent",
        },
        "::-webkit-scrollbar-thumb": {
          background: "transparent",
        },
        "html, body, *": {
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        },
      });

      addUtilities({
        ".info": {
          "font-weight": "500",
          color: "#6b7280",
          cursor: "help",
          "text-decoration": "underline",
          "text-decoration-style": "dotted",
          "text-underline-offset": "2px",
          "text-decoration-color": "#9ca3af",
          "&:hover": {
            "text-decoration-color": "#4b5563",
          },
        },
        ".promptSummary-info": {
          cursor: "help",
          "text-decoration": "underline",
          "text-decoration-style": "dotted",
          "text-underline-offset": "2px",
          "text-decoration-color": "#9ca3af",
          "&:hover": {
            "text-decoration-color": "#4b5563",
          },
        },
        ".bg-zoom": {
          background: "linear-gradient(to left, #002eae, #3c30b9, #942ed4)",
        },
        ".hero-bg": {
          "background-color": "hsl(0, 0%, 0%)",
          "background-image":
            "radial-gradient(circle farthest-side at center top, hsl(276, 100%, 50%) 0%, hsl(0, 0%, 0%) 70%)",
          "background-repeat": "no-repeat",
          "background-size": "cover",
          "background-position": "center top",
        },
        ".hero-bg-center": {
          "background-color": "hsl(0, 0%, 0%)",
          "background-image":
            "radial-gradient(circle farthest-corner at center, hsl(263, 100%, 70%) 0%, hsl(0, 0%, 0%) 100%)",
          "background-repeat": "no-repeat",
          "background-size": "cover",
          "background-position": "center",
        },
        ".animate-scroll": {
          animation: "scroll 20s linear infinite",
          "animation-fill-mode": "forwards",
          "white-space": "nowrap",
          display: "flex",
        },
        ".animate-slideIn": {
          animation: "slideIn 0.3s ease-out forwards",
        },
        ".line-clamp-5": {
          display: "-webkit-box",
          "-webkit-line-clamp": "5",
          "-webkit-box-orient": "vertical",
          overflow: "hidden",
          "text-overflow": "ellipsis",
        },
        ".hover-row:hover": {
          visibility: "visible",
        },
        ".show-on-hover:hover .see-on-hover": {
          opacity: "1 !important",
        },
        ".see-on-hover": {
          opacity: "0",
          transition: "opacity 200ms ease",
        },
      });
    },
  ],

  daisyui: {
    themes: [
      {
        light: buildTheme(defaultTheme.light, "light"),
      },
      {
        dark: buildTheme(defaultTheme.dark, "dark"),
      },
    ],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: true,
    themeRoot: ":root",
  },
};
