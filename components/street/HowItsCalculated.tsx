'use client';
import {useEffect, useRef, useState} from 'react';
import {Download, X} from 'lucide-react';
import type {Model, StreetMap} from './types';

export default function HowItsCalculated({onClose}: {onClose: () => void}) {
  const [model, setModel] = useState<Model | null>(null);
  const [map, setMap] = useState<Pick<StreetMap, 'place' | 'source' | 'retrieved' | 'license'> | null>(null);
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch('/scenarios.json').then(r => r.json()).then(setModel).catch(() => {});
    fetch('/burbank.json').then(r => r.json()).then(setMap).catch(() => {});
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {if (e.key === 'Escape') onClose();};
    window.addEventListener('keydown', key);
    return () => {window.removeEventListener('keydown', key); before?.focus();};
  }, [onClose]);

  const heat = model?.scenarios.heat_wave;
  return <div className="og-modal-backdrop" onClick={onClose}>
    <section className="og-modal" role="dialog" aria-modal="true" aria-labelledby="method-title" tabIndex={-1} ref={dialog} onClick={e => e.stopPropagation()}>
      <button className="og-modal-close" onClick={onClose} aria-label="Close"><X size={16}/></button>
      <h2 id="method-title">How it's calculated</h2>
      <p className="og-lede">An illustrative simulation of one Burbank block on a heat-wave day. It is not real utility data, real billing or live device control.</p>

      <h3>What's real</h3>
      <p>The building footprints and streets come from OpenStreetMap: {map?.place ?? 'N Fairview St and N Niagara St, Burbank, CA'}. Map data © OpenStreetMap contributors, available under the <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">Open Database License 1.0</a>{map ? `, retrieved ${map.retrieved}` : ''}.</p>

      <h3>What's illustrative</h3>
      <p>Every home's devices, people, temperatures and loads, the four transformers, their ratings and which homes they serve. Temperatures and percentages are made up to tell the story clearly.</p>

      <h3>The model</h3>
      <ul>
        <li><b>Loads.</b> Each home has a base load that rises in the evening, AC that grows with how far the outdoor temperature (plus late west sun) is above its thermostat, and sometimes an EV. Commuters' homes sit at 82°F until they get home, then pull back down to 76°F: the main cause of the 6 PM peak.</li>
        <li><b>Pre-cool and ease off.</b> On a transformer forecast to overload, smart thermostats cool homes to 73°F from 1 to 4 PM, then let them drift back to 76°F from 5 to 8 PM. Every kWh of AC avoided later costs 1.1 kWh earlier, so total energy rises slightly and only the peak moves.</li>
        <li><b>Just enough.</b> OurGrid picks the smallest cut that keeps the transformer at or below 94%{heat?.ease?.B ? ` (here, ${Math.round(heat.ease.B * 100)}% of AC from 5 to 8 PM)` : ''}. Other transformers are left alone.</li>
        <li><b>EVs and batteries.</b> EV charging on that transformer moves to 10 PM. Home batteries cover their own homes from 5 to 8 PM, and two share 0.75 kW each from 6 to 7 PM.</li>
        <li><b>Sharing.</b> The shared {heat?.share?.kwh ?? 1.5} kWh is credited to the medical home's bill at a demo base rate of ${model?.base_rate.toFixed(2) ?? '0.16'}/kWh. It is not extra supply or a physical wire between homes. Medical homes are never adjusted.</li>
        <li><b>Failure.</b> Without OurGrid, a transformer fails after 15 minutes above 115%{heat?.failure?.B ? `, which here happens at ${formatHour(heat.failure.B)}` : ''}.</li>
        <li><b>Ratings.</b> Each transformer's rating is set so the heat-wave forecast peaks at an illustrative level (Transformer B at 118%).</li>
      </ul>

      <h3>Files</h3>
      <div className="og-files">
        <a href="/model.py" download><Download size={14}/>Model source (Python)</a>
        <a href="/scenarios.json" download><Download size={14}/>Scenario data</a>
        <a href="/burbank.json" download><Download size={14}/>Map data (ODbL)</a>
      </div>
      <p className="og-fine">{model?.disclaimer ?? 'Illustrative simulation. Real sharing requires a utility pilot.'}</p>
    </section>
  </div>;
}

function formatHour(time: number) {
  const minutes = Math.round(time * 60);
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
