'use client';
import dynamic from 'next/dynamic';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Pause, Play, RotateCcw, ThermometerSun} from 'lucide-react';
import type {CareMap, CareShot, CareView} from './CareScene';
import {DAY_BEFORE, HEAT_BEATS, LADDER, ORDINARY_BEATS, clockLabel, initialHours, ladderLit, numbers, ordinaryState, outageEnd, patientState, priority, temperature, timeline, type Care, type Mode} from './logic';

const CareScene = dynamic(() => import('./CareScene'), {ssr: false, loading: () => <div className="sg-loading"><span className="loader"/>Building North Hollywood…</div>});
const SHOTS: Record<string, CareShot> = {forecast: 'wide', rank: 'wide', checkin: 'wide', escalate: 'wide', backup: 'wide', outage: 'street', ladder: 'street', result: 'street', sweep: 'wide', scheduled: 'wide'};
const IDLE = -1;
type Compare = Mode | 'compare';
const easeInOut = (p: number) => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const ladderTime = (e: number, keys: [number, number][]) => {
  for (let i = 1; i < keys.length; i++) if (e <= keys[i][0]) return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * easeInOut((e - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
  return keys[keys.length - 1][1];
};
const STATUS_TEXT: Record<string, string> = {sent: 'Check-in sent', confirmed: 'Backup confirmed', scheduled: 'Replacement scheduled', warning: 'Battery warning', flagged: 'Needs a battery', calling: 'Coordinator calling', delivered: 'Battery delivered', swapped: 'Battery swapped', tanks: 'Oxygen tanks', moved: 'At cooling center', ambulance: '911 call', alert: 'Generic alert only'};

export default function CareDemo({map, care, run}: {map: CareMap; care: Care; run: number}) {
  const plan = useMemo(() => timeline(care), [care]);
  // Pace the ladder so each step gets its own few seconds: [seconds into the beat, story time].
  const ladderKeys = useMemo(() => {
    const at = (key: string) => Object.entries(plan.ladder).find(([id]) => care.patients.find(p => p.id === id)?.ladder === key)?.[1] ?? care.outage.start + 2;
    return [[0, care.outage.start + 0.45], [5, at('swap') + 0.1], [10, at('cylinders') + 0.1], [16, at('move') + 0.12], [22, at('move') + 1.4]] as [number, number][];
  }, [plan, care]);
  const nums = useMemo(() => numbers(care), [care]);
  const [scenario, setScenario] = useState<'heat' | 'ordinary'>('heat');
  const beats = scenario === 'ordinary' ? ORDINARY_BEATS : HEAT_BEATS;
  const [beat, setBeat] = useState(IDLE);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(DAY_BEFORE);
  const [mode, setMode] = useState<Compare>('with');
  const [split, setSplit] = useState(0.5);
  const [selected, setSelected] = useState<string | null>(null);
  const elapsed = useRef(0), beatRef = useRef(IDLE), stage = useRef<HTMLDivElement>(null), dragged = useRef(false);
  beatRef.current = beat;
  const exploring = beat >= beats.length;
  const end = outageEnd(care);

  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      elapsed.current += Math.min(0.1, (now - last) / 1000);
      last = now;
      let b = Math.max(0, beatRef.current);
      while (b < beats.length && elapsed.current >= beats[b].seconds) {elapsed.current -= beats[b].seconds; b++;}
      if (b >= beats.length) {const last = beats[beats.length - 1]; setBeat(beats.length); setPlaying(false); setTime(last.to); setMode(last.split ? 'compare' : 'with'); return;}
      const current = beats[b];
      setBeat(b);
      setMode(current.split ? 'compare' : 'with');
      if (current.split && !dragged.current) {
        const e = elapsed.current;
        setSplit(e < 1.6 ? 0.82 - 0.64 * easeInOut(e / 1.6) : e < 2.8 ? 0.18 + 0.32 * easeInOut((e - 1.6) / 1.2) : 0.5);
      }
      setTime(current.key === 'ladder' ? ladderTime(elapsed.current, ladderKeys) : current.from + (current.to - current.from) * easeInOut(Math.min(1, elapsed.current / current.seconds)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, beats]);

  const start = (from = beats[0].from) => {elapsed.current = 0; beatRef.current = 0; dragged.current = false; setSelected(null); setSplit(0.5); setMode('with'); setTime(from); setBeat(0); setPlaying(true);};
  const choose = (key: 'heat' | 'ordinary') => {setScenario(key); start(key === 'ordinary' ? ORDINARY_BEATS[0].from : HEAT_BEATS[0].from);};
  useEffect(() => {if (run > 0) start();}, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  const explore = () => {setPlaying(false); setBeat(beats.length);};
  const togglePlay = () => {if (playing) setPlaying(false); else if (beat === IDLE || exploring) start(); else setPlaying(true);};
  void initialHours;

  const current = beat >= 0 && beat < beats.length ? beats[beat] : null;
  const viewMode: Mode = mode === 'compare' ? 'with' : mode;
  const ordinary = scenario === 'ordinary';
  const risk = ordinary ? 0 : current?.key === 'forecast' ? Math.min(1, elapsed.current / 3) : beat === IDLE ? 0 : 1;
  const view: CareView = {time, mode: ordinary ? 'with' : viewMode, beat: current?.key ?? null, split: mode === 'compare' && !ordinary ? split : null, selected, risk, scenario};
  const shot: CareShot = beat === IDLE ? 'wide' : current ? SHOTS[current.key] : 'free';
  const clock = clockLabel(care, time, scenario);
  const lit = ladderLit(plan, care, time);
  const caption = current?.key === 'ladder' ? LADDER[elapsed.current < 5 ? 0 : elapsed.current < 10 ? 1 : elapsed.current < 16 ? 2 : 3].caption : current?.caption;
  const showLadder = !ordinary && (current?.key === 'ladder' || current?.key === 'result' || (exploring && time >= care.outage.start));
  const showNumbers = !ordinary && (exploring || (current?.key === 'result' && elapsed.current > 2.5));
  const plansDone = ordinary && time >= 35.4;
  const ranked = care.patients.map(p => ({p, s: ordinary ? ordinaryState(care, p, time) : patientState(care, plan, p, viewMode, time)}))
    .filter(r => !r.s.moved || true)
    .sort((a, b) => priority(care, b.p, b.s.countdown ?? b.s.hours) - priority(care, a.p, a.s.countdown ?? a.s.hours));
  const showList = beat !== IDLE && current?.key !== 'forecast';

  const dragSplit = (event: React.PointerEvent<HTMLDivElement>) => {
    dragged.current = true;
    const rect = stage.current!.getBoundingClientRect();
    const move = (e: PointerEvent) => setSplit(Math.max(0.08, Math.min(0.92, (e.clientX - rect.left) / rect.width)));
    const up = () => {window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);};
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    event.preventDefault();
  };

  return <div className="sg-demo cg-demo">
    <div className="sg-toolbar">
      <div className="sg-scenarios" role="group" aria-label="Scenario">
        <button className={scenario === 'heat' ? 'active' : ''} aria-pressed={scenario === 'heat'} onClick={() => choose('heat')}>Heat wave <small>Los Angeles</small></button>
        <button className={scenario === 'ordinary' ? 'active' : ''} aria-pressed={scenario === 'ordinary'} onClick={() => choose('ordinary')}>Ordinary day</button>
        <button disabled title="Coming soon">India <small>Delhi</small></button>
      </div>
      <div className="sg-compare" role="group" aria-label="Compare with and without OurGrid">
        {(['without', 'compare', 'with'] as Compare[]).map(m => <button key={m} aria-pressed={mode === m} className={mode === m ? 'active' : ''}
          onClick={() => {if (!exploring) explore(); setMode(m);}}>{m === 'without' ? 'Without OurGrid' : m === 'with' ? 'With OurGrid' : 'Compare'}</button>)}
      </div>
    </div>
    <div className="cg-layout">
      <div className={`sg-stage ${beat === IDLE ? 'idle' : ''}`} ref={stage}>
        <CareScene map={map} care={care} plan={plan} view={view} shot={shot} onSelect={id => {setSelected(id); if (id && !exploring && beat !== IDLE) explore();}}/>
        <div className="sg-clock cg-clock"><b>{clock.day} · {clock.time}</b><span>{ordinary ? 'No heat warning' : time < 24 ? 'Forecast 106°F' : `${temperature(time)}°F`}{clock.outage ? ` · ${clock.outage}` : ''}</span></div>
        {plansDone && <div className="cg-plans">Emergency plans up to date: <b>{care.patients.length}/{care.patients.length}</b></div>}
        {current?.key === 'forecast' && <div className="cg-warning"><ThermometerSun size={20}/><div><b>Heat warning</b><span>Tomorrow 106°F</span></div></div>}
        {caption && <div className="sg-caption" key={caption}><span>{beat + 1} / {beats.length}</span>{caption}</div>}
        {showLadder && viewMode === 'with' && mode !== 'compare' || showLadder && mode === 'compare' ? <ol className="cg-ladder" aria-label="Escalation ladder">
          {LADDER.map((step, i) => <li key={step.key} className={lit[i] ? 'lit' : step.key === '911' ? 'last' : ''}><b>{step.label}</b><span>{step.action}</span></li>)}
        </ol> : null}
        {mode === 'compare' && <>
          <div className="sg-side left" style={{right: `${(1 - split) * 100}%`}}>Without OurGrid</div>
          <div className="sg-side right" style={{left: `${split * 100}%`}}>With OurGrid</div>
          <div className="sg-divider" style={{left: `${split * 100}%`}} onPointerDown={dragSplit} role="slider" aria-label="Compare without and with OurGrid" aria-valuenow={Math.round(split * 100)} tabIndex={0}
            onKeyDown={e => {dragged.current = true; if (e.key === 'ArrowLeft') setSplit(v => Math.max(0.08, v - 0.05)); if (e.key === 'ArrowRight') setSplit(v => Math.min(0.92, v + 0.05));}}><i/></div>
        </>}
        {showNumbers && <div className="sg-numbers cg-numbers">
          <div><b>{nums.charged.before}% → {nums.charged.after}%</b><span>High-risk patients with charged backup before the heat alert</span></div>
          <div><b>{nums.reached.count} of {nums.reached.of}</b><span>Non-responders reached by a person, within 2 hours</span></div>
          <div><b>{nums.calls911.without} → {nums.calls911.with}</b><span>Patients told to call 911</span></div>
        </div>}
        {beat === IDLE && <button className="sg-run" onClick={() => start()}><Play size={16} fill="currentColor"/>Run the demo</button>}
      </div>
      <aside className={`cg-panel ${showList ? '' : 'muted'}`} aria-label="Patients ranked by hours of safe power left">
        <h3>Patients, ranked <small>{viewMode === 'with' ? 'with OurGrid' : 'without OurGrid'}</small></h3>
        {(['red', 'amber', 'green'] as const).map(tier => {
          const rows = ranked.filter(r => r.s.tier === tier);
          return <section key={tier} className={`cg-tier ${tier}`}>
            <h4>{tier === 'red' ? 'Tier 1 · under 4 h, high-risk street' : tier === 'amber' ? 'Tier 2 · 4–12 h' : 'Tier 3 · 12 h or more'} <span>{showList ? rows.length : '–'}</span></h4>
            {showList && <ul>{rows.map(({p, s}) => <li key={p.id} className={selected === p.id ? 'selected' : ''} onClick={() => {setSelected(p.id); if (!exploring) explore();}}>
              <b>{p.id}</b><span>{care.devices[p.device].label} · {p.age}</span>
              <em>{s.moved ? 'safe' : `${(s.countdown ?? s.hours) >= 10 ? Math.round(s.countdown ?? s.hours) : (s.countdown ?? s.hours).toFixed(1)} h`}</em>
              {s.status !== 'none' && <i className={`cg-tag ${s.status}`}>{s.status === 'warning' ? s.note : ordinary && s.status === 'confirmed' ? 'Backup checked' : STATUS_TEXT[s.status]}</i>}
            </li>)}</ul>}
          </section>;
        })}
        {!showList && <p className="cg-hint">Run the demo to rank every patient by hours of safe power left.</p>}
      </aside>
    </div>
    <div className="sg-controls cg-controls">
      <button className="sg-play" onClick={togglePlay} aria-label={playing ? 'Pause' : exploring ? 'Replay' : 'Play'}>
        {playing ? <Pause size={16} fill="currentColor"/> : exploring ? <RotateCcw size={16}/> : <Play size={16} fill="currentColor"/>}
      </button>
      <span className="cg-end">{ordinary ? '10 AM' : 'Day before'}</span>
      <input type="range" min={ordinary ? 34 : DAY_BEFORE} max={ordinary ? 35.8 : end} step={0.01} value={time} aria-label="Time" onChange={e => {explore(); setTime(Number(e.target.value));}}/>
      <span className="cg-end">{ordinary ? 'Noon' : 'Outage + 12 h'}</span>
    </div>
    <p className="sg-disclaimer">{care.disclaimer} Map data © OpenStreetMap contributors.</p>
  </div>;
}

export {initialHours};
