"use client";

import React, { useEffect, useRef } from "react";
import { Toaster, useToasterStore } from "react-hot-toast";

/**
 * The app's toast host.
 *
 * Modals open with `dialog.showModal()`, which promotes the dialog to the
 * browser's **top layer** — and nothing in normal flow can paint over the top
 * layer, whatever its z-index. So the toaster joins the top layer too, as a
 * manual popover, and re-promotes itself whenever a new toast arrives: the top
 * layer stacks in promotion order, so a re-show puts the toasts above any modal
 * that opened since.
 *
 * Where `popover` is unsupported the element stays in normal flow and behaves
 * exactly as it did before — correct except when a modal is open.
 */
const AppToaster = () => {
  const hostRef = useRef(null);
  const { toasts } = useToasterStore();
  const visibleCount = toasts.filter((toast) => toast.visible).length;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof host.showPopover !== "function") return;

    const isShown = host.matches(":popover-open");
    // Re-promote only when a modal is actually open. Promotion is a
    // hide-then-show, which briefly takes the host out of the layout, so doing
    // it on every toast would flicker the ones already on screen.
    const needsRepromotion = isShown && Boolean(document.querySelector("dialog[open]"));

    try {
      if (needsRepromotion) host.hidePopover();
      if (!isShown || needsRepromotion) host.showPopover();
    } catch {
      /* popover unavailable in this context; the host stays in normal flow */
    }
  }, [visibleCount]);

  return (
    <div
      ref={hostRef}
      // eslint-disable-next-line react/no-unknown-property
      popover="manual"
      className="gtwy-toast-host"
    >
      <Toaster
        position="bottom-left"
        containerStyle={{ zIndex: 2147483647 }}
        toastOptions={{
          // Double react-hot-toast's own defaults (blank 4s, success 2s,
          // error 4s) — the stock timings read too fast for messages that
          // name a field or explain a failure.
          duration: 8000,
          success: { duration: 4000 },
          error: { duration: 8000 },
          // Theme variables, not fixed hex values, so a toast follows whichever
          // theme the document is on.
          style: {
            background: "var(--card)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
            zIndex: 2147483647,
          },
        }}
      />
    </div>
  );
};

export default AppToaster;
