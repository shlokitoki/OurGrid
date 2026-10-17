'use client';

import {memo, useEffect, useRef, useState} from 'react';
import {ArrowRight, Play, RotateCcw, Zap} from 'lucide-react';

type Phase = 'idle' | 'hook' | 'benefits' | 'final';

const HOOK = 'Smarter energy, lower bills, and stronger communities.';
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
const meshPoints = Array.from({length: ROWS}, (_, row) =>
  Array.from({length: COLS}, (_, col) => ({
    x: Math.round(col * 64 - 34 + Math.sin(row * .77 + col * .46) * 12),
    y: Math.round(row * 62 - 24 + Math.cos(col * .62 + row * .35) * 10),
  }))
);
const nodeSites = meshPoints.flatMap((row, r) => row.flatMap((_, c) => (r + c) % 3 === 0 ? [{row: r, col: c, radius: (r + c) % 6 === 0 ? 2.35 : 1.5}] : []));
type MeshPoint = {x: number; y: number};
const pointText = (point: MeshPoint) => `${Math.round(point.x * 10) / 10},${Math.round(point.y * 10) / 10}`;
const linePath = (points: MeshPoint[][]) => [
  ...points.map(row => `M${row.map(pointText).join('L')}`),
  ...Array.from({length: COLS}, (_, col) => `M${points.map(row => pointText(row[col])).join('L')}`),
].join('');
const nodePath = (points: MeshPoint[][]) => nodeSites.map(({row, col, radius}) => {
  const {x, y} = points[row][col];
  return `M${Math.round((x - radius) * 10) / 10},${Math.round(y * 10) / 10}a${radius},${radius} 0 1,0 ${radius * 2},0a${radius},${radius} 0 1,0 -${radius * 2},0`;
}).join('');
const initialLines = linePath(meshPoints);
const initialNodes = nodePath(meshPoints);

const Mesh = memo(function Mesh({glow = false}: {glow?: boolean}) {
  return <svg className={glow ? 'launch-mesh launch-mesh-glow' : 'launch-mesh'} viewBox="0 0 1536 1056" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path className="launch-mesh-lines" d={initialLines}/>
    <path className="launch-mesh-nodes" d={initialNodes}/>
  </svg>;
});

export default function LaunchScreen({onEnter}: {onEnter: () => void}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [typed, setTyped] = useState('');
  const [benefit, setBenefit] = useState(0);
  const screenRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const screen = screenRef.current;
    const base = screen?.querySelector<SVGSVGElement>('.launch-mesh:not(.launch-mesh-glow)');
    const glow = screen?.querySelector<SVGSVGElement>('.launch-mesh-glow');
    if (!screen || !base || !glow || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const paths = [base, glow].map(svg => ({lines: svg.querySelector<SVGPathElement>('.launch-mesh-lines')!, nodes: svg.querySelector<SVGPathElement>('.launch-mesh-nodes')!}));
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0, strength = 0, active = false, running = false, frame = 0, last = 0;
    const animate = (time: number) => {
      if (time - last < 28) {frame = requestAnimationFrame(animate); return;}
      last = time;
      const beforeX = currentX, beforeY = currentY;
      currentX += (targetX - currentX) * .19;
      currentY += (targetY - currentY) * .19;
      strength += ((active ? 1 : 0) - strength) * .14;
      const screenRect = screen.getBoundingClientRect();
      const glowRect = glow.getBoundingClientRect();
      screen.style.setProperty('--field-x', `${currentX - screenRect.left}px`);
      screen.style.setProperty('--field-y', `${currentY - screenRect.top}px`);
      screen.style.setProperty('--mesh-field-x', `${currentX - glowRect.left}px`);
      screen.style.setProperty('--mesh-field-y', `${currentY - glowRect.top}px`);
      screen.style.setProperty('--field-glow-opacity', (strength * .82).toFixed(3));
      screen.style.setProperty('--field-aura-opacity', (strength * .7).toFixed(3));
      const matrix = base.getScreenCTM();
      if (matrix) {
        const cursor = new DOMPoint(currentX, currentY).matrixTransform(matrix.inverse());
        const velocityX = (currentX - beforeX) * .45, velocityY = (currentY - beforeY) * .45;
        const warped = meshPoints.map(row => row.map(point => {
          const dx = cursor.x - point.x, dy = cursor.y - point.y;
          const distance = Math.hypot(dx, dy);
          const weight = Math.max(0, 1 - distance / 220) ** 2 * strength;
          const pull = 19 * weight / Math.max(distance, 1);
          return {x: point.x + dx * pull - velocityX * weight, y: point.y + dy * pull - velocityY * weight};
        }));
        const lines = linePath(warped), nodes = nodePath(warped);
        paths.forEach(path => {path.lines.setAttribute('d', lines); path.nodes.setAttribute('d', nodes);});
      }
      if (active || strength > .008 || Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > .5) frame = requestAnimationFrame(animate);
      else {
        running = false;
        paths.forEach(path => {path.lines.setAttribute('d', initialLines); path.nodes.setAttribute('d', initialNodes);});
        screen.style.setProperty('--field-glow-opacity', '0');
        screen.style.setProperty('--field-aura-opacity', '0');
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
    return () => {cancelAnimationFrame(frame); screen.removeEventListener('pointermove', move); screen.removeEventListener('pointerleave', leave);};
  }, []);

  useEffect(() => {
    if (phase !== 'hook') return;
    const copy = HOOK;
    let position = 0;
    setTyped('');
    let hold: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      position += 1;
      setTyped(copy.slice(0, position));
      if (position >= copy.length) {
        clearInterval(timer);
        hold = setTimeout(() => setPhase('benefits'), 1100);
      }
    }, 41 + 1500 / copy.length);
    return () => {clearInterval(timer); if (hold) clearTimeout(hold);};
  }, [phase]);

  useEffect(() => {
    if (phase !== 'benefits') return;
    setBenefit(0);
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      if (index === BENEFITS.length) {clearInterval(timer); setPhase('final');}
      else setBenefit(index);
    }, 1200);
    return () => clearInterval(timer);
  }, [phase]);

  const viewLaunch = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setBenefit(0);
    setTyped('');
    setPhase(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'final' : 'hook');
  };

  return <main ref={screenRef} className={`launch-screen launch-${phase}`} onClick={onEnter} aria-label="GraceGrid launch page">
    <Mesh/>
    <Mesh glow/>
    <div className="launch-field-aura" aria-hidden="true"/>
    <div className="launch-ambient launch-ambient-one" aria-hidden="true"/>
    <div className="launch-ambient launch-ambient-two" aria-hidden="true"/>
    <div className="launch-topline"><div className="launch-topbrand"><span className="launch-topbrand-mark"><Zap size={19} fill="currentColor"/></span><span>GraceGrid <em>AI</em></span></div><span className="launch-topnote"><i/> A neighborhood energy system</span></div>
    <div className="launch-body">
      {phase === 'idle' && <div className="launch-idle-copy">
        <div className="launch-eyebrow"><span/> A NEW WAY TO KEEP THE LIGHTS ON <span/></div>
        <h1>Power is closer<br/><em>than you think.</em></h1>
        <p>See how a neighborhood can use the energy it already has to protect what matters most.</p>
      </div>}
      {phase === 'hook' && <div className="launch-typing">
        <span className="launch-chapter">01 / THE POSSIBILITY</span>
        <h1 aria-label={HOOK}><span aria-hidden="true">{typed}</span><span className="launch-cursor" aria-hidden="true"/></h1>
      </div>}
      {phase === 'benefits' && <div className="launch-benefit-stage" key={benefit}>
        <span className="launch-chapter">02 / WHAT GRACEGRID MAKES POSSIBLE</span>
        <div className="launch-benefit-number">0{benefit + 1}<span> / 06</span></div>
        <h1>{BENEFITS[benefit]}</h1>
        <div className="launch-benefit-streak" aria-hidden="true"/>
        <div className="launch-benefit-dots" aria-hidden="true">{BENEFITS.map((_, i) => <span key={i} className={i === benefit ? 'active' : ''}/>)}</div>
      </div>}
      {phase === 'final' && <div className="launch-final-copy">
        <div className="launch-final-logo"><span className="launch-final-mark"><Zap size={42} fill="currentColor"/></span><span>GraceGrid <em>AI</em></span></div>
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
