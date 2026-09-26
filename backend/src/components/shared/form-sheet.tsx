"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Right-hand drawer used for create/edit forms. */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={wide ? "sm:max-w-2xl" : "sm:max-w-xl"} onInteractOutside={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        {/* Forms render SheetBody + SheetFooter themselves so the footer stays pinned. */}
        {open && children}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Opens a create drawer when the URL contains ?new=1 (used by the global "New" menu and
 * the command palette), and strips the flag again when the drawer closes.
 */
export function useCreateParam(setOpen: (open: boolean) => void) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const flag = params.get("new") === "1";
  useEffect(() => {
    if (!flag) return;
    setOpen(true);
    const next = new URLSearchParams(params.toString());
    next.delete("new");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [flag, params, pathname, router, setOpen]);
}
