// Small line icons for the rails. 24x24 viewBox, currentColor.
import type { ToolId } from '../store/toolStore';

const P = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const paths: Record<ToolId | 'undo' | 'redo', React.ReactNode> = {
  select: <path {...P} d="M5 3l14 8-6 1.5L10 19z" />,
  pen: <path {...P} d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3" />,
  line: <path {...P} d="M5 19L19 5" />,
  arrow: (
    <>
      <path {...P} d="M5 19L18 6" />
      <path {...P} d="M10 6h8v8" />
    </>
  ),
  zone: <rect {...P} x="4" y="6" width="16" height="12" rx="2" strokeDasharray="3 2" />,
  text: <path {...P} d="M5 6V4h14v2M12 4v16M9 20h6" />,
  eraser: <path {...P} d="M9 19h10M5 15l8-8 5 5-6 6H8z" />,
  undo: <path {...P} d="M9 7L4 12l5 5M4 12h10a6 6 0 010 12" transform="translate(0 -3)" />,
  redo: <path {...P} d="M15 7l5 5-5 5M20 12H10a6 6 0 000 12" transform="translate(0 -3)" />,
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="icon">
      {paths[name]}
    </svg>
  );
}
