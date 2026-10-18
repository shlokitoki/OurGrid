'use client';
import dynamic from 'next/dynamic';
import {useMemo} from 'react';
import {Ambulance, BatteryCharging, Building2, CalendarCheck, Divide, Factory, Flame, Globe2, HeartPulse, MessageCircle, Play, ShieldAlert, ShieldCheck, Stethoscope, Users, X, Zap} from 'lucide-react';
import type {CareMap, CareView} from '../care/CareScene';
import CareDemo from '../care/CareDemo';
import {timeline, type Care} from '../care/logic';

const CareScene = dynamic(() => import('../care/CareScene'), {ssr: false});
const HERO_VIEW: CareView = {time: 16, mode: 'with', beat: null, split: null, selected: null, risk: 0, scenario: 'heat'};
const ignore = () => {};
// Contact for pilots. Replace with the team's address before sharing widely.
const CONTACT = 'mailto:?subject=OurGrid%20pilot';

export function Hero({map, care, onRun}: {map: CareMap | null; care: Care | null; onRun: () => void}) {
  const plan = useMemo(() => care ? timeline(care) : null, [care]);
  return <section className="og-hero" aria-labelledby="hero-title">
    <div className="og-hero-scene" aria-hidden="true">{map && care && plan && <CareScene map={map} care={care} plan={plan} view={HERO_VIEW} shot="hero" onSelect={ignore}/>}</div>
    <div className="og-hero-copy">
      <h1 id="hero-title">Protect the patients who can't lose power, before the outage.</h1>
      <p className="og-hero-line">OurGrid keeps older patients on home medical devices safe before the power goes out, not after.</p>
      <button className="og-run" onClick={onRun}><Play size={17} fill="currentColor"/>Run the demo</button>
    </div>
  </section>;
}

export function Stats() {
  const stats = [
    ['3,352,867', 'Medicare patients on electricity-dependent devices at home'],
    ['67,054', 'in Los Angeles County'],
    ['350 W, 24/7', "one oxygen concentrator uses ~28% of a home's electricity"],
    ['2.4 hours', 'how long a typical 1,000 Wh battery runs it'],
  ];
  return <section className="og-section og-stats" aria-label="Key numbers">
    <div className="og-stat-grid">{stats.map(([n, l]) => <div key={n}><b>{n}</b><span>{l}</span></div>)}</div>
    <p className="og-source">Sources: HHS emPOWER Map (Oct 2026), Philips EverFlo spec, U.S. EIA.</p>
  </section>;
}

export function DemoSection({map, care, run}: {map: CareMap | null; care: Care | null; run: number}) {
  return <section className="og-section" id="demo" aria-labelledby="demo-title">
    <div className="og-section-head">
      <span className="og-eyebrow">The demo</span>
      <h2 id="demo-title">One North Hollywood heat wave.</h2>
      <p>About 300 homes served by LADWP, 20 fictional older patients on home medical devices.</p>
    </div>
    {map && care ? <CareDemo map={map} care={care} run={run}/> : <div className="sg-stage"><div className="sg-loading"><span className="loader"/>Loading North Hollywood…</div></div>}
  </section>;
}

export function Score() {
  return <section className="og-section" id="score" aria-labelledby="score-title">
    <div className="og-section-head"><span className="og-eyebrow">How the score works</span><h2 id="score-title">Hours of safe power left.</h2></div>
    <div className="og-formula">
      <div><span className="og-card-icon warm"><Zap size={20}/></span><b>Outage risk</b><small>on your street</small></div>
      <i aria-hidden="true"><X size={18}/></i>
      <div><span className="og-card-icon red"><HeartPulse size={20}/></span><b>Device criticality</b><small>ventilator, oxygen, BiPAP…</small></div>
      <i aria-hidden="true"><Divide size={18}/></i>
      <div><span className="og-card-icon"><BatteryCharging size={20}/></span><b>Backup on hand</b><small>charged and confirmed</small></div>
      <i aria-hidden="true">→</i>
      <div className="result"><b>Hours of safe power left</b><small>who gets help first</small></div>
    </div>
  </section>;
}

export function Fits() {
  const nodes = [
    {key: 'utility', icon: <Factory size={18}/>, title: 'Utility', text: 'Outage risk, life-support list'},
    {key: 'agency', icon: <Stethoscope size={18}/>, title: 'Home health agency / oxygen supplier', text: 'Patients, devices, drivers'},
    {key: 'batteries', icon: <BatteryCharging size={18}/>, title: 'Batteries', text: 'Owned by the utility or agency'},
    {key: 'patient', icon: <MessageCircle size={18}/>, title: 'Patient', text: 'Text or call'},
    {key: '911', icon: <Ambulance size={18}/>, title: '911', text: 'Last resort'},
  ];
  return <section className="og-section" id="fits" aria-labelledby="fits-title">
    <div className="og-section-head"><span className="og-eyebrow">Where OurGrid fits</span><h2 id="fits-title">The missing link, before the outage.</h2></div>
    <div className="og-hub">
      <div className="og-hub-center"><Zap size={22} fill="currentColor"/><b>OurGrid</b></div>
      {nodes.map(n => <div key={n.key} className={`og-hub-node ${n.key}`}><span>{n.icon}</span><b>{n.title}</b><small>{n.text}</small></div>)}
    </div>
    <p className="og-caption">Utilities know where the power will go out. Agencies know who's on oxygen. OurGrid connects them before the outage.</p>
  </section>;
}

export function Generators() {
  const cards = [
    {icon: <Building2 size={20}/>, title: 'Many can’t', text: "Low-income renters can't buy, store fuel for or run one in an apartment; many older patients can't safely start or refuel one.", tone: 'warm'},
    {icon: <Flame size={20}/>, title: 'Generators kill', text: 'About 85 carbon monoxide deaths a year in the U.S. (CPSC).', tone: 'red'},
    {icon: <ShieldCheck size={20}/>, title: 'OurGrid instead', text: 'OurGrid makes sure existing backup is charged and in the right home.', tone: 'green'},
  ];
  return <section className="og-section" id="generators" aria-labelledby="gen-title">
    <div className="og-section-head"><span className="og-eyebrow">Why not a generator?</span><h2 id="gen-title">Backup that's safe to use at home.</h2></div>
    <div className="og-cards">{cards.map(c => <article key={c.title} className={`og-card ${c.tone}`}><span className="og-card-icon">{c.icon}</span><h3>{c.title}</h3><p>{c.text}</p></article>)}</div>
  </section>;
}

export function DualUse() {
  return <section className="og-section" id="dual" aria-labelledby="dual-title">
    <div className="og-section-head"><span className="og-eyebrow">Dual use</span><h2 id="dual-title">Useful every day, ready for the worst.</h2></div>
    <div className="og-cards two">
      <article className="og-card"><span className="og-card-icon"><CalendarCheck size={20}/></span><h3>Everyday + emergency</h3><p>Keeps batteries charged and emergency plans current every day, then switches to triage in a crisis.</p></article>
      <article className="og-card"><span className="og-card-icon warm"><ShieldAlert size={20}/></span><h3>Civilian + government</h3><p>The same engine works for heat waves, wildfires, hurricanes and grid attacks; utilities and agencies use it daily, emergency managers in disasters.</p></article>
    </div>
  </section>;
}

export function WhoPays() {
  return <section className="og-section" id="pays" aria-labelledby="pays-title">
    <div className="og-section-head"><span className="og-eyebrow">Who pays</span><h2 id="pays-title">Utilities and agencies pay. Patients don't.</h2></div>
    <div className="og-payers"><span><Factory size={16}/>City-owned utilities</span><span><Stethoscope size={16}/>Home health agencies and oxygen suppliers</span><span><Users size={16}/>Patients free</span></div>
    <p className="og-source">We don't sell batteries or electricity. Batteries belong to the utility or agency; OurGrid tracks and dispatches them.</p>
  </section>;
}

export function India() {
  return <section className="og-section" id="india" aria-labelledby="india-title">
    <div className="og-section-head"><span className="og-eyebrow">Global: India</span><h2 id="india-title">The same score, adapted for daily power cuts.</h2></div>
    <article className="og-card og-india"><span className="og-card-icon"><Globe2 size={20}/></span>
      <p>149M people aged 60+, rising to 347M by 2050. 38% of households faced daily power cuts (May 2024). No Indian utility keeps a medical-priority list. Check-ins over WhatsApp in Hindi and Tamil, follow-up by home-care nurses.</p>
    </article>
  </section>;
}

export function Footer({onMethod}: {onMethod: () => void}) {
  return <footer className="og-footer">
    <div><h2>Pilot with us: home health agencies and city utilities in Los Angeles.</h2><a className="og-contact" href={CONTACT}>Get in touch</a></div>
    <p>Illustrative simulation with fictional patients. No real health data. Map data © OpenStreetMap contributors (ODbL). <button className="og-link" onClick={onMethod}>How it's calculated</button></p>
  </footer>;
}
