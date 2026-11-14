import { useEffect, useRef } from 'react';
import { addDrawingHere } from '../tools/pin';
import { useToolStore } from '../store/toolStore';
import { commitText } from '../tools/text';
import type { Vec } from '../model/types';

/** Input shown where the text tool was tapped. Enter or tapping away commits; Escape cancels. */
export function TextEntry({ at }: { at: Vec }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const ts = useToolStore.getState();
    if (save && ts.textAt && ref.current) {
      commitText(addDrawingHere, ts.textAt, ref.current.value, ts.color, ts.width);
    }
    ts.setTextAt(null);
  };

  return (
    <input
      ref={ref}
      className="text-entry"
      data-testid="text-entry"
      aria-label="Text on board"
      maxLength={60}
      style={{ left: at.x, top: at.y }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        else if (e.key === 'Escape') finish(false);
        e.stopPropagation();
      }}
      onBlur={() => finish(true)}
    />
  );
}
