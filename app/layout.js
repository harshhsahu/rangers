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
  title: "GTWY AI | Connect 5000+ apps in just 1 click",
  description: "Simplified AI & chatbot integration",
  category: "technology",
  generator: "GTWY AI",
  keywords:
    "gtwy ai, ai middleware, ai integration platform, ai chatbot service, openai integration, anthropic api, groq ai, o1 ai, ai automation tools, ai api gateway, large language model integration, llm api, ai software solutions, ai-powered chatbot, ai model deployment, machine learning api, enterprise ai solutions, ai infrastructure, artificial intelligence services, custom ai development, ai orchestration, ai cloud services, multi-ai platform, ai business solutions, ai developer tools, ai framework, gpt integration, ai tools for business, llm deployment, ai model hosting, ai tech stack, ai-powered applications, smart ai assistant, best ai middleware, chatbot development platform, ai-powered automation",
  alternates: {
    canonical: "https://gtwy.ai",
  },
};

export const runtime = "edge";

// Applies a saved theme before first paint, so a dark preference does not flash
// light on load. The server renders the light theme, which is the default.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme")||sessionStorage.getItem("theme")||"light";var r=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var e=document.documentElement;e.setAttribute("data-theme",r);e.classList.remove("light","dark");e.classList.add(r);}catch(_){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" className={`${bricolage.variable} ${jetbrainsMono.variable}`}>
      <GoogleTagManager gtmId="GTM-PXRN8T45" />
      <script src={`https://main.d2f49esifpcbwh.amplifyapp.com/tracker.js`} async />
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      <body suppressHydrationWarning className="font-sans">
        <PaletteFocusGuard />
        <Wrapper>{children}</Wrapper>
        <NetworkStatus />
      </body>
    </html>
  );
}
