"use client";
import hotToast from "react-hot-toast";

/**
 * Thin compatibility layer over `react-hot-toast`.
 *
 * The app was previously built on `react-toastify`, so call sites use its API
 * (`toast.info`, `toast.warning`, `autoClose`, `toastId`, `toast.isActive`, and
 * `toast.promise` with `pending`/`render`). This module keeps those call sites
 * working while `react-hot-toast` does the rendering.
 */

// Tracks ids we created so `isActive` can answer without a React hook.
// An entry lives until it is dismissed or its duration has elapsed.
const activeIds = new Map();

const markActive = (id, duration) => {
  if (!id) return;
  const existing = activeIds.get(id);
  if (existing?.timer) clearTimeout(existing.timer);
  let timer = null;
  if (Number.isFinite(duration)) {
    timer = setTimeout(() => activeIds.delete(id), duration + 1000);
  }
  activeIds.set(id, { timer });
};

const clearActive = (id) => {
  if (id === undefined) {
    activeIds.forEach(({ timer }) => timer && clearTimeout(timer));
    activeIds.clear();
    return;
  }
  const existing = activeIds.get(id);
  if (existing?.timer) clearTimeout(existing.timer);
  activeIds.delete(id);
};

/**
 * Translates react-toastify options into react-hot-toast options.
 */
const mapOptions = (options = {}) => {
  const { autoClose, toastId, position, style, className, icon, id, duration, ...rest } = options;

  const mapped = {};
  if (toastId || id) mapped.id = toastId || id;
  if (autoClose === false) mapped.duration = Infinity;
  else if (typeof autoClose === "number") mapped.duration = autoClose;
  else if (typeof duration === "number") mapped.duration = duration;
  if (position) mapped.position = position === "bottom-left" ? "bottom-left" : position;
  if (style) mapped.style = style;
  if (className) mapped.className = className;
  if (icon !== undefined) mapped.icon = icon;

  // Drop react-toastify-only knobs (hideProgressBar, closeOnClick, draggable, …)
  // but keep anything react-hot-toast understands (ariaProps, iconTheme, …).
  const passthrough = ["ariaProps", "iconTheme", "removeDelay"];
  passthrough.forEach((key) => {
    if (rest[key] !== undefined) mapped[key] = rest[key];
  });

  return mapped;
};

const show = (kind, content, options) => {
  const mapped = mapOptions(options);
  let id;
  switch (kind) {
    case "success":
      id = hotToast.success(content, mapped);
      break;
    case "error":
      id = hotToast.error(content, mapped);
      break;
    case "loading":
      id = hotToast.loading(content, mapped);
      break;
    case "warning":
      id = hotToast(content, { icon: "⚠️", ...mapped });
      break;
    case "info":
      id = hotToast(content, { icon: "ℹ️", ...mapped });
      break;
    default:
      id = hotToast(content, mapped);
  }
  markActive(id, mapped.duration ?? 4000);
  return id;
};

/**
 * Resolves a react-toastify promise message, which may be a string, a
 * component, or an object with a `render(data)` function.
 */
const resolveMessage = (message, data, fallback) => {
  if (message === undefined || message === null) return fallback;
  if (typeof message === "function") return message(data);
  if (typeof message === "object" && typeof message.render === "function") {
    return message.render({ data });
  }
  if (typeof message === "object" && message.render !== undefined) return message.render;
  return message;
};

export const toast = Object.assign((content, options) => show("default", content, options), {
  success: (content, options) => show("success", content, options),
  error: (content, options) => show("error", content, options),
  info: (content, options) => show("info", content, options),
  warning: (content, options) => show("warning", content, options),
  warn: (content, options) => show("warning", content, options),
  loading: (content, options) => show("loading", content, options),
  custom: (content, options) => hotToast.custom(content, mapOptions(options)),

  dismiss: (id) => {
    clearActive(id);
    return hotToast.dismiss(id);
  },
  remove: (id) => {
    clearActive(id);
    return hotToast.remove(id);
  },
  isActive: (id) => activeIds.has(id),

  promise: (promise, messages = {}, options) =>
    hotToast.promise(
      promise,
      {
        loading: resolveMessage(messages.pending ?? messages.loading, undefined, "Loading…"),
        success: (data) => resolveMessage(messages.success, data, "Done"),
        error: (error) => resolveMessage(messages.error, error, "Something went wrong"),
      },
      mapOptions(options)
    ),
});

export default toast;
