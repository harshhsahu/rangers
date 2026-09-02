# Landing page media

`telegram-ranger.mp4` — the phone recording shown in the hero (components/landing/TelegramPhone.jsx).

- Portrait, 9:16. 720x1280 is plenty; keep it under ~3 MB so the hero stays fast.
- It autoplays muted and loops, so record a short clean loop (8-15s) with no audio cues.
- `telegram-ranger.jpg` (optional) is the poster frame shown before the video decodes.

Until the file exists the component renders a static chat mock instead, so the hero never breaks.
