'use client';
import dynamic from 'next/dynamic';
import {useEffect, useRef, useState} from 'react';
import {BatteryCharging, Car, Check, HeartPulse, Pause, Play, RotateCcw, Thermometer, X} from 'lucide-react';
import type {Model, StreetMap} from './types';
import type {Shot} from './StreetScene';
import LoadChart from './LoadChart';
import {END, HEAT_BEATS, START, clock, sample, type Mode, type View} from './story';

const StreetScene = dynamic(() => import('./StreetScene'), {ssr: false, loading: () => <div className="sg-loading"><span className="loader"/>Building the Burbank block…</div>});
const SHOTS: Record<string, Shot> = {forecast: 'wide', street: 'focus', precool: 'focus', easeoff: 'close', share: 'share', result: 'result'};
const IDLE = -1;
type Compare = Mode | 'compare';

const easeInOut = (p: number) => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

export default function StreetDemo({map, model, run}: {map: StreetMap; model: Model; run: number}) {
  const [scenario] = useState('heat_wave');
  const [beat, setBeat] = useState(IDLE);       // IDLE, a beat index, or HEAT_BEATS.length once you're exploring
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(12.5);
  const [mode, setMode] = useState<Compare>('with');
  const [split, setSplit] = useState(0.5);
  const [home, setHome] = useState<number | null>(null);
  const [chartFor, setChartFor] = useState('B');
  const elapsed = useRef(0), beatRef = useRef(IDLE), stage = useRef<HTMLDivElement>(null);
  beatRef.current = beat;
  const beats = HEAT_BEATS;
  const exploring = beat >= beats.length;

  useEffect(() => {
    if (!playing) return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      elapsed.current += Math.min(0.1, (now - last) / 1000);
      last = now;
      let b = Math.max(0, beatRef.current);
      while (b < beats.length && elapsed.current >= beats[b].seconds) {elapsed.current -= beats[b].seconds; b++;}
      if (b >= beats.length) {
        setBeat(beats.length); setPlaying(false); setTime(beats[beats.length - 1].to); setMode('compare');
        return;
      }
      const current = beats[b];
      setBeat(b);
      setMode(current.split ? 'compare' : 'with');
      setTime(current.from + (current.to - current.from) * easeInOut(Math.min(1, elapsed.current / current.seconds)));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, beats]);

  const start = () => {elapsed.current = 0; setHome(null); setChartFor('B'); setSplit(0.5); setBeat(0); setPlaying(true);};
  useEffect(() => {if (run > 0) start();}, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  const togglePlay = () => {
    if (playing) setPlaying(false);
    else if (beat === IDLE || exploring) start();
    else setPlaying(true);
  };
  const explore = () => {setPlaying(false); setBeat(beats.length);};

  const s = model.scenarios[scenario];
  const current = beat >= 0 && beat < beats.length ? beats[beat] : null;
  const focus = current ? s.at_risk[0] ?? null : exploring ? chartFor : null;
  const viewMode: Mode = mode === 'compare' ? 'with' : mode;
  const view: View = {scenario, time, mode: viewMode, beat: current?.key ?? null, split: mode === 'compare' ? split : null, focus, selectedHome: home};
  const shot: Shot = beat === IDLE ? 'hero' : current ? SHOTS[current.key] : 'free';
  const temp = Math.round(current?.dayBefore ? s.peak_temp_f : sample(s.outdoor_f, model.hours, time));
  const summary = s.summary;
  const showNumbers = !!summary && (exploring || (current?.key === 'result' && elapsed.current > 3));

  const dragSplit = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = stage.current!.getBoundingClientRect();
    const move = (e: PointerEvent) => setSplit(Math.max(0.08, Math.min(0.92, (e.clientX - rect.left) / rect.width)));
    const up = () => {window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);};
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    event.preventDefault();
  };

  return <div className="sg-demo">
    <div className="sg-toolbar">
      <div className="sg-scenarios" role="group" aria-label="Scenario">
        <button className="active" aria-pressed="true">Heat wave <small>108°F</small></button>
      </div>
      <div className="sg-compare" role="group" aria-label="Compare with and without OurGrid">
        {(['without', 'compare', 'with'] as Compare[]).map(m => <button key={m} aria-pressed={mode === m} className={mode === m ? 'active' : ''}
          onClick={() => {if (!exploring) explore(); setMode(m);}}>{m === 'without' ? 'Without OurGrid' : m === 'with' ? 'With OurGrid' : 'Compare'}</button>)}
      </div>
    </div>

    <div className={`sg-stage ${beat === IDLE ? 'idle' : ''}`} ref={stage}>
      <StreetScene map={map} model={model} view={view} shot={shot}
        onSelectHome={i => {setHome(i); if (i !== null) {setChartFor(model.homes[i].transformer); if (!exploring && beat !== IDLE) explore();}}}
        onSelectTransformer={id => {setChartFor(id); setHome(null); if (!exploring && beat !== IDLE) explore();}}/>
      <div className="sg-clock" aria-live="off">
        {current?.dayBefore ? <><b>Tomorrow</b><span>{temp}°F forecast</span></> : <><b>{clock(time)}</b><span>{temp}°F</span></>}
      </div>
      {current && <div className="sg-caption" key={current.key} aria-live="polite">
        <span>{beat + 1} / {beats.length}</span>{current.caption}
      </div>}
      {mode === 'compare' && <>
        <div className="sg-side left" style={{right: `${(1 - split) * 100}%`}}>Without OurGrid</div>
        <div className="sg-side right" style={{left: `${split * 100}%`}}>With OurGrid</div>
        <div className="sg-divider" style={{left: `${split * 100}%`}} onPointerDown={dragSplit} role="slider" aria-label="Compare without and with OurGrid"
          aria-valuemin={8} aria-valuemax={92} aria-valuenow={Math.round(split * 100)} tabIndex={0}
          onKeyDown={e => {if (e.key === 'ArrowLeft') setSplit(v => Math.max(0.08, v - 0.05)); if (e.key === 'ArrowRight') setSplit(v => Math.min(0.92, v + 0.05));}}><i/></div>
      </>}
      {showNumbers && summary && <div className="sg-numbers">
        <div><b>{summary.peak_without}% → {summary.peak_with}%</b><span>Transformer {summary.transformer} peak</span></div>
        <div><b>{summary.medical_adjusted}</b><span>Medical homes adjusted</span></div>
        <div><b>{summary.kept_power_with} of {summary.homes}</b><span>Homes that kept power</span></div>
      </div>}
      {home !== null && <HomeCard model={model} scenario={scenario} index={home} mode={viewMode} onClose={() => setHome(null)}/>}
      {beat === IDLE && <button className="sg-run" onClick={start}><Play size={16} fill="currentColor"/>Run the demo</button>}
    </div>

    <div className="sg-controls">
      <button className="sg-play" onClick={togglePlay} aria-label={playing ? 'Pause' : exploring ? 'Replay the demo' : 'Play'}>
        {playing ? <Pause size={16} fill="currentColor"/> : exploring ? <RotateCcw size={16}/> : <Play size={16} fill="currentColor"/>}
      </button>
      <input type="range" min={START} max={END} step={0.05} value={time} aria-label="Time of day"
        onChange={e => {explore(); setTime(Number(e.target.value));}}/>
      <span className="sg-time">{clock(time)}</span>
    </div>
    <LoadChart model={model} scenario={scenario} transformer={chartFor} time={time} beat={current?.key ?? null} mode={viewMode} compare={mode === 'compare'}/>
    <p className="sg-disclaimer">{model.disclaimer}</p>
  </div>;
}

function HomeCard({model, scenario, index, mode, onClose}: {model: Model; scenario: string; index: number; mode: Mode; onClose: () => void}) {
  const home = model.homes[index];
  const s = model.scenarios[scenario];
  const series = s.homes[index];
  const street = model.transformers.find(t => t.id === home.transformer)!.street;
  const acting = s.at_risk.includes(home.transformer);
  const share = s.share;
  const did: string[] = [];
  if (acting && mode === 'with') {
    if (home.medical) did.push('Never adjusted: thermostat, devices and backup left alone.');
    else {
      if (series.mode.includes('p')) did.push(`Pre-cooled to ${model.settings.precool_f}°F from 1 to 4 PM.`);
      if (series.mode.includes('e')) did.push(`Eased off from 5 to 8 PM, drifting back to ${model.settings.normal_f}°F.`);
      if (series.ev && series.ev.with.findIndex(v => v > 0) > series.ev.without.findIndex(v => v > 0)) did.push('EV charging moved to 10 PM.');
      if (series.battery) did.push('Battery covered the home from 5 to 8 PM.');
      if (series.share) did.push(`Shared ${(series.share.reduce((a, b) => a + b, 0) * 0.25).toFixed(2)} kWh with the medical home at 6 PM.`);
      if (!did.length) did.push('Not dispatched: no smart thermostat.');
    }
  } else if (acting) did.push('Without OurGrid: nothing is coordinated and the transformer fails.');
  else did.push(`No action needed: Transformer ${home.transformer} stays under its limit.`);
  const credit = home.medical && share?.recipient === index && mode === 'with';
  return <aside className="sg-home" aria-label={`Home ${home.id}`}>
    <button className="sg-close" onClick={onClose} aria-label="Close"><X size={14}/></button>
    <h3>Home {home.id}{home.medical && <span className="sg-tag medical"><HeartPulse size={12}/>Medical</span>}</h3>
    <p className="sg-sub">{street} · Transformer {home.transformer}</p>
    <ul className="sg-devices">
      {home.thermostat && <li><Thermometer size={13}/>Smart thermostat</li>}
      {home.ev && <li><Car size={13}/>EV</li>}
      {home.battery && <li><BatteryCharging size={13}/>Home battery</li>}
      {home.medical && <li><HeartPulse size={13}/>{home.medical.need} · {home.medical.resident.toLowerCase()}</li>}
    </ul>
    <h4>What OurGrid did</h4>
    <ul className="sg-did">{did.map(d => <li key={d}><Check size={12}/>{d}</li>)}</ul>
    {credit && share && <div className="sg-ledger">
      <h4>Neighbor approvals</h4>
      {share.suppliers.map(i => <div key={i}><Check size={12}/>{model.homes[i].id} approved sharing <b>{(s.homes[i].share!.reduce((a, b) => a + b, 0) * 0.25).toFixed(2)} kWh</b></div>)}
      <div className="sg-credit-line">Bill credit <b>+{share.kwh.toFixed(1)} kWh</b> at the demo base rate (${model.base_rate.toFixed(2)}/kWh) = <b>${share.credit_usd.toFixed(2)}</b></div>
      <p>Sharing is a bill credit, not extra supply or a physical wire between homes.</p>
    </div>}
  </aside>;
}
