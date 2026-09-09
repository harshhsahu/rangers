"use client";

import { useEffect, useRef } from "react";
import { EMBED_TOOL_CREATED_EVENT } from "@/utils/toolEvents";

/**
 * Runs `handler({ functionId, scriptId, title, connected })` whenever a tool is
 * built in the ViaSocket embed and saved to the org.
 *
 * The handler is kept in a ref so a call site can pass an inline closure over
 * fresh state without the listener being torn down and re-added every render.
 */
const useEmbedToolCreated = (handler) => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const onCreated = (event) => handlerRef.current?.(event?.detail || {});
    window.addEventListener(EMBED_TOOL_CREATED_EVENT, onCreated);
    return () => window.removeEventListener(EMBED_TOOL_CREATED_EVENT, onCreated);
  }, []);
};

export default useEmbedToolCreated;
