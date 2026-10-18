'use client';
import {useEffect, useState} from 'react';
import {Zap} from 'lucide-react';
import type {CareMap} from '../components/care/CareScene';
import type {Care} from '../components/care/logic';
import Method from '../components/care/Method';
import {DemoSection, DualUse, Fits, Footer, Generators, Hero, India, Score, Stats, WhoPays} from '../components/site/CareSections';
import './street.css';
import './site.css';
import './care.css';

export default function Page() {
  const [map, setMap] = useState<CareMap | null>(null);
  const [care, setCare] = useState<Care | null>(null);
  const [error, setError] = useState(false);
  const [method, setMethod] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    Promise.all([fetch('/noho.json'), fetch('/care-la.json')])
      .then(rs => Promise.all(rs.map(r => {if (!r.ok) throw Error('load failed'); return r.json();})))
      .then(([m, c]) => {setMap(m); setCare(c);})
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
        <a href="#demo">Demo</a><a href="#score">Score</a><a href="#fits">Where it fits</a>
        <button className="og-link" onClick={() => setMethod(true)}>How it's calculated</button>
      </nav>
    </header>
    <main>
      <Hero map={map} care={care} onRun={runDemo}/>
      <Stats/>
      {error && <p className="og-error">The demo data could not load. Please refresh to try again.</p>}
      <DemoSection map={map} care={care} run={run}/>
      <Score/>
      <Fits/>
      <Generators/>
      <DualUse/>
      <WhoPays/>
      <India/>
    </main>
    <Footer onMethod={() => setMethod(true)}/>
    {method && <Method onClose={() => setMethod(false)}/>}
  </div>;
}
