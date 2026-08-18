import React from "react";

/**
 * Brand marks for the channel list.
 *
 * The repo ships no channel logos (icons/ only covers model providers), and the
 * generic lucide speech bubbles previously used here were indistinguishable
 * from each other at 16px. These are single-colour glyphs that take their fill
 * from `currentColor`, so each channel can be tinted with its brand colour.
 */

const base = { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true };

export const TelegramIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M21.94 4.3 18.66 19.9c-.24 1.09-.89 1.36-1.8.85l-4.98-3.67-2.4 2.31c-.27.27-.5.5-1.01.5l.36-5.07 9.24-8.35c.4-.36-.09-.56-.62-.2L6.03 13.09 1.1 11.55c-1.07-.34-1.09-1.07.22-1.58l19.28-7.43c.89-.32 1.67.21 1.34 1.76Z" />
  </svg>
);

export const DiscordIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M19.3 5.34A16.7 16.7 0 0 0 15.1 4l-.2.4a15.4 15.4 0 0 1 3.7 1.2 12.3 12.3 0 0 0-9.2 0A15.4 15.4 0 0 1 13.1 4.4L12.9 4a16.7 16.7 0 0 0-4.2 1.34C6.1 9.14 5.4 12.84 5.8 16.44a17 17 0 0 0 5.1 2.6l1-1.7a10.8 10.8 0 0 1-1.8-.9l.4-.3a12.1 12.1 0 0 0 10.4 0l.4.3a10.8 10.8 0 0 1-1.8.9l1 1.7a17 17 0 0 0 5.1-2.6c.5-4.2-.7-7.8-2.9-11.1ZM9.9 14.24c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2c0 1.1-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2c0 1.1-.8 2-1.8 2Z" />
  </svg>
);

export const WhatsappIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5s.8 2 .9 2.1c.1.1.1.3 0 .5s-.1.3-.3.5l-.4.4c-.1.1-.3.3-.1.6s.6 1.1 1.4 1.8c1 .9 1.8 1.1 2.1 1.3.3.1.4.1.6-.1s.7-.8.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.6.3.9.4 1 .6.1.2.1.8-.1 1.4Z" />
  </svg>
);

export const SlackIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6 15.1a2 2 0 1 1-2-2h2v2Zm1 0a2 2 0 0 1 4 0v5a2 2 0 0 1-4 0v-5ZM9 6.05a2 2 0 1 1 2-2v2H9Zm0 1a2 2 0 0 1 0 4H4a2 2 0 0 1 0-4h5Zm9 2.05a2 2 0 1 1 2 2h-2v-2Zm-1 0a2 2 0 0 1-4 0v-5a2 2 0 0 1 4 0v5Zm-2 9a2 2 0 1 1-2 2v-2h2Zm0-1a2 2 0 0 1 0-4h5a2 2 0 0 1 0 4h-5Z" />
  </svg>
);

export const SmsIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2ZM7 11H5V9h2v2Zm5 0h-2V9h2v2Zm5 0h-2V9h2v2Z" />
  </svg>
);

export const VoiceIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.2.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .7-.2 1l-2.3 2.2Z" />
  </svg>
);
