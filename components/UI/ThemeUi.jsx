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
        className="mx-auto grid h-[34px] w-[34px] place-items-center rounded-[10px] border border-line bg-card text-ink transition-colors hover:bg-paper"
      >
        <ActiveIcon size={16} />
      </button>
    );
  }

  return (
    <div
      data-testid="theme-toggle"
      id="theme-toggle"
      role="radiogroup"
      aria-label="Colour theme"
      className="flex w-full items-center rounded-[9px] border border-line bg-paper-sunken p-[3px] text-[11px]"
    >
      {MODES.map(({ id, label }) => {
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
            className={`flex-1 rounded-[7px] py-[5px] text-center transition-colors ${
              isActive
                ? "bg-card font-semibold text-ink shadow-[0_1px_1px_rgba(20,17,13,.08)]"
                : "text-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
