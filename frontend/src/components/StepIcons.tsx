import { ReactNode } from 'react';
import { StepId } from '@/types/security';

/**
 * Line icons (24×24, stroke = currentColor) for each pipeline step
 */
const PATHS: Record<StepId, ReactNode> = {
  // Code received: download into tray
  received: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  // Temp file saved: code file
  saved: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="m10 13-2 2 2 2" />
      <path d="m14 13 2 2-2 2" />
    </>
  ),
  // Semgrep MCP: plug
  mcp: (
    <>
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M6 8h12v4a6 6 0 0 1-12 0z" />
      <path d="M12 18v4" />
    </>
  ),
  // Agent planning: robot
  agent: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 4v4" />
      <circle cx="12" cy="3" r="1" />
      <path d="M9 13v2" />
      <path d="M15 13v2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
    </>
  ),
  // Semgrep scan: magnifier
  scan: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  // Findings returned: clipboard list
  findings: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </>
  ),
  // AI review: sparkles
  review: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </>
  ),
  // Report ready: shield with check
  report: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

export default function StepIconGlyph({
  id,
  className = 'w-5 h-5',
  ...position
}: {
  id: StepId;
  className?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
}) {
  return (
    <svg
      {...position}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[id]}
    </svg>
  );
}
