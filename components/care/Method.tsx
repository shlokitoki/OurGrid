'use client';
import {useEffect, useRef} from 'react';
import {X} from 'lucide-react';

export default function Method({onClose}: {onClose: () => void}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {if (e.key === 'Escape') onClose();};
    window.addEventListener('keydown', key);
    return () => {window.removeEventListener('keydown', key); before?.focus();};
  }, [onClose]);
  return <div className="og-modal-backdrop" onClick={onClose}>
    <section className="og-modal" role="dialog" aria-modal="true" aria-labelledby="method-title" tabIndex={-1} ref={dialog} onClick={e => e.stopPropagation()}>
      <button className="og-modal-close" onClick={onClose} aria-label="Close"><X size={16}/></button>
      <h2 id="method-title">How it's calculated</h2>
      <p className="og-lede">An illustrative simulation with fictional patients. No real health data, outcomes or devices.</p>
      <h3>The score</h3>
      <ul>
        <li><b>Hours of safe power</b> = backup Wh × 0.85 ÷ device watts. A 350 W oxygen concentrator on a 1,000 Wh battery runs about 2.4 h; on 2,000 Wh about 4.9 h; with no backup, 0 h.</li>
        <li><b>Device criticality:</b> ventilator 3, heart pump 3, oxygen concentrator 2, home dialysis 2, BiPAP 1.</li>
        <li><b>Outage risk</b> by street: 0.1, 0.3 or 0.6 (fictional).</li>
        <li><b>Priority</b> = outage risk × criticality ÷ max(hours, 0.5). Tier 1 (red): under 4 h on a high-risk street. Tier 2 (amber): 4–12 h. Tier 3 (green): 12 h or more.</li>
        <li><b>Unconfirmed backup counts half</b> until a check-in or a call confirms it's charged. A three-year-old battery counts at about 40%.</li>
      </ul>
      <h3>The heat wave</h3>
      <ul>
        <li>The day before, check-ins go to Tier 1 and 2 in priority order. Anyone who doesn't reply gets a call from a care coordinator within two hours.</li>
        <li>The next morning a van delivers charged batteries and swaps an old one, before the peak.</li>
        <li>During the outage the ladder runs per patient: swap a battery at 50% left, bring oxygen tanks (no electricity needed) at about 2 h left, move the patient somewhere with power at about 1 h left, and 911 only as the last step.</li>
        <li>Without OurGrid there's only a generic alert: nobody checks, charges or delivers, and anyone whose backup runs out has to call 911.</li>
      </ul>
      <h3>What's real</h3>
      <p>Building footprints and streets in North Hollywood come from OpenStreetMap, © OpenStreetMap contributors, under the <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">Open Database License 1.0</a>. The statistics on the page cite their sources. Everything else is made up.</p>
      <div className="og-files"><a href="/care-la.json" download>Patient data file (fictional)</a><a href="/noho.json" download>Map data (ODbL)</a></div>
      <p className="og-fine">Illustrative simulation with fictional patients. No real health data.</p>
    </section>
  </div>;
}
