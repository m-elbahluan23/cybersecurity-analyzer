import { AnalysisProgressProps, StepId, StepStatus, StepStatuses } from '@/types/security';
import StepIconGlyph from './StepIcons';

/**
 * Pipeline steps, in order. Matches the architecture diagram (docs/flow.svg).
 */
export const ANALYSIS_STEPS: { id: StepId; label: string; detail: string }[] = [
  { id: 'received', label: 'Code received', detail: 'POST /api/analyze/stream' },
  { id: 'saved', label: 'Temp file saved', detail: 'Code written to a .py file' },
  { id: 'mcp', label: 'Semgrep MCP', detail: 'Starting the MCP server' },
  { id: 'agent', label: 'Agent planning', detail: 'Security Researcher (gpt-4.1-mini)' },
  { id: 'scan', label: 'Semgrep scan', detail: 'semgrep_scan, config: auto' },
  { id: 'findings', label: 'Findings returned', detail: 'Semgrep results to the agent' },
  { id: 'review', label: 'AI review', detail: 'OpenAI finds what Semgrep missed' },
  { id: 'report', label: 'Report ready', detail: 'Issues sorted by CVSS' },
];

export const INITIAL_STEPS = Object.fromEntries(
  ANALYSIS_STEPS.map((s) => [s.id, 'pending'])
) as Record<StepId, StepStatus>;

const isFinished = (status: StepStatus) => status === 'done' || status === 'skipped';

/* ------------------------------------------------------------------ theme (dark canvas) */

const C = {
  canvas: '#18181b',
  node: '#27272a',
  idle: '#52525b',
  text: '#e4e4e7',
  sub: '#a1a1aa',
  active: '#60a5fa',
  done: '#4ade80',
  error: '#f87171',
};

const STROKE: Record<StepStatus, string> = {
  pending: C.idle,
  active: C.active,
  done: C.done,
  skipped: C.idle,
  error: C.error,
};

type EdgeState = 'idle' | 'flowing' | 'done' | 'error';

/** Connection state between a source node and a target node */
function edgeState(from: StepStatus, to: StepStatus): EdgeState {
  if (to === 'error') return 'error';
  if (isFinished(from) && isFinished(to)) return 'done';
  if (isFinished(from) && to === 'active') return 'flowing';
  return 'idle';
}

/** Sub-connection (agent → model / tool) is "flowing" while the sub-node works */
function subEdgeState(to: StepStatus): EdgeState {
  if (to === 'error') return 'error';
  if (to === 'active') return 'flowing';
  if (to === 'done') return 'done';
  return 'idle';
}

/* ------------------------------------------------------------------ node statuses from steps */

function nodeStatuses(steps: StepStatuses) {
  const any = (ids: StepId[], s: StepStatus) => ids.some((id) => steps[id] === s);

  const agent: StepStatus = any(['mcp', 'agent', 'review'], 'error')
    ? 'error'
    : steps.review === 'done'
      ? 'done'
      : any(['mcp', 'agent', 'scan', 'findings', 'review'], 'active')
        ? 'active'
        : 'pending';

  const semgrep: StepStatus = any(['mcp', 'scan'], 'error')
    ? 'error'
    : steps.scan === 'skipped'
      ? 'skipped'
      : steps.findings === 'done'
        ? 'done'
        : any(['mcp', 'scan'], 'active')
          ? 'active'
          : 'pending';

  const model: StepStatus = steps.review === 'error'
    ? 'error'
    : steps.review === 'done'
      ? 'done'
      : any(['agent', 'review'], 'active')
        ? 'active'
        : 'pending';

  return {
    upload: steps.received,
    file: steps.saved,
    agent,
    semgrep,
    model,
    report: steps.report,
  };
}

/* ------------------------------------------------------------------ SVG building blocks */

function Badge({ cx, cy, status }: { cx: number; cy: number; status: StepStatus }) {
  const marks: Partial<Record<StepStatus, string>> = { done: '✓', error: '✕', skipped: '–' };
  const mark = marks[status];
  if (!mark) return null;
  const fill = status === 'done' ? '#16a34a' : status === 'error' ? '#dc2626' : C.idle;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={fill} stroke={C.canvas} strokeWidth={2.5} />
      <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff">{mark}</text>
    </g>
  );
}

/** Node outline: animated dashed border while running */
function outlineProps(status: StepStatus) {
  return {
    stroke: STROKE[status],
    strokeWidth: status === 'pending' ? 1.5 : 2,
    strokeDasharray: status === 'active' ? '8 6' : status === 'skipped' ? '4 4' : undefined,
    className: status === 'active' ? 'flow-dash' : undefined,
  };
}

function SquareNode({ x, y, size = 76, icon, color, status, label, sub, trigger = false }: {
  x: number; y: number; size?: number; icon: StepId; color: string; status: StepStatus;
  label: string; sub: string; trigger?: boolean;
}) {
  const dim = status === 'pending' || status === 'skipped';
  return (
    <g>
      {trigger && (
        <path
          d={`M${x - 16},${y + size / 2 - 11} l-7,12 h6 l-3,10 l10,-14 h-6 l4,-8 z`}
          fill="#f97316"
          opacity={dim ? 0.5 : 1}
        />
      )}
      <rect
        x={x} y={y} width={size} height={size}
        rx={trigger ? size / 2.6 : 14}
        fill={C.node}
        {...outlineProps(status)}
      />
      <g opacity={dim ? 0.45 : 1} style={{ color }}>
        <StepIconGlyph id={icon} x={x + size / 2 - 15} y={y + size / 2 - 15} width={30} height={30} className="" />
      </g>
      <Badge cx={x + size} cy={y} status={status} />
      <text x={x + size / 2} y={y + size + 20} textAnchor="middle" fontSize={13} fontWeight={600} fill={C.text}>{label}</text>
      <text x={x + size / 2} y={y + size + 36} textAnchor="middle" fontSize={11} fill={C.sub}>{sub}</text>
    </g>
  );
}

function CircleNode({ cx, cy, r = 30, icon, color, status, label, sub }: {
  cx: number; cy: number; r?: number; icon: StepId; color: string; status: StepStatus;
  label: string; sub: string;
}) {
  const dim = status === 'pending' || status === 'skipped';
  return (
    <g>
      <rect x={cx - 4} y={cy - r - 4} width={8} height={8} fill={C.sub} transform={`rotate(45 ${cx} ${cy - r})`} />
      <circle cx={cx} cy={cy} r={r} fill={C.node} {...outlineProps(status)} />
      <g opacity={dim ? 0.45 : 1} style={{ color }}>
        <StepIconGlyph id={icon} x={cx - 13} y={cy - 13} width={26} height={26} className="" />
      </g>
      <Badge cx={cx + r * 0.72} cy={cy - r * 0.72} status={status} />
      <text x={cx} y={cy + r + 18} textAnchor="middle" fontSize={12} fontWeight={600} fill={C.text}>{label}</text>
      <text x={cx} y={cy + r + 33} textAnchor="middle" fontSize={10.5} fill={C.sub}>{sub}</text>
    </g>
  );
}

const EDGE_COLOR: Record<EdgeState, string> = {
  idle: C.idle,
  flowing: C.active,
  done: C.done,
  error: C.error,
};

/** Main connection: output dot → line → input arrow. Dashes move while flowing. */
function MainEdge({ x1, x2, y, state }: { x1: number; x2: number; y: number; state: EdgeState }) {
  const color = EDGE_COLOR[state];
  const moving = state === 'flowing';
  return (
    <g>
      <line
        x1={x1 + 5} y1={y} x2={x2 - 9} y2={y}
        stroke={color} strokeWidth={2}
        strokeDasharray={moving || state === 'error' ? '7 5' : undefined}
        className={moving ? 'flow-dash' : undefined}
      />
      <polygon points={`${x2 - 10},${y - 5} ${x2 - 1},${y} ${x2 - 10},${y + 5}`} fill={color} />
      <circle cx={x1} cy={y} r={5} fill={state === 'idle' ? C.sub : color} stroke={C.canvas} strokeWidth={2} />
    </g>
  );
}

/** Sub connection (dashed curve) from an agent port down to a model / tool node */
function SubEdge({ from, to, state }: { from: [number, number]; to: [number, number]; state: EdgeState }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const my = (y1 + y2) / 2;
  return (
    <path
      d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
      fill="none"
      stroke={EDGE_COLOR[state]}
      strokeWidth={1.75}
      strokeDasharray="6 5"
      className={state === 'flowing' ? 'flow-dash' : undefined}
    />
  );
}

/* ------------------------------------------------------------------ progress ring (dark) */

const SIZE = 132;
const RING = 9;
const RADIUS = (SIZE - RING) / 2 - 8;
const SPINNER_RADIUS = SIZE / 2 - 3;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressRing({ percent, title, subtitle, state }: {
  percent: number; title: string; subtitle: string; state: 'running' | 'done' | 'error';
}) {
  const color = state === 'error' ? C.error : state === 'done' ? C.done : '#22c55e';
  return (
    <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
      {state === 'running' && (
        <svg className="absolute inset-0 animate-spin" style={{ animationDuration: '1.4s' }} width={SIZE} height={SIZE}>
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={SPINNER_RADIUS}
            fill="none" stroke={C.active} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * SPINNER_RADIUS * 0.2} ${2 * Math.PI * SPINNER_RADIUS}`}
          />
        </svg>
      )}
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#3f3f46" strokeWidth={RING} />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
          fill="none" stroke={color} strokeWidth={RING} strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        <span className="text-2xl font-bold font-mono text-zinc-100">{percent}%</span>
        <span className="text-[11px] font-semibold text-zinc-300 leading-tight mt-1">{title}</span>
        <span className="text-[10px] text-zinc-500 leading-tight">{subtitle}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ main */

/**
 * Live progress of the analysis pipeline, drawn as a node graph:
 * Upload → Temp file → AI Agent → Report, with the agent's Chat Model (OpenAI)
 * and Tool (Semgrep MCP) attached below by dashed connectors.
 */
export default function AnalysisProgress({ steps }: AnalysisProgressProps) {
  const completed = ANALYSIS_STEPS.filter((s) => isFinished(steps[s.id])).length;
  const percent = Math.round((completed / ANALYSIS_STEPS.length) * 100);

  const failed = ANALYSIS_STEPS.find((s) => steps[s.id] === 'error');
  const active = ANALYSIS_STEPS.find((s) => steps[s.id] === 'active');
  const state = failed ? 'error' : percent === 100 ? 'done' : 'running';
  const current = failed ?? active ?? ANALYSIS_STEPS.find((s) => steps[s.id] === 'pending');
  const title = state === 'done' ? 'Complete' : state === 'error' ? 'Failed' : current?.label ?? 'Starting';
  const subtitle = state === 'running' ? `Step ${Math.min(completed + 1, 8)} of ${ANALYSIS_STEPS.length}` : '';
  const statusLine =
    state === 'done' ? 'Report ready' : failed ? `${failed.label} failed` : current ? `${current.label} · ${current.detail}` : '';

  const n = nodeStatuses(steps);

  // Layout (SVG user units)
  const Y = 40; // top of main row
  const S = 76; // square node size
  const MID = Y + S / 2;
  const AGENT = { x: 370, w: 240 };
  const PORT_Y = Y + S;
  const PORTS = { model: 430, tool: 550 };
  const MODEL: [number, number] = [400, 222];
  const TOOL: [number, number] = [600, 222];
  const R = 30;

  return (
    <div className="panel p-5 flex-shrink-0">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h2 className="text-base font-semibold text-foreground">Analysis pipeline</h2>
        <p className="text-[11px] text-zinc-400 font-mono truncate">{statusLine}</p>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-4">
        <ProgressRing percent={percent} title={title} subtitle={subtitle} state={state} />

        <div className="flex-1 w-full overflow-x-auto">
          <svg viewBox="0 0 860 300" className="w-full min-w-[640px] h-auto max-h-[300px]" role="img" aria-label="Analysis pipeline graph">
            {/* connections first, so nodes sit on top */}
            <MainEdge x1={50 + S} x2={210} y={MID} state={edgeState(n.upload, n.file)} />
            <MainEdge x1={210 + S} x2={AGENT.x} y={MID} state={edgeState(n.file, n.agent)} />
            <MainEdge x1={AGENT.x + AGENT.w} x2={730} y={MID} state={edgeState(n.agent, n.report)} />
            <SubEdge from={[PORTS.model, PORT_Y + 26]} to={[MODEL[0], MODEL[1] - R - 4]} state={subEdgeState(n.model)} />
            <SubEdge from={[PORTS.tool, PORT_Y + 26]} to={[TOOL[0], TOOL[1] - R - 4]} state={subEdgeState(n.semgrep)} />

            <SquareNode x={50} y={Y} icon="received" color="#2dd4bf" status={n.upload} label="Code upload" sub="POST /analyze/stream" trigger />
            <SquareNode x={210} y={Y} icon="saved" color="#fbbf24" status={n.file} label="Temp file" sub="write: .py" />

            {/* AI Agent: wide node with Chat Model and Tool ports */}
            <g>
              <rect x={AGENT.x} y={Y} width={AGENT.w} height={S} rx={14} fill={C.node} {...outlineProps(n.agent)} />
              <g opacity={n.agent === 'pending' ? 0.45 : 1} style={{ color: '#f4f4f5' }}>
                <StepIconGlyph id="agent" x={AGENT.x + 22} y={MID - 17} width={34} height={34} className="" />
              </g>
              <text x={AGENT.x + 72} y={MID - 3} fontSize={15} fontWeight={600} fill={C.text}>Security Researcher</text>
              <text x={AGENT.x + 72} y={MID + 15} fontSize={11} fill={C.sub}>AI Agent · OpenAI Agents SDK</text>
              <Badge cx={AGENT.x + AGENT.w} cy={Y} status={n.agent} />
              {[PORTS.model, PORTS.tool].map((px) => (
                <rect key={px} x={px - 4} y={PORT_Y - 4} width={8} height={8} fill={C.sub} transform={`rotate(45 ${px} ${PORT_Y})`} />
              ))}
              <text x={PORTS.model} y={PORT_Y + 18} textAnchor="middle" fontSize={10} fill={C.sub}>Chat Model</text>
              <text x={PORTS.tool} y={PORT_Y + 18} textAnchor="middle" fontSize={10} fill={C.sub}>Tool</text>
            </g>

            <SquareNode x={730} y={Y} icon="report" color="#4ade80" status={n.report} label="Security report" sub="sorted by CVSS" />

            <CircleNode cx={MODEL[0]} cy={MODEL[1]} r={R} icon="review" color="#a78bfa" status={n.model} label="OpenAI" sub="gpt-4.1-mini" />
            <CircleNode cx={TOOL[0]} cy={TOOL[1]} r={R} icon="mcp" color="#fb923c" status={n.semgrep} label="Semgrep MCP" sub="semgrep_scan: auto" />
          </svg>
        </div>
      </div>
    </div>
  );
}
