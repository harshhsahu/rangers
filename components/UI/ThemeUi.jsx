import { MoonIcon, SunIcon, MonitorIcon } from "lucide-react";
import { useThemeManager } from "@/customHooks/useThemeManager";

const MODES = [
  { id: "light", label: "Light", Icon: SunIcon },
  { id: "dark", label: "Dark", Icon: MoonIcon },
  { id: "system", label: "System", Icon: MonitorIcon },
];

/**
 * Segmented theme switcher — one click per mode, no dropdown.
 * `compact` renders a single cycling icon for the collapsed sidebar rail.
 */
export default function ThemeToggle({ compact = false }) {
  const { theme, changeTheme, getThemeLabel } = useThemeManager();

  const activeIndex = Math.max(
    0,
    MODES.findIndex((m) => m.id === theme)
  );
  const ActiveIcon = MODES[activeIndex].Icon;

  if (compact) {
    return (
      <button
        data-testid="theme-toggle-button"
        id="theme-toggle-button"
        title={getThemeLabel()}
        aria-label={getThemeLabel()}
        onClick={() => changeTheme(MODES[(activeIndex + 1) % MODES.length].id)}
        className="w-full flex items-center justify-center rounded-[9px] border-2 border-stroke bg-card p-[7px] text-ink transition-colors hover:bg-paper"
      >
        <ActiveIcon size={15} />
      </button>
    );
  }

  return (
    <div
      data-testid="theme-toggle"
      id="theme-toggle"
      role="radiogroup"
      aria-label="Colour theme"
      className="flex w-full items-center gap-1 rounded-full border-2 border-stroke bg-card p-[3px]"
    >
      {MODES.map(({ id, label, Icon }) => {
        const isActive = id === theme;
        return (
          <button
            key={id}
            data-testid={`theme-${id}-button`}
            id={`theme-${id}-button`}
            role="radio"
            aria-checked={isActive}
            title={label}
            onClick={() => changeTheme(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-[5px] font-mono text-[10px] uppercase tracking-[.08em] transition-colors ${
              isActive ? "bg-acc text-acc-ink font-bold" : "text-soft hover:text-ink"
            }`}
          >
            <Icon size={13} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
