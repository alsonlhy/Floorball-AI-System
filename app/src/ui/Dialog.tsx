import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

/** Small modal with large touch targets. Escape cancels; Enter confirms. */
export function Dialog({ title, children, confirmLabel, danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('input, button.confirm');
    first?.focus();
    if (first instanceof HTMLInputElement) first.select();
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onPointerDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="dialog"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
          else if (e.key === 'Enter') onConfirm();
        }}
      >
        <h2>{title}</h2>
        {children}
        <div className="dialog-actions">
          <button data-testid="dialog-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            data-testid="dialog-confirm"
            className={`confirm ${danger ? 'danger solid' : 'primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Dialog with a single text field (rename). */
export function PromptDialog(props: {
  title: string;
  initial: string;
  confirmLabel: string;
  onConfirm(value: string): void;
  onCancel(): void;
}) {
  const [value, setValue] = useState(props.initial);
  return (
    <Dialog
      title={props.title}
      confirmLabel={props.confirmLabel}
      onConfirm={() => value.trim() && props.onConfirm(value.trim())}
      onCancel={props.onCancel}
    >
      <input
        data-testid="dialog-input"
        aria-label={props.title}
        value={value}
        maxLength={120}
        onChange={(e) => setValue(e.target.value)}
      />
    </Dialog>
  );
}
