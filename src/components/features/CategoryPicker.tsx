"use client";

import {
  Check,
  ChevronDown,
  HandHeart,
  Hammer,
  Laugh,
  Palette,
  PawPrint,
  Shapes,
  Smile,
  Users,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { CATEGORY_SCOPES } from "@/lib/categories";
import { type PostCategory } from "@/lib/models";
import styles from "./CategoryPicker.module.css";

const CATEGORY_ICONS = {
  "for-fun": Smile,
  memes: Laugh,
  "mutual-aid": HandHeart,
  build: Hammer,
  animals: PawPrint,
  art: Palette,
  crowdfunding: Users,
  other: Shapes,
} as const;

interface CategoryPickerProps {
  value: PostCategory;
  disabled?: boolean;
  onChange: (category: PostCategory) => void;
}

export function CategoryPicker({ value, disabled = false, onChange }: CategoryPickerProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const searchRef = useRef({ text: "", time: 0 });
  const [open, setOpen] = useState(false);
  const selectedIndex = CATEGORY_SCOPES.findIndex((category) => category.value === value);
  const selected = CATEGORY_SCOPES[selectedIndex];
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const Icon = CATEGORY_ICONS[value];

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const option = optionsRef.current[activeIndex];
    option?.focus({ preventScroll: true });
    option?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }, [open, activeIndex]);

  const showOptions = () => {
    searchRef.current = { text: "", time: 0 };
    setActiveIndex(selectedIndex);
    setOpen(true);
  };

  const choose = (category: PostCategory) => {
    onChange(category);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const handleOptionsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const lastIndex = CATEGORY_SCOPES.length - 1;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + CATEGORY_SCOPES.length) % CATEGORY_SCOPES.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : lastIndex);
    } else if (event.key.length === 1 && event.key !== " " && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      const now = event.timeStamp;
      const letter = event.key.toLocaleLowerCase();
      const previous = now - searchRef.current.time < 700 ? searchRef.current.text : "";
      const query = previous === letter ? letter : previous + letter;
      searchRef.current = { text: query, time: now };
      for (let offset = 1; offset <= CATEGORY_SCOPES.length; offset += 1) {
        const index = (activeIndex + offset) % CATEGORY_SCOPES.length;
        if (CATEGORY_SCOPES[index].label.toLocaleLowerCase().startsWith(query)) {
          setActiveIndex(index);
          break;
        }
      }
    }
  };

  return (
    <div
      ref={rootRef}
      className={styles.field}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span id={`${id}-label`} className={styles.label}>Category</span>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-options` : undefined}
        onClick={() => open ? setOpen(false) : showOptions()}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            showOptions();
          }
        }}
      >
        <Icon size={17} className={styles.currentIcon} aria-hidden="true" />
        <span id={`${id}-value`} className={styles.value}>{selected.label}</span>
        <ChevronDown size={16} className={styles.chevron} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.popover}>
          <p className={styles.heading}>Find your corner of the internet</p>
          <div
            id={`${id}-options`}
            className={styles.options}
            role="listbox"
            aria-labelledby={`${id}-label`}
            onKeyDown={handleOptionsKeyDown}
          >
            {CATEGORY_SCOPES.map((category, index) => {
              const OptionIcon = CATEGORY_ICONS[category.value];
              return (
                <button
                  key={category.value}
                  ref={(node) => { optionsRef.current[index] = node; }}
                  type="button"
                  role="option"
                  aria-selected={category.value === value}
                  aria-labelledby={`${id}-${category.value}-label`}
                  aria-describedby={`${id}-${category.value}-hint`}
                  className={styles.option}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => choose(category.value)}
                >
                  <span className={styles.optionIcon}><OptionIcon size={18} aria-hidden="true" /></span>
                  <span className={styles.optionText}>
                    <span id={`${id}-${category.value}-label`} className={styles.optionLabel}>{category.label}</span>
                    <span id={`${id}-${category.value}-hint`} className={styles.description}>{category.shortDescription}</span>
                  </span>
                  {category.value === value ? <Check size={16} className={styles.check} aria-hidden="true" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
