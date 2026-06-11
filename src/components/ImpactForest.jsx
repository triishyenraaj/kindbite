import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Leaf } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   IMPACT FOREST — Canvas-based animated forest
═══════════════════════════════════════════════════════════════ */

const SEASONS = [
  {
    label: "Night forest",
    skyTop: "#050e08", skyBot: "#091408", ground: "#040c06",
    fogColor: "rgba(10,40,20,0.25)",
    fireflyColor: (a) => `rgba(100,255,140,${a})`,
    stars: true,
  },
  {
    label: "Golden hour",
    skyTop: "#160800", skyBot: "#2a1005", ground: "#0e0600",
    fogColor: "rgba(90,35,5,0.18)",
    fireflyColor: (a) => `rgba(255,190,60,${a})`,
    stars: false,
  },
  {
    label: "Winter dawn",
    skyTop: "#080f1a", skyBot: "#0a1220", ground: "#060b14",
    fogColor: "rgba(30,55,100,0.22)",
    fireflyColor: (a) => `rgba(140,200,255,${a})`,
    stars: true,
  },
  {
    label: "Misty spring",
    skyTop: "#0a160a", skyBot: "#0d1c0d", ground: "#080f08",
    fogColor: "rgba(20,70,30,0.28)",
    fireflyColor: (a) => `rgba(180,255,180,${a})`,
    stars: false,
  },
];

const TREE_DEFS = [
  { key: "sprout",  label: "Sprout",     detail: "First rescue",        minImpact: 1,  color: "#34d399", trunkColor: "#2d1a0a", baseW: 18, baseH: 56,  layers: 2 },
  { key: "sapling", label: "Sapling",    detail: "5 rescues milestone",  minImpact: 5,  color: "#10b981", trunkColor: "#2a1608", baseW: 26, baseH: 92,  layers: 3 },
  { key: "tree",    label: "Grove tree", detail: "10 rescues milestone", minImpact: 10, color: "#059669", trunkColor: "#251405", baseW: 34, baseH: 136, layers: 4 },
  { key: "elder",   label: "Elder tree", detail: "50 rescues — epic!",   minImpact: 50, color: "#047857", trunkColor: "#1e1003", baseW: 46, baseH: 180, layers: 5 },
];

function getTreeDef(impact) {
  if (impact >= 50) return TREE_DEFS[3];
  if (impact >= 10) return TREE_DEFS[2];
  if (impact >= 5)  return TREE_DEFS[1];
  return TREE_DEFS[0];
}

function buildTreeList(totalImpact, MAX = 22) {
  let left = totalImpact;
  const list = [];
  for (const thresh of [50, 10, 5, 1]) {
    while (left >= thresh && list.length < MAX) {
      list.push({ impact: thresh, def: getTreeDef(thresh) });
      left -= thresh;
    }
  }
  return list.sort((a, b) => a.def.baseH - b.def.baseH);
}

function assignPositions(trees) {
  const n = trees.length;
  return trees.map((t, i) => ({
    ...t,
    xFrac: 0.07 + (0.86 / Math.max(n - 1, 1)) * i + (i % 2 === 0 ? 0.025 : -0.025),
    scale: 0.75 + ((i * 7) % 10) * 0.035,
    wobblePhase: (i * 2.618) % (Math.PI * 2),
    wobbleSpeed: 0.28 + (i % 5) * 0.06,
    id: i,
  }));
}

export default function ImpactForest({ totalCombinedImpact = 0 }) {
  const bgRef  = useRef(null);
  const fgRef  = useRef(null);
  const wrapRef = useRef(null);

  const [seasonIdx, setSeasonIdx] = useState(0);
  const season = SEASONS[seasonIdx];

  const baseTrees = useMemo(
    () => assignPositions(buildTreeList(totalCombinedImpact)),
    [totalCombinedImpact]
  );

  const allTreesRef   = useRef(baseTrees);
  const seasonRef     = useRef(season);
  const fireflyRef    = useRef([]);
  const particlesRef  = useRef([]);
  const hoveredIdRef  = useRef(null);
  const rafRef        = useRef(null);

  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => { allTreesRef.current = baseTrees; }, [baseTrees]);
  useEffect(() => { seasonRef.current = season; }, [season]);

  // Init fireflies once
  useEffect(() => {
    const ff = [];
    for (let i = 0; i < 30; i++) {
      ff.push({
        x: Math.random() * 800, y: 30 + Math.random() * 240,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.28,
        phase: Math.random() * Math.PI * 2,
        speed: 0.012 + Math.random() * 0.018,
        size: 1.0 + Math.random() * 1.4,
      });
    }
    fireflyRef.current = ff;
  }, []);

  const drawBg = useCallback((canvas, W, H, s) => {
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, s.skyTop);
    grad.addColorStop(1, s.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    if (s.stars) {
      for (let i = 0; i < 70; i++) {
        const sx = (i * 139.7) % W;
        const sy = (i * 83.1) % (H * 0.65);
        const bright = 0.2 + 0.5 * Math.sin(i * 3.1);
        ctx.fillStyle = `rgba(255,255,255,${bright * 0.45})`;
        ctx.beginPath(); ctx.arc(sx, sy, 0.7, 0, Math.PI * 2); ctx.fill();
      }
      // Moon
      ctx.fillStyle = "rgba(255,255,240,0.55)";
      ctx.beginPath(); ctx.arc(W * 0.82, H * 0.15, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = s.skyTop;
      ctx.beginPath(); ctx.arc(W * 0.82 + 6, H * 0.15, 16, 0, Math.PI * 2); ctx.fill();
    }

    const groundY = Math.round(H * 0.80);
    ctx.fillStyle = s.ground;
    ctx.fillRect(0, groundY, W, H - groundY);

    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = s.fogColor;
      ctx.beginPath();
      ctx.ellipse(W * (0.05 + i * 0.23), groundY + 10, W * 0.19, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  // Animation loop
  useEffect(() => {
    const bg = bgRef.current;
    const fg = fgRef.current;
    if (!bg || !fg) return;

    const W = bg.width;
    const H = bg.height;
    const groundY = Math.round(H * 0.80);
    const fgCtx = fg.getContext("2d");

    drawBg(bg, W, H, seasonRef.current);

    const render = (ts) => {
      const t = ts / 1000;
      fgCtx.clearRect(0, 0, W, H);

      const trees = allTreesRef.current;
      const s = seasonRef.current;

      // Draw trees back-to-front (tallest first = furthest back)
      [...trees]
        .sort((a, b) => b.def.baseH - a.def.baseH)
        .forEach((tree) => {
          const gp = tree.growProgress !== undefined ? tree.growProgress : 1;
          const sc = tree.scale * gp;
          const tw = tree.def.baseW * sc;
          const th = tree.def.baseH * sc;
          const bx = tree.xFrac * W;
          const wobble = Math.sin(t * tree.wobbleSpeed + tree.wobblePhase) * 1.5;
          const isHovered = hoveredIdRef.current === tree.id;

          fgCtx.save();
          fgCtx.translate(bx, groundY);
          if (isHovered) { fgCtx.shadowColor = tree.def.color; fgCtx.shadowBlur = 22; }

          // Trunk
          const trunkW = Math.max(tw * 0.18, 2);
          const trunkH = th * 0.40;
          fgCtx.fillStyle = tree.def.trunkColor;
          fgCtx.beginPath();
          fgCtx.roundRect(-trunkW / 2, -trunkH, trunkW, trunkH, 2);
          fgCtx.fill();

          // Leaf canopy layers
          for (let l = 0; l < tree.def.layers; l++) {
            const lf = l / tree.def.layers;
            const layerY = -trunkH - (th - trunkH) * (0.1 + l * 0.17);
            const layerW = tw * (0.90 - l * 0.10);
            const layerH = (th - trunkH) * 0.30;
            const breathe = 1 + Math.sin(t * 0.38 + tree.wobblePhase + l * 1.1) * 0.013;
            const alpha = 0.82 + lf * 0.12;
            fgCtx.fillStyle = tree.def.color + Math.round(alpha * 255).toString(16).padStart(2, "0");
            fgCtx.beginPath();
            fgCtx.ellipse(
              wobble * (1 - lf * 0.4), layerY,
              (layerW / 2) * breathe, (layerH / 2) * breathe,
              0, 0, Math.PI * 2
            );
            fgCtx.fill();
          }

          // Hover glow ring
          if (isHovered) {
            fgCtx.strokeStyle = tree.def.color + "66";
            fgCtx.lineWidth = 1.5;
            fgCtx.beginPath();
            fgCtx.ellipse(0, -th * 0.6, tw * 0.6, th * 0.14, 0, 0, Math.PI * 2);
            fgCtx.stroke();
          }

          fgCtx.restore();

          // Advance grow animation
          if (tree.growProgress !== undefined && tree.growProgress < 1) {
            tree.growProgress = Math.min(1, tree.growProgress + 0.024);
          }
        });

      // Fireflies
      fireflyRef.current.forEach((f) => {
        f.x += f.vx + Math.sin(t * f.speed * 2.1 + f.phase) * 0.55;
        f.y += f.vy + Math.cos(t * f.speed * 1.6 + f.phase) * 0.38;
        if (f.x < 0) f.x = W; if (f.x > W) f.x = 0;
        if (f.y < 18) f.y = 18; if (f.y > groundY - 10) f.y = groundY - 10;
        const blink = (Math.sin(t * f.speed * 3.2 + f.phase) + 1) / 2;
        const alpha = blink * 0.72;
        if (alpha < 0.06) return;
        const col = s.fireflyColor(alpha);
        fgCtx.save();
        fgCtx.shadowColor = col; fgCtx.shadowBlur = 7;
        fgCtx.fillStyle = col;
        fgCtx.beginPath(); fgCtx.arc(f.x, f.y, f.size, 0, Math.PI * 2); fgCtx.fill();
        fgCtx.restore();
      });

      // Particles
      const pts = particlesRef.current;
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.065; p.life -= 0.038;
        if (p.life <= 0) { pts.splice(i, 1); continue; }
        fgCtx.globalAlpha = p.life;
        fgCtx.fillStyle = p.col;
        fgCtx.beginPath(); fgCtx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); fgCtx.fill();
        fgCtx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawBg]);

  // Redraw bg when season changes
  useEffect(() => {
    const bg = bgRef.current;
    if (!bg) return;
    drawBg(bg, bg.width, bg.height, season);
  }, [seasonIdx, season, drawBg]);

  // Responsive resize
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const obs = new ResizeObserver(() => {
      const W = wrap.offsetWidth;
      const H = 360;
      [bgRef.current, fgRef.current].forEach((c) => {
        if (c) { c.width = W; c.height = H; }
      });
      if (bgRef.current) drawBg(bgRef.current, W, H, seasonRef.current);
      fireflyRef.current.forEach((f) => { f.x = Math.random() * W; });
    });
    obs.observe(wrap);
    return () => obs.disconnect();
  }, [drawBg]);

  // Canvas hover hit-detection
  const handleMouseMove = useCallback((e) => {
    const fg = fgRef.current;
    if (!fg) return;
    const rect = fg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const groundY = fg.height * 0.80;
    let found = null;
    const trees = allTreesRef.current;
    for (let i = trees.length - 1; i >= 0; i--) {
      const tree = trees[i];
      const gp = tree.growProgress !== undefined ? tree.growProgress : 1;
      const sc = tree.scale * gp;
      const tw = tree.def.baseW * sc;
      const th = tree.def.baseH * sc;
      const bx = tree.xFrac * fg.width;
      if (mx > bx - tw * 0.65 && mx < bx + tw * 0.65 && my > groundY - th && my < groundY + 12) {
        found = tree.id; break;
      }
    }
    hoveredIdRef.current = found;
    setHoveredId(found);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoveredIdRef.current = null;
    setHoveredId(null);
  }, []);

  const hoveredTree = hoveredId !== null ? baseTrees.find((t) => t.id === hoveredId) : null;

  return (
    <Card className="bg-slate-900 border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="p-6 flex items-center justify-between z-10 relative bg-slate-900/50 backdrop-blur-sm border-b border-white/5">
        <div>
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Your Ecosystem</h3>
          <p className="text-xs text-slate-500">Every rescue plants a memory in your forest.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSeasonIdx((s) => (s + 1) % SEASONS.length)}
            className="text-[11px] font-medium text-slate-500 hover:text-emerald-400 transition-colors px-3 py-1.5 rounded-full border border-white/5 hover:border-emerald-500/20"
          >
            {SEASONS[seasonIdx].label}
          </button>
          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
            {baseTrees.length} Milestones
          </Badge>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={wrapRef}
        className="relative"
        style={{ height: 360 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <canvas ref={bgRef} width={680} height={360} className="absolute inset-0 w-full h-full" />
        <canvas ref={fgRef} width={680} height={360} className="absolute inset-0 w-full h-full cursor-crosshair" />

        {/* Empty state */}
        {baseTrees.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            <Leaf className="w-16 h-16 mb-2 text-emerald-900/40" />
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-600/50">Your forest awaits</p>
            <p className="text-xs font-medium mt-1 text-emerald-900/40">Complete a rescue to plant your first seed.</p>
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredTree && (
          <div
            className="absolute z-20 pointer-events-none bg-slate-800/95 border border-emerald-500/30 rounded-xl px-4 py-2.5 shadow-xl"
            style={{
              left: `calc(${hoveredTree.xFrac * 100}% + 14px)`,
              bottom: "28%",
              transform: hoveredTree.xFrac > 0.75 ? "translateX(-110%)" : "translateX(0)",
            }}
          >
            <p className="text-sm font-bold text-emerald-400">{hoveredTree.def.label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{hoveredTree.def.detail}</p>
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="px-6 py-3 flex items-center border-t border-white/5 bg-slate-900/60">
        <p className="text-xs text-slate-600">
          <span className="text-slate-400 font-medium">{totalCombinedImpact}</span> total rescues · hover a tree to explore
        </p>
      </div>
    </Card>
  );
}