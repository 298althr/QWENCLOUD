"use client";

import * as React from "react";
import { Command as CommandPrimitive, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem as CommandPrimitiveItem } from "cmdk";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "./dialog";
import { cn } from "@/lib/utils";

type CommandItem = {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  group?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
};

export function CommandPalette({ open, onOpenChange, items }: Props) {
  const groups = React.useMemo(() => {
    const map: Record<string, CommandItem[]> = {};
    for (const item of items) {
      const g = item.group || "Actions";
      if (!map[g]) map[g] = [];
      map[g].push(item);
    }
    return map;
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0">
        <CommandPrimitive className="rounded-lg">
          <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
            <Search className="h-4 w-4 text-ink-600" />
            <CommandInput
              placeholder="Search commands…"
              className="flex-1 bg-transparent text-sm text-ink-200 placeholder-ink-600 outline-none"
            />
          </div>
          <CommandList className="max-h-80 overflow-y-auto p-2">
            <CommandEmpty className="py-6 text-center text-sm text-ink-600">
              No results found.
            </CommandEmpty>
            {Object.entries(groups).map(([group, groupItems]) => (
              <CommandGroup key={group} heading={group} className="mb-2">
                {groupItems.map((item, i) => (
                  <CommandPrimitiveItem
                    key={i}
                    onSelect={() => {
                      item.onSelect();
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-300 aria-selected:bg-ink-800 aria-selected:text-gold-700"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </CommandPrimitiveItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
