"use client";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useApp } from "@/store/AppProvider";

/**
 * Bottom sheet built on the native <dialog>: focus trap, Esc to close, backdrop click.
 * The <dialog> is only in the page while the sheet is open, so a closed sheet adds nothing to the DOM, the focus order
 * or the accessibility tree (the app mounts about a dozen of them).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const { t } = useApp();
  useEffect(() => {
    if (!open) return;
    // remember what had focus (the button that opened the sheet); `??=` keeps the first one if React re-runs this
    opener.current ??= document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, [open]);
  useEffect(() => {
    if (open) return;
    // a native close() would return focus by itself; removing the element does not, so do it here
    opener.current?.focus();
    opener.current = null;
  }, [open]);
  if (!open) return null;
  const id = labelledBy ?? `sheet-${title.replace(/\W+/g, "-").slice(0, 24)}`;
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="s-dark fixed inset-x-0 bottom-0 m-0 mx-auto w-full max-w-md rounded-t-3xl border border-[#444] bg-[#242424] p-0 text-fg shadow-modal sm:inset-y-0 sm:my-auto sm:h-fit sm:rounded-3xl"
    >
      <div className="sheet-anim flex max-h-[88dvh] flex-col">
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h2 id={id} className="font-display text-xl font-bold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-11 place-items-center rounded-full text-muted hover:bg-white/10 hover:text-fg"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </dialog>
  );
}
