interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared confirm modal — used anywhere a destructive action (Delete) needs a deliberate second step. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onCancel}>
      <div
        className="fp-card w-full max-w-sm p-6"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
      >
        <h3 className="fp-serif text-lg text-[#171717]">{title}</h3>
        <p className="mt-2 text-[13px] text-[#66565D]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#D8D1D4] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#171717] transition hover:border-[#7C243E]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition ${
              danger ? "bg-[#B3352D] hover:bg-[#8f2a24]" : "bg-[#111111] hover:bg-[#7C243E]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
