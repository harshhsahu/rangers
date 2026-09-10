import "./globals.css";
import "../styles/performance-optimizations.css";
import Wrapper from "@/wrapper/Wrapper";
import { GoogleTagManager } from "@next/third-parties/google";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import NetworkStatus from "@/components/NetworkStatus";
import PaletteFocusGuard from "@/components/PaletteFocusGuard";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata = {
  title: "Rangers | Connect 5000+ apps in just 1 click",
  description: "Simplified AI & chatbot integration",
  category: "technology",
  generator: "Rangers",
  keywords:
    "gtwy ai, ai middleware, ai integration platform, ai chatbot service, openai integration, anthropic api, groq ai, o1 ai, ai automation tools, ai api gateway, large language model integration, llm api, ai software solutions, ai-powered chatbot, ai model deployment, machine learning api, enterprise ai solutions, ai infrastructure, artificial intelligence services, custom ai development, ai orchestration, ai cloud services, multi-ai platform, ai business solutions, ai developer tools, ai framework, gpt integration, ai tools for business, llm deployment, ai model hosting, ai tech stack, ai-powered applications, smart ai assistant, best ai middleware, chatbot development platform, ai-powered automation",
  alternates: {
    canonical: "https://gtwy.ai",
  },
  // Declared here rather than through Next's icon file convention in the app
  // directory. That convention makes Next inject its IconMark client component,
  // which is missing from the edge RSC client manifest produced by the edge
  // runtime set below, and every page then fails with a 500 in a production
  // build. Serving the images from the public folder and listing them here
  // renders the same link tags without that component.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const runtime = "edge";

// Applies a saved theme before first paint, so a dark preference does not flash
// light on load. The server renders the light theme, which is the default.
// The landing page is the one exception: it is always light, whatever the
// visitor picked inside the app, so the marketing design is never rendered in
// a palette it was not drawn for. The preference itself is left untouched.
const THEME_INIT = `(function(){try{var t=location.pathname==="/"?"light":(localStorage.getItem("theme")||sessionStorage.getItem("theme")||"light");var r=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var e=document.documentElement;e.setAttribute("data-theme",r);e.classList.remove("light","dark");e.classList.add(r);}catch(_){}})();`;

// Scripts go in the head element, not directly under the root element: React cannot
// order a synchronous script placed there and warns that the document is invalid. The
// theme initialiser must stay inline and synchronous so it runs before first paint.
//
// The root element suppresses hydration warnings for the same reason the body already
// does. The theme initialiser changes it before React hydrates, on purpose, because the
// server has no way to know which theme the visitor chose.
export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${bricolage.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <GoogleTagManager gtmId="GTM-PXRN8T45" />
        <script src={`https://main.d2f49esifpcbwh.amplifyapp.com/tracker.js`} async />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body suppressHydrationWarning className="font-sans">
        <PaletteFocusGuard />
        <Wrapper>{children}</Wrapper>
        <NetworkStatus />
      </body>
    </html>
  );
}
