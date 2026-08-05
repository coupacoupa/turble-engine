import React, { useCallback, useEffect, useState } from "react";

export type DependencyType = "incoming" | "outgoing" | "clash";

export interface ActiveDependency {
  sourceCellKey?: string; // e.g. "row_bureau:col_scoring"
  targetCellKey: string; // e.g. "row_risk:col_underwriting"
  variableName: string;
  isWorkflowInput?: boolean;
  type?: DependencyType;
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
  type: DependencyType;
  value?: any;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
  pathD: string;
}

// Visual treatment per dependency type — the single source of truth for the flow layer.
const DEP_STYLES: Record<
  DependencyType,
  {
    stroke: string;
    markerId: string;
    badge: string;
    badgeWithValue: string;
    dot: string;
  }
> = {
  incoming: {
    stroke: "#0284c7", // sky-600
    markerId: "flow-arrowhead-incoming",
    badge: "border-sky-500/80 bg-slate-900 text-sky-200",
    badgeWithValue:
      "border-sky-400 bg-slate-950 text-sky-200 shadow-sky-900/40 ring-1 ring-sky-500/50",
    dot: "bg-sky-400",
  },
  outgoing: {
    stroke: "#10b981", // emerald-500
    markerId: "flow-arrowhead-outgoing",
    badge: "border-emerald-500/80 bg-slate-900 text-emerald-200",
    badgeWithValue:
      "border-emerald-400 bg-slate-950 text-emerald-200 shadow-emerald-900/40 ring-1 ring-emerald-500/50",
    dot: "bg-emerald-400",
  },
  clash: {
    stroke: "#e11d48", // rose-600
    markerId: "flow-arrowhead-clash",
    badge: "border-rose-500 bg-rose-950 text-rose-200 shadow-rose-900/30",
    badgeWithValue:
      "border-rose-500 bg-rose-950 text-rose-200 shadow-rose-900/30",
    dot: "bg-rose-500",
  },
};

const formatRuntimeValue = (value: any): string =>
  typeof value === "object" ? JSON.stringify(value) : String(value);

const resolveCellElement = (
  container: HTMLElement | null,
  cellKey: string,
): HTMLElement | null =>
  container
    ? container.querySelector(`[data-cell-key="${cellKey}"]`)
    : document.querySelector(`[data-cell-key="${cellKey}"]`);

/** Variable name + optional runtime value pill rendered at the midpoint of a connector. */
const FlowLabelBadge: React.FC<{ path: RenderedPath }> = ({ path }) => {
  const styles = DEP_STYLES[path.type];
  const hasValue = path.value !== undefined;

  return (
    <div
      style={{
        left: `${path.midX}px`,
        top: `${path.midY}px`,
        transform: "translate(-50%, -50%)",
      }}
      className={`absolute px-2 py-0.5 rounded-md font-mono text-[10px] font-bold flex items-center space-x-1.5 shadow-md border animate-in fade-in duration-100 ${
        hasValue ? styles.badgeWithValue : styles.badge
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} shrink-0`} />
      {path.type === "clash" ? (
        <span>⚠️ CLASH: {path.variableName}</span>
      ) : (
        <div className="flex items-center space-x-1">
          <span className="text-slate-300">{path.variableName}</span>
          {hasValue && (
            <>
              <span className="text-slate-500 font-normal">=</span>
              <span className="text-amber-300 font-extrabold px-1 rounded bg-amber-500/20 border border-amber-400/30">
                {formatRuntimeValue(path.value)}
              </span>
            </>
          )}
        </div>
      )}
      <span className="text-slate-400 text-[9px]">➔</span>
    </div>
  );
};

export const DependencyConnectorOverlay: React.FC<
  DependencyConnectorOverlayProps
> = ({ activeDependency, dependencies = [], containerRef }) => {
  const [paths, setPaths] = useState<RenderedPath[]>([]);

  const calculatePaths = useCallback(() => {
    const targetDeps: ActiveDependency[] = [...dependencies];
    if (
      activeDependency &&
      !targetDeps.some(
        (d) =>
          d.variableName === activeDependency.variableName &&
          d.targetCellKey === activeDependency.targetCellKey &&
          d.type === activeDependency.type,
      )
    ) {
      targetDeps.push({
        ...activeDependency,
        type: activeDependency.type || "incoming",
      });
    }

    if (targetDeps.length === 0) {
      setPaths([]);
      return;
    }

    const container = containerRef.current;
    const computedPaths: RenderedPath[] = [];

    targetDeps.forEach((dep, idx) => {
      let sourceEl: HTMLElement | null = null;

      if (dep.sourceCellKey) {
        sourceEl = resolveCellElement(container, dep.sourceCellKey);
      } else if (dep.isWorkflowInput) {
        // Workflow-level inputs originate from the Inputs button in the studio toolbar
        sourceEl =
          document.querySelector('[data-workflow-inputs-button="true"]') ||
          (container
            ? container.querySelector('[data-corner-header="true"]')
            : null);
      }

      const targetEl = dep.targetCellKey
        ? resolveCellElement(container, dep.targetCellKey)
        : null;
      if (!sourceEl || !targetEl) return;

      const sRect = sourceEl.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();

      // Screen viewport-relative coordinates for the fixed inset-0 overlay
      const x1 = sRect.left + sRect.width / 2;
      const y1 = sRect.top + sRect.height / 2;
      const x2 = tRect.left + tRect.width / 2;
      const y2 = tRect.top + tRect.height / 2;

      const dy = y2 - y1;
      const curveOffset = Math.max(50, Math.abs(x2 - x1) * 0.4);

      // Vertical stagger so multiple overlapping badges fan out instead of piling up
      const stagger = ((idx % 5) - 2) * 18;

      computedPaths.push({
        // Identity-based key (never position): coordinates change every scroll
        // frame and would remount each path/badge, replaying animations.
        id: `dep_${dep.variableName}_${dep.sourceCellKey || "wf-input"}_${dep.targetCellKey}_${dep.type || "inc"}`,
        variableName: dep.variableName,
        type: dep.type || "incoming",
        value: dep.value,
        x1,
        y1,
        x2,
        y2,
        midX: (x1 + x2) / 2,
        midY: (y1 + y2) / 2 + (dy > 0 ? -12 : 12) + stagger,
        pathD: `M ${x1} ${y1} C ${x1 + curveOffset} ${y1}, ${x2 - curveOffset} ${y2}, ${x2} ${y2}`,
      });
    });

    setPaths(computedPaths);
  }, [activeDependency, dependencies, containerRef]);

  // Recalculate coordinates on scroll/resize, throttled to one pass per animation frame
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(calculatePaths);
    };

    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, {
      capture: true,
      passive: true,
    });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
    };
  }, [calculatePaths]);

  if (paths.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-flow-overlay overflow-hidden">
      <svg
        className="w-full h-full absolute inset-0 pointer-events-none overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {(Object.keys(DEP_STYLES) as DependencyType[]).map((type) => (
            <marker
              key={type}
              id={DEP_STYLES[type].markerId}
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path
                d="M 0 1.5 L 9 5 L 0 8.5 z"
                fill={DEP_STYLES[type].stroke}
              />
            </marker>
          ))}
        </defs>

        {paths.map((p) => {
          const styles = DEP_STYLES[p.type];
          const isClash = p.type === "clash";
          const hasValue = p.value !== undefined;

          return (
            <g key={p.id}>
              {/* Semi-transparent background guide line */}
              <path
                d={p.pathD}
                fill="none"
                stroke={styles.stroke}
                strokeWidth={isClash ? 4 : hasValue ? 3.5 : 3}
                strokeOpacity={isClash ? 0.2 : hasValue ? 0.25 : 0.12}
                strokeLinecap="round"
              />

              {/* Animated dashed line with arrowhead */}
              <path
                d={p.pathD}
                fill="none"
                stroke={styles.stroke}
                strokeWidth={isClash || hasValue ? 2.2 : 1.8}
                strokeDasharray={isClash ? "6 4" : "8 5"}
                markerEnd={`url(#${styles.markerId})`}
                strokeLinecap="round"
                className="animate-dashed-flow"
              />

              {/* Source & target endpoint dots */}
              <circle
                cx={p.x1}
                cy={p.y1}
                r={isClash ? 4 : 3.5}
                fill={styles.stroke}
                stroke="#ffffff"
                strokeWidth="1.2"
              />
              <circle
                cx={p.x2}
                cy={p.y2}
                r={isClash ? 4 : 3.5}
                fill={styles.stroke}
                stroke="#ffffff"
                strokeWidth="1.2"
              />
            </g>
          );
        })}
      </svg>

      {paths.map((p) => (
        <FlowLabelBadge key={`badge_${p.id}`} path={p} />
      ))}
    </div>
  );
};
