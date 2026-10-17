import {ArrowRight, BatteryCharging, Check, House, Radio, ShieldCheck, Zap} from 'lucide-react';
import type {Result} from './types';

export const DEMO_DURATIONS = [2800, 3300, 3600, 3600, 4700, 3500, 4200, 4600];

export function stageCopy(step:number, normal:Result, spike:Result, failed:Result, focusId?:string, focusValue?:number, reserve?:number){
  const id=focusId || 'a participating home';
  const example=focusValue ? `${focusValue.toFixed(1)} kW` : 'part of the response';
  switch(step){
    case 0:return {chapter:'01 / NORMAL',title:'A neighborhood in balance',detail:`${normal.total_load_kw.toFixed(0)} kW demand. ${Math.round(normal.grid_capacity_kw-normal.total_load_kw)} kW of headroom.`,kind:'normal'};
    case 1:return {chapter:'02 / THE PROBLEM',title:'Demand outruns the grid',detail:`A +185 kW evening spike creates a ${spike.target_kw.toFixed(0)} kW shortfall. Whole circuits could be interrupted.`,kind:'surge'};
    case 2:return {chapter:'03 / FLEXIBLE FIRST',title:'Charging can wait',detail:`${id} pauses ${example} of EV charging. ${spike.ev_count} opted-in homes free ${spike.ev_kw.toFixed(1)} kW together.`,kind:'ev'};
    case 3:return {chapter:'04 / ASK, DON’T CUT',title:'Neighbors choose to help',detail:`${id} voluntarily reduces ${example} of nonessential use. ${spike.voluntary_count} homes free ${spike.voluntary_kw.toFixed(1)} kW.`,kind:'voluntary'};
    case 4:return {chapter:'05 / SHARE SAFELY',title:'Only spare battery energy',detail:`${id} adds ${example}, staying above its ${Math.round((reserve||0)*100)}% backup floor. ${spike.dispatch_count} batteries supply ${spike.battery_kw.toFixed(1)} kW.`,kind:'battery'};
    case 5:return {chapter:'06 / DEVICE FAILURE',title:'Battery links go silent',detail:`${id} supplied ${example}; now its battery is unverified. All ${failed.unverified} silent units leave the plan.`,kind:'failure'};
    case 6:return {chapter:'07 / RE-OPTIMIZE',title:'A safer plan replaces the first',detail:`${id} can still give ${example} safely. Verified batteries recover ${failed.battery_kw.toFixed(1)} kW; ${failed.unmet_kw.toFixed(1)} kW remains.`,kind:'reoptimize'};
    default:return {chapter:'08 / HUMAN DECISION',title:'Escalate what remains',detail:`${failed.avoided} homes are still spared. A dispatcher reviews the remaining ${failed.unmet_kw.toFixed(1)} kW.`,kind:'escalate'};
  }
}

export function ProblemSolution(){return <section className="problem-solution" aria-label="The problem and GraceGrid response">
  <div className="primer-item"><div className="primer-icon risk"><Zap size={17}/></div><div><span className="primer-label">THE PROBLEM</span><strong>Demand can exceed supply.</strong><p>A sudden peak can force utilities to interrupt whole circuits.</p></div></div>
  <div className="primer-connector"><ArrowRight size={19}/></div>
  <div className="primer-item"><div className="primer-icon answer"><BatteryCharging size={18}/></div><div><span className="primer-label">THE RESPONSE</span><strong>Find the gentlest reduction.</strong><p>Pause flexible loads, ask willing homes, then use safe battery energy.</p></div></div>
  <div className="primer-connector"><ArrowRight size={19}/></div>
  <div className="primer-item"><div className="primer-icon proof"><House size={17}/></div><div><span className="primer-label">THE PROOF</span><strong>Count homes that stay on.</strong><p>Compare the same shortfall against circuit shedding; escalate any gap.</p></div></div>
 </section>}

export function DemoPlayback({step,recovered,copy,onJump}:{step:number;recovered:number;copy:ReturnType<typeof stageCopy>;onJump:(step:number)=>void}){
 return <section className="demo-playback" aria-label="Guided demonstration">
   <div className="demo-playback-head"><span className="demo-live-dot"/><strong>{copy.chapter}</strong><span>{copy.title}</span><b>{Math.round(recovered)} <small>kW freed</small></b></div>
   <div className="demo-steps">{['Balance','Spike','Defer EVs','Ask homes','Safe batteries','Links fail','Replan','Escalate'].map((name,i)=><button key={name} className={i===step?'current':i<step?'passed':''} onClick={()=>onJump(i)} aria-label={`Jump to ${name}`} aria-current={i===step?'step':undefined}><i/>{name}</button>)}</div>
 </section>
}

export function WhyThisPlan(){return <section className="why-plan panel" aria-label="How dispatch decisions are made"><div className="why-plan-intro"><span className="eyebrow">WHY THIS ORDER?</span><h2>Protect the essentials. Move the flexible edge.</h2><p>Every kilowatt has a cost to the household. The solver starts with the least disruptive choices.</p></div><div className="why-plan-steps"><div><span className="why-step-icon"><ShieldCheck size={18}/></span><b>Protect</b><small>Essential loads and backup reserves stay locked.</small></div><ArrowRight size={16}/><div><span className="why-step-icon"><Zap size={18}/></span><b>Defer</b><small>Pause opted-in charging and voluntary extras.</small></div><ArrowRight size={16}/><div><span className="why-step-icon"><BatteryCharging size={18}/></span><b>Share</b><small>Use only verified battery energy above reserve.</small></div><ArrowRight size={16}/><div><span className="why-step-icon"><Radio size={18}/></span><b>Escalate</b><small>A person handles any remaining shortfall.</small></div></div></section>}
