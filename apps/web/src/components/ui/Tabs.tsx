"use client";

import { KeyboardEvent, ReactNode, useId, useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * WAI-ARIA "tabs" pattern: roving tabindex (only the selected tab is in the
 * Tab order) with Left/Right/Home/End moving selection between tabs. Panels
 * stay mounted (hidden via the `hidden` attribute, not conditional
 * rendering) so a form's in-progress state inside one tab survives the user
 * looking at another.
 */
export function Tabs({ items, defaultTabId }: { items: TabItem[]; defaultTabId?: string }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? items[0]?.id);
  const baseId = useId();

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    const next = items[nextIndex];
    setActiveId(next.id);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  }

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {items.map((item, index) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              id={`${baseId}-tab-${item.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(item.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={
                selected
                  ? "border-b-2 border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-inset"
                  : "border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-inset"
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          id={`${baseId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== activeId}
          tabIndex={0}
          className="pt-4 focus:outline-none"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
