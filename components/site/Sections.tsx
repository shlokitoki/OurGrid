'use client';
import dynamic from 'next/dynamic';
import {Ban, BatteryCharging, Check, Minus, Moon, Play, Snowflake, Sun, Users, X} from 'lucide-react';
import type {Model, StreetMap} from '../street/types';
import type {View} from '../street/story';
import StreetDemo from '../street/StreetDemo';

const StreetScene = dynamic(() => import('../street/StreetScene'), {ssr: false});
const HERO_VIEW: View = {scenario: 'heat_wave', time: 16, mode: 'without', beat: null, split: null, focus: null, selectedHome: null};
const ignore = () => {};
// Contact for the utility pilot. Replace with the team's address before sharing widely.
const CONTACT = 'mailto:?subject=OurGrid%20transformer%20pilot';

export function Hero({map, model, onRun}: {map: StreetMap | null; model: Model | null; onRun: () => void}) {
  return <section className="og-hero" aria-labelledby="hero-title">
    <div className="og-hero-scene" aria-hidden="true">
      {map && model && <StreetScene map={map} model={model} view={HERO_VIEW} shot="hero" onSelectHome={ignore} onSelectTransformer={ignore}/>}
    </div>
    <div className="og-hero-copy">
      <div className="og-pillars"><span>Predict &amp; shift</span><span>Protect</span><span>Share</span></div>
      <h1 id="hero-title">Keep the lights on for the neighbors who can't afford to lose them.</h1>
      <button className="og-run" onClick={onRun}><Play size={17} fill="currentColor"/>Run the demo</button>
    </div>
  </section>;
}

export function DemoSection({map, model, run}: {map: StreetMap | null; model: Model | null; run: number}) {
  const homes = model?.homes ?? [];
  const count = (key: 'thermostat' | 'ev' | 'battery') => homes.filter(h => h[key]).length;
  return <section className="og-section" id="demo" aria-labelledby="demo-title">
    <div className="og-section-head">
      <span className="og-eyebrow">How we work</span>
      <h2 id="demo-title">One Burbank street on a 108°F day.</h2>
      {model && <p>{homes.length} homes on N Fairview and N Niagara St, served by Burbank Water and Power. {count('thermostat')} smart thermostats, {count('ev')} EVs, {count('battery')} home batteries.</p>}
    </div>
    {map && model ? <StreetDemo map={map} model={model} run={run}/> : <div className="sg-stage"><div className="sg-loading"><span className="loader"/>Loading the Burbank block…</div></div>}
  </section>;
}

export function WhenWeShare() {
  const cards = [
    {icon: <Sun size={20}/>, title: 'Heat-wave evening', text: "Spare battery power is credited to a medical home's bill at the base rate.", tone: 'warm'},
    {icon: <BatteryCharging size={20}/>, title: 'Outage', text: 'Portable batteries and EVs go to medical homes first.', tone: 'green'},
    {icon: <Ban size={20}/>, title: 'Never', text: 'Wiring homes together, or sharing over power lines that are down.', tone: 'red'},
  ];
  return <section className="og-section" id="share" aria-labelledby="share-title">
    <div className="og-section-head"><span className="og-eyebrow">When we share</span><h2 id="share-title">Neighbors help, on their terms.</h2></div>
    <div className="og-cards">{cards.map(c => <article key={c.title} className={`og-card ${c.tone}`}><span className="og-card-icon">{c.icon}</span><h3>{c.title}</h3><p>{c.text}</p></article>)}</div>
  </section>;
}

export function HowWeOptimize() {
  const steps = [
    {icon: <Snowflake size={20}/>, title: 'Pre-cool', when: '1–4 PM', text: "Cool homes while there's room."},
    {icon: <Moon size={20}/>, title: 'Ease off', when: '5–8 PM', text: 'Homes drift back; EVs wait.'},
    {icon: <Users size={20}/>, title: 'Share', when: '6 PM', text: 'Batteries credit the medical home.'},
  ];
  return <section className="og-section" id="optimize" aria-labelledby="optimize-title">
    <div className="og-section-head"><span className="og-eyebrow">How we optimize</span><h2 id="optimize-title">Move the peak, not the comfort.</h2></div>
    <ol className="og-steps">{steps.map((s, i) => <li key={s.title}>
      <span className="og-step-icon">{s.icon}</span>
      <div><h3>{s.title} <small>{s.when}</small></h3><p>{s.text}</p></div>
      {i < steps.length - 1 && <span className="og-step-arrow" aria-hidden="true">→</span>}
    </li>)}</ol>
  </section>;
}

type Cell = boolean | string;
const ROWS: {label: string; cells: Cell[]}[] = [
  {label: 'Targets one overloaded transformer', cells: [true, false, false, false]},
  {label: 'Protects medical homes by design', cells: [true, false, false, false]},
  {label: 'Neighbors share at the base rate', cells: [true, false, false, false]},
  {label: 'Works with devices people already own', cells: [true, 'Nest thermostats only', 'Several brands', 'Their own batteries only']},
];
const COLUMNS = ['OurGrid', 'Nest Rush Hour Rewards', 'OhmConnect / Renew Home', 'Tesla / Sunrun VPPs'];

export function WhyUs() {
  return <section className="og-section" id="why" aria-labelledby="why-title">
    <div className="og-section-head">
      <span className="og-eyebrow">Why us</span>
      <h2 id="why-title">Others shift energy across a whole utility.</h2>
      <p>We protect the one transformer about to fail, and the people on it who need power most.</p>
    </div>
    <div className="og-table-wrap">
      <table className="og-table">
        <thead><tr><th scope="col"><span className="sr-only">Capability</span></th>{COLUMNS.map((c, i) => <th key={c} scope="col" className={i === 0 ? 'ours' : ''}>{c}</th>)}</tr></thead>
        <tbody>{ROWS.map(r => <tr key={r.label}>
          <th scope="row">{r.label}</th>
          {r.cells.map((cell, i) => <td key={i} className={i === 0 ? 'ours' : ''}>
            {cell === true ? <span className="yes"><Check size={15}/><span className="sr-only">Yes</span></span>
              : cell === false ? <span className="no"><X size={14}/><span className="sr-only">No</span></span>
              : i === 0 ? <span className="yes"><Check size={15}/>{cell}</span> : <span className="partial"><Minus size={13}/>{cell}</span>}
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}

export function Footer({onMethod}: {onMethod: () => void}) {
  return <footer className="og-footer">
    <div>
      <h2>For city utilities: pilot one transformer with us.</h2>
      <a className="og-contact" href={CONTACT}>Get in touch</a>
    </div>
    <p>Illustrative simulation. Map data © OpenStreetMap contributors (ODbL). <button className="og-link" onClick={onMethod}>How it's calculated</button></p>
  </footer>;
}
