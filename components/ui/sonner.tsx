"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Sonner detects the theme from the `class` attribute on <html>.
 * With next-themes attribute="class", setting theme adds "dark" or "light"
 * to <html>, so we don't need to pass theme explicitly.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[var(--popover)] group-[.toaster]:text-[var(--popover-foreground)] group-[.toaster]:border-[var(--border)] group-[.toaster]:shadow-xl group-[.toaster]:rounded-lg",
          description:
            "group-[.toast]:text-[var(--muted-foreground)]",
          actionButton:
            "group-[.toast]:bg-[var(--primary)] group-[.toast]:text-[var(--primary-foreground)]",
          cancelButton:
            "group-[.toast]:bg-[var(--muted)] group-[.toast]:text-[var(--muted-foreground)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
