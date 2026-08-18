"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/**
 * Paper-theme select: a button trigger plus a listbox panel built from the same
 * hard-stroke tokens as the rest of the wizard (2px border-stroke, accent on
 * open/selected). Replaces the native <select>, whose popup is drawn by the OS
 * and ignores the theme entirely.
 *
 * The panel is rendered inline instead of absolutely positioned — an overlay
 * gets clipped by the modal's scroll container (same reason ModelStep keeps its
 * model list inline).
 */
const ThemedSelect = ({
  id,
  value = "",
  onChange,
  options = [],
  placeholder = "Select...",
  disabled = false,
  className = "",
  testId = "themed-select",
  size = "sm",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const selectedIndex = useMemo(
    () => options.findIndex((option) => String(option.value) === String(value)),
    [options, value]
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  // Outside click / escape close.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) close();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
    };
  }, [isOpen, close]);

  // Keep the highlighted row in view while arrowing through the list.
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const node = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [isOpen, activeIndex]);

  const handleSelect = (option) => {
    if (option?.disabled) return;
    onChange?.(option.value, option);
    close();
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (!isOpen) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % options.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + options.length) % options.length);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (activeIndex >= 0) handleSelect(options[activeIndex]);
        break;
      case "Tab":
        close();
        break;
      default:
        break;
    }
  };

  const isCompact = size === "sm";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={disabled}
        disabled={disabled}
        data-testid={`${testId}-trigger`}
        onClick={() => {
          if (disabled) return;
          setIsOpen((open) => !open);
          setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        }}
        onKeyDown={handleKeyDown}
        className={`flex w-full items-center gap-2 rounded-[12px] border-2 bg-base-100 text-left transition-colors ${
          isCompact ? "px-3 py-2 text-[12.5px]" : "px-3 py-2.5 text-[13px]"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${
          isOpen ? "border-acc" : "border-stroke hover:border-soft"
        }`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "capitalize text-base-content" : "text-soft"}`}>
          {selected ? selected.label ?? selected.value : placeholder}
        </span>
        <ChevronDown size={15} className={`flex-none text-soft transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="mt-2 overflow-hidden rounded-[12px] border-2 border-stroke bg-base-100 shadow-hard-sm">
          <div
            ref={listRef}
            role="listbox"
            aria-labelledby={id}
            data-testid={`${testId}-list`}
            className="max-h-[240px] overflow-y-auto p-1.5"
          >
            {options.length === 0 && <p className="px-2 py-5 text-center text-[12px] text-soft">No options</p>}

            {options.map((option, index) => {
              const isActive = String(option.value) === String(value);
              const isHighlighted = index === activeIndex;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  data-index={index}
                  data-testid={`${testId}-option-${option.value || "none"}`}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(option)}
                  className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-[7px] text-left text-[12.5px] capitalize transition-colors ${
                    option.disabled ? "cursor-not-allowed opacity-50" : ""
                  } ${isActive ? "bg-acc/15 ring-1 ring-inset ring-acc" : isHighlighted ? "bg-base-200" : ""}`}
                >
                  <span className="min-w-0 flex-1 truncate text-base-content">{option.label ?? option.value}</span>
                  {isActive && <Check size={14} className="flex-none text-acc" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThemedSelect;
