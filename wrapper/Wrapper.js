"use client";
import { persistor, store } from "@/store/store";
import React, { useEffect } from "react";
import { Provider } from "react-redux";
import AppToaster from "@/components/UI/AppToaster";
import { PersistGate } from "redux-persist/integration/react";
import CommandPalette from "@/components/command/CommandPalette";
import { usePathname } from "next/navigation";
import { getStoredTheme, useThemeManager } from "@/customHooks/useThemeManager";
import PostHogProvider from "@/components/PostHogProvider";

/**
 * The Wrapper component is the top level component of our application
 * It provides the Redux store to all the child components
 * It also has a Toaster for the react-hot-toast notifications
 */
const Wrapper = ({ children }) => {
  const pathname = usePathname();
  // Applies the persisted theme to the document; the toaster reads its colors
  // from the theme variables it sets, so no light/dark branching is needed here.
  useThemeManager();

  /**
   * The landing page is always light — it is drawn for one palette, and a
   * visitor who chose dark inside the app should not meet it inverted. The
   * inline script in the root layout covers a cold load; this covers client
   * navigation, which never re-runs that script. The stored preference is only
   * read here, never written, so leaving the page restores their choice.
   */
  useEffect(() => {
    const root = document.documentElement;
    const stored = getStoredTheme();
    const resolved =
      stored === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : stored;
    const applied = pathname === "/" ? "light" : resolved;
    root.setAttribute("data-theme", applied);
    root.classList.remove("light", "dark");
    root.classList.add(applied);
  }, [pathname]);

  useEffect(() => {
    const pathSegments = pathname.split("/").filter(Boolean);
    let title = "Rangers";
    if (pathSegments.length > 0) {
      const lastSegment = pathSegments[pathSegments.length - 1];
      // Check if last segment is a number (like an ID), if so, use the second to last segment
      const segmentToUse = isNaN(lastSegment) ? lastSegment : pathSegments[pathSegments.length - 2] || lastSegment;
      const pageName = segmentToUse.replace(/[_-]/g, " ");
      const capitalizedPageName = pageName
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      title = `Rangers | ${capitalizedPageName}`;
    }
    document.title = title;
  }, [pathname]);

  // Return a Provider component that wraps all the child components
  // with the Redux store
  // It also has a div that wraps all the child components
  // And adds a Toaster for the notifications
  return (
    <>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <PostHogProvider>
            <div className="w-screen">
              {/* All the child components */}
              {children}
              {/* Global Command Palette */}
              <CommandPalette />
              {/* Notification toast container */}
              <AppToaster />
            </div>
          </PostHogProvider>
        </PersistGate>
      </Provider>
    </>
  );
};

export default Wrapper;
