"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type Prompt = { id: string; text: string };

type ParabolaStep = {
  id: string;
  step_number: number;
  title: string;
  verdict: "allowed" | "caution" | "not_recommended";
  why: string;
  boundaries: string[];
  prompts: Prompt[];
};

type Props = {
  denominationContext?: string;
  bibleTranslation?: string;
};

// ─── Parabola node positions along U-curve ───────────────────────────────────
// SVG viewBox is 900 x 520. The parabola descends from top-left to bottom-center,
// then ascends from bottom-center to top-right.
const NODE_POSITIONS: { x: number; y: number }[] = [
  { x: 80, y: 60 },    // 1  Scripture
  { x: 135, y: 130 },  // 2  Soaking
  { x: 185, y: 200 },  // 3  Researching
  { x: 230, y: 280 },  // 4  Summarising
  { x: 290, y: 355 },  // 5  Human Problem
  { x: 370, y: 415 },  // 6  Gospel Truth
  { x: 530, y: 415 },  // 7  Relevance
  { x: 610, y: 355 },  // 8  Structuring
  { x: 670, y: 280 },  // 9  Anticipated Response
  { x: 715, y: 200 },  // 10 Shaping Content
  { x: 765, y: 130 },  // 11 Writing & Polishing
  { x: 820, y: 60 },   // 12 Preaching
];

// Build the SVG path (smooth quadratic bezier through the points)
function buildParabolaPath(): string {
  const pts = NODE_POSITIONS;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    const cpy = (prev.y + curr.y) / 2 + 15;
    d += ` Q ${cpx} ${cpy} ${curr.x} ${curr.y}`;
  }
  return d;
}

// Verdict config
const VERDICT_CONFIG = {
  allowed: {
    label: "Allowed",
    color: "#16A34A",
    bgClass: "bg-green-50 border-green-200 text-green-800",
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    fill: "#16A34A",
    ring: "#bbf7d0",
  },
  caution: {
    label: "Caution",
    color: "#D97706",
    bgClass: "bg-amber-50 border-amber-200 text-amber-800",
    badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
    fill: "#D97706",
    ring: "#fde68a",
  },
  not_recommended: {
    label: "Not Recommended",
    color: "#DC2626",
    bgClass: "bg-red-50 border-red-200 text-red-800",
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    fill: "#DC2626",
    ring: "#fecaca",
  },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function SermonParabola({
  denominationContext = "Protestant / Pentecostal",
  bibleTranslation = "KJV",
}: Props) {
  const [steps, setSteps] = useState<ParabolaStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStep, setSelectedStep] = useState<ParabolaStep | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  // Fetch steps from API
  useEffect(() => {
    fetch("/api/sermon-parabola")
      .then((r) => r.json())
      .then((data) => {
        if (data.steps) setSteps(data.steps);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Track analytics
  const trackEvent = useCallback(
    (event: "step_clicked" | "prompt_copied", stepNumber: number, promptIndex?: number) => {
      fetch("/api/sermon-parabola/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, stepNumber, promptIndex }),
      }).catch(() => {});
    },
    []
  );

  // Handle node click
  function handleNodeClick(stepNumber: number) {
    const step = steps.find((s) => s.step_number === stepNumber);
    if (!step) return;
    setSelectedStep(step);
    setDrawerOpen(true);
    setShowPrompts(false);
    setCopiedId(null);
    trackEvent("step_clicked", stepNumber);
  }

  // Copy prompt
  async function copyPrompt(prompt: Prompt, stepNumber: number, index: number) {
    const text = prompt.text
      .replace(/KJV/g, bibleTranslation)
      .replace(/Protestant\/Pentecostal/g, denominationContext);
    await navigator.clipboard.writeText(text);
    setCopiedId(prompt.id);
    trackEvent("prompt_copied", stepNumber, index);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border shadow-sm p-12 flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-secondary text-sm">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="32" className="opacity-25" />
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="16" />
          </svg>
          Loading Sermon Preparation Parabola...
        </div>
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border shadow-sm p-12 text-center">
        <p className="text-text-secondary text-sm">
          Parabola steps not yet configured. Run the database migration to seed the 12 steps.
        </p>
      </div>
    );
  }

  const pathD = buildParabolaPath();

  return (
    <>
      {/* ── Parabola Diagram ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">Sermon Preparation Parabola</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Click any step to see AI usage guidelines, boundaries, and curated prompts
          </p>
        </div>

        {/* SVG Diagram */}
        <div className="px-4 py-6 overflow-x-auto">
          <svg
            viewBox="0 0 900 500"
            className="w-full min-w-[600px] max-w-4xl mx-auto"
            style={{ height: "auto" }}
          >
            {/* Axis labels */}
            <text x="450" y="22" textAnchor="middle" className="fill-text-secondary" fontSize="11" fontWeight="600" letterSpacing="0.05em">
              DETAILS
            </text>
            <text x="450" y="492" textAnchor="middle" className="fill-text-secondary" fontSize="11" fontWeight="600" letterSpacing="0.05em">
              CONCEPTS
            </text>
            <text x="18" y="255" textAnchor="middle" className="fill-text-secondary" fontSize="10" fontWeight="600" letterSpacing="0.05em">
              PASSAGE
            </text>
            <text x="882" y="255" textAnchor="middle" className="fill-text-secondary" fontSize="10" fontWeight="600" letterSpacing="0.05em">
              SERMON
            </text>

            {/* Axis lines */}
            <line x1="450" y1="30" x2="450" y2="475" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="40" y1="252" x2="860" y2="252" stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />

            {/* Axis sub-labels */}
            <text x="280" y="246" textAnchor="middle" className="fill-text-secondary" fontSize="9" fontStyle="italic" opacity="0.6">
              authority / truth
            </text>
            <text x="620" y="246" textAnchor="middle" className="fill-text-secondary" fontSize="9" fontStyle="italic" opacity="0.6">
              relevance / clarity
            </text>

            {/* Parabola curve */}
            <path d={pathD} fill="none" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />

            {/* Gradient overlay on curve */}
            <defs>
              <linearGradient id="parabolaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1E3A5F" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#C23B3B" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#1E3A5F" stopOpacity="0.6" />
              </linearGradient>
            </defs>
            <path d={pathD} fill="none" stroke="url(#parabolaGrad)" strokeWidth="3" strokeLinecap="round" />

            {/* Arrow decorations on curve */}
            <polygon points="100,85 108,78 112,90" fill="#1E3A5F" opacity="0.5" />
            <polygon points="800,85 792,78 788,90" fill="#1E3A5F" opacity="0.5" />

            {/* Nodes */}
            {steps.map((step) => {
              const pos = NODE_POSITIONS[step.step_number - 1];
              if (!pos) return null;
              const vc = VERDICT_CONFIG[step.verdict];
              const isHovered = hoveredNode === step.step_number;
              const isSelected = selectedStep?.step_number === step.step_number && drawerOpen;
              const nodeR = isHovered || isSelected ? 18 : 15;

              // Label positioning: left side labels go right, right side labels go left
              const isLeftSide = step.step_number <= 6;
              const labelX = isLeftSide ? pos.x + 26 : pos.x - 26;
              const labelAnchor = isLeftSide ? "start" : "end";

              return (
                <g
                  key={step.step_number}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(step.step_number)}
                  onMouseEnter={() => setHoveredNode(step.step_number)}
                  onMouseLeave={() => setHoveredNode(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleNodeClick(step.step_number);
                  }}
                >
                  {/* Outer ring on hover/select */}
                  {(isHovered || isSelected) && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={nodeR + 5}
                      fill="none"
                      stroke={vc.ring}
                      strokeWidth="3"
                      opacity="0.8"
                    />
                  )}
                  {/* Node circle */}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={nodeR}
                    fill={isSelected ? vc.fill : "white"}
                    stroke={vc.fill}
                    strokeWidth="2.5"
                    style={{
                      transition: "all 0.15s ease",
                      filter: isHovered ? "drop-shadow(0 2px 6px rgba(0,0,0,0.15))" : "none",
                    }}
                  />
                  {/* Step number */}
                  <text
                    x={pos.x}
                    y={pos.y + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="11"
                    fontWeight="700"
                    fill={isSelected ? "white" : vc.fill}
                    style={{ pointerEvents: "none" }}
                  >
                    {step.step_number}
                  </text>
                  {/* Label */}
                  <text
                    x={labelX}
                    y={pos.y + 1}
                    textAnchor={labelAnchor}
                    dominantBaseline="central"
                    fontSize="10.5"
                    fontWeight="600"
                    fill={isHovered || isSelected ? "#1F2937" : "#6B7280"}
                    style={{
                      pointerEvents: "none",
                      transition: "fill 0.15s ease",
                    }}
                  >
                    {step.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="px-6 py-3 border-t border-border bg-[#F5F7FA] flex flex-wrap items-center gap-4 text-xs">
          <span className="text-text-secondary font-medium">AI Usage:</span>
          {(["allowed", "caution", "not_recommended"] as const).map((v) => (
            <span key={v} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full border-2"
                style={{ borderColor: VERDICT_CONFIG[v].fill, backgroundColor: VERDICT_CONFIG[v].ring }}
              />
              <span className="text-text-secondary">{VERDICT_CONFIG[v].label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Drawer (Slide-over from right) ────────────────────────────────── */}
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full max-w-lg bg-white border-l border-border shadow-2xl
          z-50 transform transition-transform duration-300 ease-in-out flex flex-col
          ${drawerOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {selectedStep && (
          <>
            {/* Drawer header */}
            <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: VERDICT_CONFIG[selectedStep.verdict].fill }}
                  >
                    {selectedStep.step_number}
                  </span>
                  <h3 className="text-lg font-bold text-text-primary truncate">
                    {selectedStep.title}
                  </h3>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${VERDICT_CONFIG[selectedStep.verdict].badgeClass}`}
                >
                  {VERDICT_CONFIG[selectedStep.verdict].label}
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-slate-100 transition-colors shrink-0 ml-3"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Why explanation */}
              <section>
                <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-navy">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
                  </svg>
                  Why This Rating
                </h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {selectedStep.why}
                </p>
              </section>

              {/* Boundaries */}
              {selectedStep.boundaries.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-crimson">
                      <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
                    </svg>
                    Rules & Boundaries
                  </h4>
                  <ul className="space-y-2">
                    {selectedStep.boundaries.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                        <span className="w-1.5 h-1.5 bg-crimson rounded-full shrink-0 mt-1.5" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Prompts section */}
              {selectedStep.prompts.length > 0 && (
                <section>
                  {!showPrompts ? (
                    <button
                      onClick={() => setShowPrompts(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-navy text-white rounded-lg text-sm font-medium hover:bg-navy-light transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5Z" clipRule="evenodd" />
                      </svg>
                      View {selectedStep.prompts.length} Curated Prompts
                    </button>
                  ) : (
                    <>
                      <h4 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-navy">
                          <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5Z" clipRule="evenodd" />
                        </svg>
                        Curated Prompts
                        <span className="text-xs font-normal text-text-secondary">
                          ({denominationContext} · {bibleTranslation})
                        </span>
                      </h4>
                      <div className="space-y-3">
                        {selectedStep.prompts.map((prompt, idx) => (
                          <div
                            key={prompt.id}
                            className="bg-[#F5F7FA] border border-border rounded-lg p-3 group"
                          >
                            <p className="text-sm text-text-primary leading-relaxed mb-2">
                              {prompt.text
                                .replace(/KJV/g, bibleTranslation)
                                .replace(/Protestant\/Pentecostal/g, denominationContext)}
                            </p>
                            <button
                              onClick={() => copyPrompt(prompt, selectedStep.step_number, idx)}
                              className={`
                                inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md
                                transition-all duration-150
                                ${copiedId === prompt.id
                                  ? "bg-green-100 text-green-700 border border-green-200"
                                  : "bg-white text-text-secondary border border-border hover:text-navy hover:border-navy/30"
                                }
                              `}
                            >
                              {copiedId === prompt.id ? (
                                <>
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                    <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                                  </svg>
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                                    <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-8.669 0C8.135 3.297 7.502 4.525 7.502 6ZM3.75 20.625a3.375 3.375 0 0 0 3.375-3.375v-1.5a3.375 3.375 0 0 0 3.375-3.375V9.375A3.375 3.375 0 0 0 7.125 6h-1.5A3.375 3.375 0 0 0 2.25 9.375v7.875A3.375 3.375 0 0 0 5.625 20.625h-1.875Z" clipRule="evenodd" />
                                  </svg>
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}

              {/* No prompts for NOT RECOMMENDED steps */}
              {selectedStep.prompts.length === 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-red-700 font-medium">
                    No AI prompts are provided for this step.
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    This step should be performed through personal spiritual practice and pastoral discernment.
                  </p>
                </div>
              )}
            </div>

            {/* Drawer footer — disclaimer */}
            <div className="px-6 py-3 border-t border-border bg-[#F5F7FA] shrink-0">
              <p className="text-[11px] text-text-secondary leading-relaxed text-center">
                AI is a tool, not an authority. Verify all outputs with Scripture and trusted sources.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
