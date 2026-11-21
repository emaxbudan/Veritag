"use client";

import { useEffect, useRef, useState } from "react";

export interface SearchSuggestionItem {
  id: string;
  unitId: string;
  serialNumber?: string;
  brandDomain: string;
  customerEmail?: string;
  label: string;
}

export function normalizeSearchQuery(raw: string): string {
  return raw.replace(/[\r\n]+/g, "").trim();
}

export function hasBarcodeTerminator(raw: string): boolean {
  return /[\r\n]/.test(raw);
}

export function filterServiceSuggestions(
  items: ReadonlyArray<SearchSuggestionItem>,
  query: string,
): SearchSuggestionItem[] {
  const normalized = normalizeSearchQuery(query).toLowerCase();
  if (!normalized) return [];
  return items.filter((item) => {
    const fields = [
      item.unitId,
      item.serialNumber ?? "",
      item.brandDomain,
      item.customerEmail ?? "",
      item.label,
    ];
    return fields.some((field) => field.toLowerCase().includes(normalized));
  });
}

export function nextSuggestionIndex(
  currentIndex: number,
  key: "ArrowDown" | "ArrowUp",
  total: number,
): number {
  if (total <= 0) return -1;
  if (key === "ArrowDown") {
    return currentIndex < total - 1 ? currentIndex + 1 : 0;
  }
  return currentIndex > 0 ? currentIndex - 1 : total - 1;
}

export function createDebouncedCallback<T extends unknown[]>(
  fn: (...args: T) => void,
  delayMs = 300,
): { call: (...args: T) => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    call: (...args: T) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn(...args);
      }, delayMs);
    },
    cancel: () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}

export interface SerialSearchBarProps {
  suggestions?: ReadonlyArray<SearchSuggestionItem>;
  debounceMs?: number;
  isLoading?: boolean;
  placeholder?: string;
  onSearch: (query: string) => Promise<void> | void;
  onSelectSuggestion?: (suggestion: SearchSuggestionItem) => void;
}

export function SerialSearchBar({
  suggestions = [],
  debounceMs = 300,
  isLoading: externalLoading = false,
  placeholder = "Scan barcode or search serial number, brand, or customer email...",
  onSearch,
  onSelectSuggestion,
}: SerialSearchBarProps) {
  const [query, setQuery] = useState("");
  const [internalLoading, setInternalLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isLoading = externalLoading || internalLoading;
  const filteredSuggestions = filterServiceSuggestions(suggestions, query);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function executeSearch(rawValue: string) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const cleaned = normalizeSearchQuery(rawValue);
    setInternalLoading(true);
    try {
      await onSearch(cleaned);
    } finally {
      setInternalLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (hasBarcodeTerminator(raw)) {
      const cleaned = normalizeSearchQuery(raw);
      setQuery(cleaned);
      setIsOpen(false);
      setActiveIndex(-1);
      void executeSearch(cleaned);
      return;
    }

    setQuery(raw);
    setIsOpen(raw.trim().length > 0);
    setActiveIndex(-1);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void executeSearch(raw);
    }, debounceMs);
  }

  function handleSelect(item: SearchSuggestionItem) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const nextValue = item.serialNumber ?? item.unitId;
    setQuery(nextValue);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelectSuggestion?.(item);
    void executeSearch(nextValue);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => nextSuggestionIndex(prev, "ArrowDown", filteredSuggestions.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => nextSuggestionIndex(prev, "ArrowUp", filteredSuggestions.length));
      return;
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && filteredSuggestions[activeIndex]) {
        handleSelect(filteredSuggestions[activeIndex]);
      } else {
        setIsOpen(false);
        void executeSearch(query);
      }
    }
  }

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="search"
          role="combobox"
          aria-expanded={isOpen && filteredSuggestions.length > 0}
          aria-autocomplete="list"
          aria-controls="serial-search-suggestions"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim()) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
        />
        {isLoading && (
          <span
            role="status"
            aria-label="Searching"
            className="absolute right-3 inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"
          />
        )}
      </div>

      {isOpen && filteredSuggestions.length > 0 && (
        <ul
          id="serial-search-suggestions"
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {filteredSuggestions.map((item, idx) => {
            const isActive = idx === activeIndex;
            return (
              <li
                key={item.id}
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(item);
                }}
                className={`cursor-pointer px-4 py-2.5 text-sm ${
                  isActive ? "bg-blue-50 text-blue-900" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-xs text-slate-500">{item.brandDomain}</span>
                </div>
                <p className="truncate font-mono text-xs text-slate-400">{item.unitId}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
