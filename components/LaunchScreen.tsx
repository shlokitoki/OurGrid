'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowRight, Play, RotateCcw, Zap} from 'lucide-react';

type Phase = 'idle' | 'hook' | 'benefits' | 'final';

const HOOK = 'Smarter grids.';
const BENEFITS = [
  'Optimize neighborhood electricity consumption',
  'Lower household electricity bills',
  'Unlock the value of neighborhood energy',
  'Protect the people who need electricity most',
  'Reduce the risk of preventable blackouts',
  'Make communities more resilient',
];

const ROWS = 18;
const COLS = 26;
const VIEW_W = 1536;
const VIEW_H = 1056;
const GLOW_RADIUS = 260;
const meshPoints = Array.from({length: ROWS}, (_, row) =>
  Array.from({length: COLS}, (_, col) => ({
    x: Math.round(col * 64 - 34 + Math.sin(row * .77 + col * .46) * 12),
    y: Math.round(row * 62 - 24 + Math.cos(col * .62 + row * .35) * 10),
  }))
);
const nodeSites = meshPoints.flatMap((row, r) => row.flatMap((_, c) => (r + c) % 3 === 0 ? [{row: r, col: c, radius: (r + c) % 6 === 0 ? 2.35 : 1.5}] : []));
type MeshPoint = {x: number; y: number};

export default function LaunchScreen({onEnter}: {onEnter: () => void}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [typed, setTyped] = useState('');
  const [benefit, setBenefit] = useState(0);
  const screenRef = useRef<HTMLElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);

  // The grid and its cursor glow are drawn on two canvases. The earlier SVG
  // version rewrote full-screen paths every frame under a moving CSS mask,
  // drop-shadow filters and a drift animation, which flickered in Chrome.
  useEffect(() => {
    const screen = screenRef.current, base = baseRef.current, glow = glowRef.current, aura = auraRef.current;
    const baseCtx = base?.getContext('2d'), glowCtx = glow?.getContext('2d');
    if (!screen || !base || !glow || !aura || !baseCtx || !glowCtx) return;
    let width = 0, height = 0, dpr = 1, scale = 1, offsetX = 0, offsetY = 0;
    const toCanvas = (point: MeshPoint) => [offsetX + point.x * scale, offsetY + point.y * scale] as const;
    const drawBase = (points: MeshPoint[][]) => {
      baseCtx.clearRect(0, 0, width, height);
      baseCtx.beginPath();
      for (const row of points) row.forEach((point, col) => {const [x, y] = toCanvas(point); if (col) baseCtx.lineTo(x, y); else baseCtx.moveTo(x, y);});
      for (let col = 0; col < COLS; col++) points.forEach((row, r) => {const [x, y] = toCanvas(row[col]); if (r) baseCtx.lineTo(x, y); else baseCtx.moveTo(x, y);});
      baseCtx.globalAlpha = .34; baseCtx.strokeStyle = '#9fc2aa'; baseCtx.lineWidth = 1.15 * scale; baseCtx.stroke();
      baseCtx.beginPath();
      for (const {row, col, radius} of nodeSites) {const [x, y] = toCanvas(points[row][col]); baseCtx.moveTo(x + radius * scale, y); baseCtx.arc(x, y, radius * scale, 0, Math.PI * 2);}
      baseCtx.globalAlpha = .38; baseCtx.fillStyle = '#78a788'; baseCtx.fill();
      baseCtx.globalAlpha = 1;
    };
    // Only segments near the cursor are drawn, then faded with the same radial falloff the CSS mask used.
    const drawGlow = (points: MeshPoint[][], cx: number, cy: number, alpha: number) => {
      glowCtx.clearRect(0, 0, width, height);
      if (alpha < .002) return;
      const reach = GLOW_RADIUS + 40;
      const near = (x: number, y: number) => Math.abs(x - cx) < reach && Math.abs(y - cy) < reach;
      glowCtx.save();
      glowCtx.beginPath(); glowCtx.rect(cx - GLOW_RADIUS, cy - GLOW_RADIUS, GLOW_RADIUS * 2, GLOW_RADIUS * 2); glowCtx.clip();
      glowCtx.beginPath();
      const segment = (a: MeshPoint, b: MeshPoint) => {const [ax, ay] = toCanvas(a), [bx, by] = toCanvas(b); if (near(ax, ay) || near(bx, by)) {glowCtx.moveTo(ax, ay); glowCtx.lineTo(bx, by);}};
      for (let r = 0; r < ROWS; r++) for (let c = 1; c < COLS; c++) segment(points[r][c - 1], points[r][c]);
      for (let c = 0; c < COLS; c++) for (let r = 1; r < ROWS; r++) segment(points[r - 1][c], points[r][c]);
      glowCtx.globalAlpha = .85; glowCtx.lineCap = 'round'; glowCtx.strokeStyle = '#3eaf71'; glowCtx.lineWidth = 2.4 * scale;
      glowCtx.shadowColor = '#67d492'; glowCtx.shadowBlur = 5 * scale * dpr; glowCtx.stroke();
      glowCtx.beginPath();
      for (const {row, col, radius} of nodeSites) {const [x, y] = toCanvas(points[row][col]); if (near(x, y)) {glowCtx.moveTo(x + radius * scale, y); glowCtx.arc(x, y, radius * scale, 0, Math.PI * 2);}}
      glowCtx.globalAlpha = 1; glowCtx.fillStyle = '#319b61'; glowCtx.shadowColor = '#4dc47d'; glowCtx.shadowBlur = 7 * scale * dpr; glowCtx.fill();
      const mask = glowCtx.createRadialGradient(cx, cy, 0, cx, cy, GLOW_RADIUS);
      mask.addColorStop(0, '#000'); mask.addColorStop(.35, 'rgba(0,0,0,.6)'); mask.addColorStop(.78, 'rgba(0,0,0,0)');
      glowCtx.shadowBlur = 0; glowCtx.globalCompositeOperation = 'destination-in'; glowCtx.globalAlpha = alpha; glowCtx.fillStyle = mask;
      glowCtx.fillRect(cx - GLOW_RADIUS, cy - GLOW_RADIUS, GLOW_RADIUS * 2, GLOW_RADIUS * 2);
      glowCtx.restore();
    };
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0, strength = 0, active = false, running = false, frame = 0, last = 0;
    let drawnX = 0, drawnY = 0, drawnStrength = 0, dirty = true;
    const resize = () => {
      width = base.offsetWidth; height = base.offsetHeight;
      if (!width || !height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const canvas of [base, glow]) {canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);}
      baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0); glowCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scale = Math.max(width / VIEW_W, height / VIEW_H);
      offsetX = (width - VIEW_W * scale) / 2; offsetY = (height - VIEW_H * scale) / 2;
      dirty = true;
      if (!running) drawBase(meshPoints);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(base);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => observer.disconnect();
    const animate = (time: number) => {
      // Easing was tuned at ~30 updates per second; scale it so any refresh rate looks the same.
      const step = (last ? Math.min(time - last, 100) : 16.7) / 33.3;
      last = time;
      const beforeX = currentX, beforeY = currentY;
      const follow = 1 - .81 ** step;
      currentX += (targetX - currentX) * follow;
      currentY += (targetY - currentY) * follow;
      strength += ((active ? 1 : 0) - strength) * (1 - .86 ** step);
      const rect = base.getBoundingClientRect();
      const localX = (currentX - rect.left) * width / rect.width, localY = (currentY - rect.top) * height / rect.height;
      // A resting cursor only needs the occasional redraw as the grid drifts.
      if (dirty || Math.abs(localX - drawnX) + Math.abs(localY - drawnY) > .3 || Math.abs(strength - drawnStrength) > .002) {
        dirty = false; drawnX = localX; drawnY = localY; drawnStrength = strength;
        const screenRect = screen.getBoundingClientRect();
        aura.style.opacity = (strength * .7).toFixed(3);
        aura.style.transform = `translate3d(${currentX - screenRect.left}px,${currentY - screenRect.top}px,0)`;
        const cursorX = (localX - offsetX) / scale, cursorY = (localY - offsetY) / scale;
        const velocityX = (currentX - beforeX) * .45 / step, velocityY = (currentY - beforeY) * .45 / step;
        const warped = meshPoints.map(row => row.map(point => {
          const dx = cursorX - point.x, dy = cursorY - point.y;
          const distance = Math.hypot(dx, dy);
          const weight = Math.max(0, 1 - distance / 220) ** 2 * strength;
          const pull = 19 * weight / Math.max(distance, 1);
          return {x: point.x + dx * pull - velocityX * weight, y: point.y + dy * pull - velocityY * weight};
        }));
        drawBase(warped);
        drawGlow(warped, localX, localY, strength * .82);
      }
      if (active || strength > .008 || Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > .5) frame = requestAnimationFrame(animate);
      else {
        running = false; last = 0; dirty = true;
        drawBase(meshPoints);
        glowCtx.clearRect(0, 0, width, height);
        aura.style.opacity = '0';
      }
    };
    const start = () => {if (!running) {running = true; frame = requestAnimationFrame(animate);}};
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (!active && !running) {currentX = event.clientX; currentY = event.clientY;}
      targetX = event.clientX; targetY = event.clientY; active = true; start();
    };
    const leave = () => {active = false; start();};
    screen.addEventListener('pointermove', move);
    screen.addEventListener('pointerleave', leave);
    return () => {cancelAnimationFrame(frame); observer.disconnect(); screen.removeEventListener('pointermove', move); screen.removeEventListener('pointerleave', leave);};
  }, []);

  useEffect(() => {
    if (phase !== 'hook') return;
    setTyped('');
    const letterDuration = (41 * HOOK.length + 1500) / HOOK.length;
    let startTime: number | undefined;
    let shown = 0;
    let frame = 0;
    let hold: ReturnType<typeof setTimeout> | undefined;
    const advance = (time: number) => {
      startTime ??= time;
      const count = Math.min(HOOK.length, Math.floor((time - startTime) / letterDuration));
      if (count !== shown) {
        shown = count;
        setTyped(HOOK.slice(0, count));
      }
      if (count === HOOK.length) {
        hold = setTimeout(() => setPhase('benefits'), 1100);
      } else frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => {cancelAnimationFrame(frame); if (hold) clearTimeout(hold);};
  }, [phase]);

  useEffect(() => {
    if (phase !== 'benefits') return;
    setBenefit(0);
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      if (index === BENEFITS.length) {clearInterval(timer); setPhase('final');}
      else setBenefit(index);
    }, 1800);
    return () => clearInterval(timer);
  }, [phase]);

  const viewLaunch = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setBenefit(0);
    setTyped('');
    setPhase(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'final' : 'hook');
  };

  return <main ref={screenRef} className={`launch-screen launch-${phase}`} onClick={onEnter} aria-label="OurGrid launch page">
    <canvas ref={baseRef} className="launch-mesh" aria-hidden="true"/>
    <canvas ref={glowRef} className="launch-mesh launch-mesh-glow" aria-hidden="true"/>
    <div ref={auraRef} className="launch-field-aura" aria-hidden="true"/>
    <div className="launch-ambient launch-ambient-one" aria-hidden="true"/>
    <div className="launch-ambient launch-ambient-two" aria-hidden="true"/>
    <div className="launch-topline"><div className="launch-topbrand"><span className="launch-topbrand-mark"><Zap size={19} fill="currentColor"/></span><span>OurGrid</span></div><span className="launch-topnote"><i/> A neighborhood energy system</span></div>
    <div className="launch-body">
      {phase === 'idle' && <div className="launch-idle-copy">
        <div className="launch-eyebrow"><span/> A NEW WAY TO KEEP THE LIGHTS ON <span/></div>
        <h1>Power is closer<br/><em>than you think.</em></h1>
        <p>See how a neighborhood can use the energy it already has to protect what matters most.</p>
      </div>}
      {phase === 'hook' && <div className="launch-typing">
        <span className="launch-chapter">01 / THE POSSIBILITY</span>
        <h1 aria-label={HOOK}><span aria-hidden="true">{[...typed].map((letter, index) => <span className="launch-type-glyph" key={index}>{letter === ' ' ? '\u00a0' : letter}</span>)}</span><span className={`launch-cursor ${typed.length < HOOK.length ? 'is-typing' : ''}`} aria-hidden="true"/></h1>
      </div>}
      {phase === 'benefits' && <div className="launch-benefit-stage" key={benefit}>
        <span className="launch-chapter">02 / WHAT OURGRID MAKES POSSIBLE</span>
        <div className="launch-benefit-number">0{benefit + 1}<span> / 06</span></div>
        <h1>{BENEFITS[benefit]}</h1>
        <div className="launch-benefit-streak" aria-hidden="true"/>
        <div className="launch-benefit-dots" aria-hidden="true">{BENEFITS.map((_, i) => <span key={i} className={i === benefit ? 'active' : ''}/>)}</div>
      </div>}
      {phase === 'final' && <div className="launch-final-copy">
        <div className="launch-final-logo"><span className="launch-final-mark"><Zap size={42} fill="currentColor"/></span><span>OurGrid</span></div>
        <div className="launch-final-rule"/>
        <h1>Don't wait for the grid to fail.<br/><em>Prevent the next crisis before it happens.</em></h1>
      </div>}
    </div>
    <div className="launch-bottom">
      <div className="launch-actions">
        <button className="launch-view" onClick={viewLaunch}>{phase === 'final' ? <RotateCcw size={15}/> : <Play size={15} fill="currentColor"/>}{phase === 'final' ? 'Replay launch' : 'View Launch'}</button>
        <button className="launch-enter" onClick={(event) => {event.stopPropagation(); onEnter();}}>Click anywhere to enter <ArrowRight size={17}/></button>
      </div>
      <span className="launch-scroll-note">INTERACTIVE FLEET SIMULATOR <span>↗</span></span>
    </div>
  </main>;
}
