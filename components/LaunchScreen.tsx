'use client';

import {memo, useEffect, useState} from 'react';
import {ArrowRight, Play, RotateCcw, Zap} from 'lucide-react';

type Phase = 'idle' | 'hook' | 'question' | 'benefits' | 'final';

const HOOK = 'Smarter energy, lower bills, and stronger communities.';
const QUESTION = 'What if the energy your neighborhood needs is already next door?';
const BENEFITS = [
  'Optimize neighborhood electricity consumption',
  'Lower household electricity bills',
  'Unlock the value of neighborhood energy',
  'Protect the people who need electricity most',
  'Reduce the risk of preventable blackouts',
  'Make communities more resilient',
];

const meshPoint = (row: number, col: number) => ({
  x: Math.round(col * 96 - 48 + Math.sin(row * 0.8 + col * 0.52) * 19),
  y: Math.round(row * 88 - 36 + Math.cos(col * 0.7 + row * 0.37) * 15),
});

const horizontal = Array.from({length: 13}, (_, row) =>
    Array.from({length: 18}, (_, col) => meshPoint(row, col)).map(({x, y}) => `${x},${y}`).join(' ')
);
const vertical = Array.from({length: 18}, (_, col) =>
    Array.from({length: 13}, (_, row) => meshPoint(row, col)).map(({x, y}) => `${x},${y}`).join(' ')
);
const nodes = Array.from({length: 13}, (_, row) => Array.from({length: 18}, (_, col) => ({...meshPoint(row, col), key: `${row}-${col}`, radius: (row + col) % 5 === 0 ? 2.2 : 1.25}))).flat();

const Mesh = memo(function Mesh({glow = false}: {glow?: boolean}) {
  return <svg className={glow ? 'launch-mesh launch-mesh-glow' : 'launch-mesh'} viewBox="0 0 1536 1056" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <g className="launch-mesh-lines">{horizontal.map((points, i) => <polyline key={`h${i}`} points={points}/>)}{vertical.map((points, i) => <polyline key={`v${i}`} points={points}/>)}</g>
    <g className="launch-mesh-nodes">{nodes.map(({key, x, y, radius}) => <circle key={key} cx={x} cy={y} r={radius}/>)}</g>
  </svg>;
});

export default function LaunchScreen({onEnter}: {onEnter: () => void}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [typed, setTyped] = useState('');
  const [benefit, setBenefit] = useState(0);

  useEffect(() => {
    if (phase !== 'hook' && phase !== 'question') return;
    const copy = phase === 'hook' ? HOOK : QUESTION;
    const next: Phase = phase === 'hook' ? 'question' : 'benefits';
    let position = 0;
    setTyped('');
    let hold: ReturnType<typeof setTimeout> | undefined;
    const timer = setInterval(() => {
      position += 1;
      setTyped(copy.slice(0, position));
      if (position >= copy.length) {
        clearInterval(timer);
        hold = setTimeout(() => setPhase(next), phase === 'hook' ? 1100 : 1350);
      }
    }, phase === 'hook' ? 41 : 36);
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
    }, 1950);
    return () => clearInterval(timer);
  }, [phase]);

  const viewLaunch = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setBenefit(0);
    setTyped('');
    setPhase(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'final' : 'hook');
  };

  const moveField = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'touch') return;
    const screen = event.currentTarget;
    const bounds = screen.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    screen.style.setProperty('--field-x', `${x}px`);
    screen.style.setProperty('--field-y', `${y}px`);
    screen.style.setProperty('--mesh-field-x', `${x + bounds.width * .04}px`);
    screen.style.setProperty('--mesh-field-y', `${y + bounds.height * .04}px`);
    screen.dataset.fieldActive = 'true';
  };

  return <main className={`launch-screen launch-${phase}`} onClick={onEnter} onPointerMove={moveField} onPointerLeave={event => {event.currentTarget.dataset.fieldActive = 'false';}} aria-label="GraceGrid launch page">
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
      {(phase === 'hook' || phase === 'question') && <div className="launch-typing" key={phase}>
        <span className="launch-chapter">{phase === 'hook' ? '01 / THE POSSIBILITY' : '02 / THE QUESTION'}</span>
        <h1 aria-label={phase === 'hook' ? HOOK : QUESTION}><span aria-hidden="true">{typed}</span><span className="launch-cursor" aria-hidden="true"/></h1>
      </div>}
      {phase === 'benefits' && <div className="launch-benefit-stage" key={benefit}>
        <span className="launch-chapter">03 / WHAT GRACEGRID MAKES POSSIBLE</span>
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
