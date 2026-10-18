'use client';
import type {Model} from './types';
import {START, END, clock, hourLabel, type Mode} from './story';

type Props = {model: Model; scenario: string; transformer: string; time: number; beat: string | null; mode: Mode; compare: boolean};

const W = 1000, H = 190, L = 44, R = 18, T = 14, B = 26;
const MAX = 130;

export default function LoadChart({model, scenario, transformer, time, beat, mode, compare}: Props) {
  const s = model.scenarios[scenario];
  const series = s.transformers[transformer];
  const hours = model.hours.slice(0, model.chart_end + 1);
  const x = (h: number) => L + (h - START) / (END - START) * (W - L - R);
  const y = (v: number) => T + (1 - Math.min(v, MAX) / MAX) * (H - T - B);
  const line = (values: number[]) => hours.map((h, i) => `${i ? 'L' : 'M'}${x(h).toFixed(1)},${y(values[i]).toFixed(1)}`).join('');
  const acts = s.at_risk.includes(transformer);
  const story = beat !== null;
  const forecastOnly = beat === 'forecast';
  const drawn = story && !forecastOnly && beat !== 'result' ? time : END;
  const without = series.without.slice(0, hours.length), withLine = series.with.slice(0, hours.length);
  const peakWithout = Math.max(...without), peakWith = Math.max(...withLine);
  const peakAt = hours[without.indexOf(peakWithout)];
  const failure = s.failure[transformer];
  const showWith = acts && !forecastOnly;
  const solidWithout = !story || beat === 'result' || compare || mode === 'without';
  const clipId = `sg-clip-${scenario}-${transformer}`;
  return <figure className="sg-chart">
    <figcaption>
      <span><b>Transformer {transformer}</b> load, 12 PM to 10 PM</span>
      <span className="sg-legend">
        <i className="without"/>{forecastOnly || (story && !solidWithout) ? 'Forecast' : 'Without OurGrid'}
        {showWith && <><i className="with"/>With OurGrid</>}
        <i className="limit"/>Limit
      </span>
    </figcaption>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Transformer ${transformer} load. Without OurGrid it peaks at ${Math.round(peakWithout)}%${acts ? `; with OurGrid at ${Math.round(peakWith)}%` : ''}.`}>
      <defs><clipPath id={clipId}><rect x="0" y="0" width={x(Math.max(START, Math.min(drawn, END)))} height={H}/></clipPath></defs>
      {[0, 50, 100].map(v => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 100 ? 'limit' : 'grid'}/><text x={L - 8} y={y(v) + 3} textAnchor="end">{v}%</text></g>)}
      {[12, 14, 16, 18, 20, 22].map(h => <text key={h} x={x(h)} y={H - 7} textAnchor="middle">{hourLabel(h)}</text>)}
      <path d={line(without)} className={`without ${solidWithout ? '' : 'forecast'}`}/>
      {showWith && <path d={line(withLine)} className="with" clipPath={`url(#${clipId})`}/>}
      {(forecastOnly || beat === 'street' || !story || beat === 'result') && peakWithout > 100 && <g className="peak bad">
        <circle cx={x(peakAt)} cy={y(peakWithout)} r="4"/><text x={x(peakAt) + 8} y={y(peakWithout) - 4}>{Math.round(peakWithout)}% at {clock(peakAt)}</text>
      </g>}
      {showWith && (beat === 'result' || !story) && <g className="peak good">
        <text x={x(hours[withLine.indexOf(peakWith)]) + 8} y={y(peakWith) + 15}>{Math.round(peakWith)}%</text>
      </g>}
      {(beat === 'result' || (!story && mode === 'without')) && failure && <g className="peak fail"><text x={x(failure)} y={y(MAX) + 10} textAnchor="middle">✕ fails {clock(failure)}</text></g>}
      {!forecastOnly && <line className="cursor" x1={x(time)} x2={x(time)} y1={T} y2={H - B}/>}
    </svg>
  </figure>;
}
