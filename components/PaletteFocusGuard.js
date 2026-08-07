"use client";

import { useEffect } from "react";

export const isPaletteOpen = { current: false };

export default function PaletteFocusGuard() {
  useEffect(() => {
    const handleBlur = () => {
      setTimeout(() => {
        if (isPaletteOpen.current && document.activeElement?.tagName === "IFRAME") {
          document.activeElement.blur();
          document.getElementById("command-palette-search-input")?.focus();
        }
      }, 0);
    };

    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  return null;
}
