'use client';
import {useState} from 'react';
import {Zap} from 'lucide-react';
import StreetDemo from '../components/street/StreetDemo';
import HowItsCalculated from '../components/street/HowItsCalculated';
import './street.css';

export default function Page() {
  const [method, setMethod] = useState(false);
  return <div className="og-page" id="top">
    <header className="og-header">
      <a className="og-brand" href="#top"><span className="og-mark"><Zap size={17} fill="currentColor"/></span>OurGrid</a>
      <button className="og-link" onClick={() => setMethod(true)}>How it's calculated</button>
    </header>
    <main className="og-main">
      <section className="og-section" aria-label="Live demo"><StreetDemo/></section>
    </main>
    {method && <HowItsCalculated onClose={() => setMethod(false)}/>}
  </div>;
}
