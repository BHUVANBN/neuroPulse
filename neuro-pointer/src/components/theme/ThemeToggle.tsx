"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils/style";

export type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 top-4 z-50 flex items-center justify-end sm:right-6 sm:top-6",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggleTheme}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-panel/80 px-3 py-2 text-xs font-semibold text-primary shadow-lg transition hover:scale-[1.02] hover:bg-panel/90"
        aria-label="Toggle color theme"
      >
        {mounted && theme === "light" ? (
          <>
            <Sun className="size-4" /> Light
          </>
        ) : (
          <>
            <Moon className="size-4" /> Dark
          </>
        )}
      </button>
    </div>
  );
}
