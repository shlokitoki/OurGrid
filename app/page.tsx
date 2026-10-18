'use client';
import {useEffect, useState} from 'react';
import {Zap} from 'lucide-react';
import type {Model, StreetMap} from '../components/street/types';
import HowItsCalculated from '../components/street/HowItsCalculated';
import {DemoSection, Footer, Hero, HowWeOptimize, WhenWeShare, WhyUs} from '../components/site/Sections';
import './street.css';
import './site.css';

export default function Page() {
  const [map, setMap] = useState<StreetMap | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [error, setError] = useState(false);
  const [method, setMethod] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    Promise.all([fetch('/burbank.json'), fetch('/scenarios.json')])
      .then(rs => Promise.all(rs.map(r => {if (!r.ok) throw Error('load failed'); return r.json();})))
      .then(([m, s]) => {setMap(m); setModel(s);})
      .catch(() => setError(true));
  }, []);

  const runDemo = () => {
    (document.querySelector('#demo .sg-demo') ?? document.getElementById('demo'))?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    setRun(n => n + 1);
  };

  return <div className="og-page" id="top">
    <header className="og-header">
      <a className="og-brand" href="#top"><span className="og-mark"><Zap size={17} fill="currentColor"/></span>OurGrid</a>
      <nav aria-label="Sections">
        <a href="#demo">Demo</a><a href="#share">Sharing</a><a href="#why">Why us</a>
        <button className="og-link" onClick={() => setMethod(true)}>How it's calculated</button>
      </nav>
    </header>
    <main>
      <Hero map={map} model={model} onRun={runDemo}/>
      {error && <p className="og-error">The demo data could not load. Please refresh to try again.</p>}
      <DemoSection map={map} model={model} run={run}/>
      <WhenWeShare/>
      <HowWeOptimize/>
      <WhyUs/>
    </main>
    <Footer onMethod={() => setMethod(true)}/>
    {method && <HowItsCalculated onClose={() => setMethod(false)}/>}
  </div>;
}
