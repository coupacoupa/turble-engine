import React, { useEffect, useState, useCallback } from 'react';

export interface ActiveDependency {
  sourceCellKey?: string; // e.g. "row_bureau:col_scoring"
  targetCellKey: string;  // e.g. "row_risk:col_underwriting"
  variableName: string;
  isWorkflowInput?: boolean;
  type?: 'incoming' | 'outgoing' | 'clash';
  value?: any;
}

interface DependencyConnectorOverlayProps {
  activeDependency?: ActiveDependency | null;
  dependencies?: ActiveDependency[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface RenderedPath {
  id: string;
  variableName: string;
  type: 'incoming' | 'outgoing' | 'clash';
  value?: any;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  cx1: number;
  cy1: number;
  cx2: number;
  cy2: number;
  midX: number;
  midY: number;
  pathD: string;
}

export const DependencyConnectorOverlay: React.FC<DependencyConnectorOverlayProps> = ({
  activeDependency,
  dependencies = [],
  containerRef,
}) => {
  const [paths, setPaths] = useState<RenderedPath[]>([]);

  const calculatePaths = useCallback(() => {
    const targetDeps: ActiveDependency[] = [...dependencies];
    if (
      activeDependency &&
      !targetDeps.some(
        (d) => d.variableName === activeDependency.variableName && d.targetCellKey === activeDependency.targetCellKey && d.type === activeDependency.type,
      )
    ) {
      targetDeps.push({ ...activeDependency, type: activeDependency.type || 'incoming' });
    }

    if (targetDeps.length === 0) {
      setPaths([]);
      return;
    }

    const container = containerRef.current;
    const computedPaths: RenderedPath[] = [];

    targetDeps.forEach((dep, idx) => {
      let sourceEl: HTMLElement | null = null;
      let targetEl: HTMLElement | null = null;

      if (dep.sourceCellKey) {
        sourceEl = container ? container.querySelector(`[data-cell-key="${dep.sourceCellKey}"]`) : document.querySelector(`[data-cell-key="${dep.sourceCellKey}"]`);
      } else if (dep.isWorkflowInput) {
        // Target the Workflow Inputs button in the top header toolbar
        sourceEl = document.querySelector('[data-workflow-inputs-button="true"]') || (container ? container.querySelector('[data-corner-header="true"]') : null);
      }

      if (dep.targetCellKey) {
        targetEl = container ? container.querySelector(`[data-cell-key="${dep.targetCellKey}"]`) : document.querySelector(`[data-cell-key="${dep.targetCellKey}"]`);
      }

      if (!sourceEl || !targetEl) return;

      const sRect = sourceEl.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();

      // Screen viewport-relative coordinates for fixed inset-0 overlay
      const x1 = sRect.left + sRect.width / 2;
      const y1 = sRect.top + sRect.height / 2;

      const x2 = tRect.left + tRect.width / 2;
      const y2 = tRect.top + tRect.height / 2;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const curveOffset = Math.max(50, Math.abs(dx) * 0.4);

      const cx1 = x1 + curveOffset;
      const cy1 = y1;
      const cx2 = x2 - curveOffset;
      const cy2 = y2;

      // Vertical stagger offset for multiple overlapping arrows
      const stagger = ((idx % 5) - 2) * 18;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2 + (dy > 0 ? -12 : 12) + stagger;

      const pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

      computedPaths.push({
        id: `dep_${idx}_${dep.variableName}_${dep.type || 'inc'}_${x1.toFixed(0)}_${y1.toFixed(0)}`,
        variableName: dep.variableName,
        type: dep.type || 'incoming',
        value: dep.value,
        x1,
        y1,
        x2,
        y2,
        cx1,
        cy1,
        cx2,
        cy2,
        midX,
        midY,
        pathD,
      });
    });

    setPaths(computedPaths);
  }, [activeDependency, dependencies, containerRef]);

  // Recalculate coordinates on scroll or window resize
  useEffect(() => {
    calculatePaths();

    const handleUpdate = () => calculatePaths();
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [calculatePaths]);

  if (paths.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-visible">
      <svg className="w-full h-full absolute inset-0 pointer-events-none overflow-visible">
        <defs>
          <style>
            {`
              @keyframes line-flow-reverse {
                from { stroke-dashoffset: 32; }
                to { stroke-dashoffset: 0; }
              }
              .animate-dashed-flow {
                animation: line-flow-reverse 0.9s linear infinite;
              }
            `}
          </style>

          {/* Incoming Input Arrowhead Marker (Sky Blue) */}
          <marker
            id="arrowhead-incoming"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0284c7" />
          </marker>

          {/* Outgoing Output Arrowhead Marker (Emerald Green) */}
          <marker
            id="arrowhead-outgoing"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10b981" />
          </marker>

          {/* Clash Collision Arrowhead Marker (Rose Red) */}
          <marker
            id="arrowhead-clash"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#e11d48" />
          </marker>
        </defs>

        {paths.map((p) => {
          const isClash = p.type === 'clash';
          const isIncoming = p.type === 'incoming';

          const primaryColor = isClash ? '#e11d48' : isIncoming ? '#0284c7' : '#10b981';
          const markerUrl = isClash ? 'url(#arrowhead-clash)' : isIncoming ? 'url(#arrowhead-incoming)' : 'url(#arrowhead-outgoing)';

          return (
            <g key={p.id}>
              {/* Semi-transparent background guide line */}
              <path
                d={p.pathD}
                fill="none"
                stroke={primaryColor}
                strokeWidth={isClash ? "4" : p.value !== undefined ? "3.5" : "3"}
                strokeOpacity={isClash ? "0.2" : p.value !== undefined ? "0.25" : "0.12"}
                strokeLinecap="round"
              />

              {/* Animated Dashed Line with Arrowhead */}
              <path
                d={p.pathD}
                fill="none"
                stroke={primaryColor}
                strokeWidth={isClash ? "2.2" : p.value !== undefined ? "2.2" : "1.8"}
                strokeDasharray={isClash ? "6 4" : "8 5"}
                markerEnd={markerUrl}
                strokeLinecap="round"
                className="animate-dashed-flow"
              />

              {/* Minimal Source Dot */}
              <circle cx={p.x1} cy={p.y1} r={isClash ? "4" : "3.5"} fill={primaryColor} stroke="#ffffff" strokeWidth="1.2" />

              {/* Minimal Target Dot */}
              <circle cx={p.x2} cy={p.y2} r={isClash ? "4" : "3.5"} fill={primaryColor} stroke="#ffffff" strokeWidth="1.2" />
            </g>
          );
        })}
      </svg>

      {/* Variable & Runtime Value Label Badges */}
      {paths.map((p) => {
        const isClash = p.type === 'clash';
        const isIncoming = p.type === 'incoming';

        const hasValue = p.value !== undefined;
        const formattedVal = hasValue
          ? typeof p.value === 'object'
            ? JSON.stringify(p.value)
            : String(p.value)
          : null;

        const badgeBorder = isClash
          ? 'border-rose-500 bg-rose-950 text-rose-200 shadow-rose-900/30'
          : isIncoming
          ? hasValue
            ? 'border-sky-400 bg-slate-950 text-sky-200 shadow-sky-900/40 ring-1 ring-sky-500/50'
            : 'border-sky-500/80 bg-slate-900 text-sky-200'
          : hasValue
          ? 'border-emerald-400 bg-slate-950 text-emerald-200 shadow-emerald-900/40 ring-1 ring-emerald-500/50'
          : 'border-emerald-500/80 bg-slate-900 text-emerald-200';

        const dotBg = isClash ? 'bg-rose-500' : isIncoming ? 'bg-sky-400' : 'bg-emerald-400';

        return (
          <div
            key={`badge_${p.id}`}
            style={{
              left: `${p.midX}px`,
              top: `${p.midY}px`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute z-50 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold flex items-center space-x-1.5 shadow-md border animate-in fade-in duration-100 ${badgeBorder}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dotBg} shrink-0`} />
            {isClash ? (
              <span>⚠️ CLASH: {p.variableName}</span>
            ) : (
              <div className="flex items-center space-x-1">
                <span className="text-slate-300">{p.variableName}</span>
                {formattedVal !== null && (
                  <>
                    <span className="text-slate-500 font-normal">=</span>
                    <span className="text-amber-300 font-extrabold px-1 rounded bg-amber-500/20 border border-amber-400/30">
                      {formattedVal}
                    </span>
                  </>
                )}
              </div>
            )}
            <span className="text-slate-400 text-[9px]">➔</span>
          </div>
        );
      })}
    </div>
  );
};

