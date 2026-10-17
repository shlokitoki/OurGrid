import {useEffect,useRef} from 'react';
import {ArrowRight, BatteryCharging, House, Radio, ShieldCheck, Zap} from 'lucide-react';
import type {PeerExchange,Result} from './types';

export const DEMO_DURATIONS = [2600,3000,5200,5200,4100,4500,4500,6200,5200,3500,4100,4300];
export const DEMO_STEPS = ['Balance','Demand spike','EV charging','Flexible loads','Battery dispatch','Critical needs','Support request','Neighbor offers','Energy ledger','Telemetry loss','Reoptimize','Dispatcher','Outcome'];

export function stageCopy(step:number, normal:Result, spike:Result, failed:Result, peer:PeerExchange, focusId?:string, focusValue?:number, reserve?:number){
  const id=focusId || 'a participating home';
  const kw=focusValue ? focusValue.toFixed(1) : '0.5';
  switch(step){
    case 0:return {chapter:'01 / NORMAL',title:'A neighborhood in balance',detail:`${normal.total_load_kw.toFixed(0)} kW demand. ${Math.round(normal.grid_capacity_kw-normal.total_load_kw)} kW of headroom.`,kind:'normal'};
    case 1:return {chapter:'02 / THE PROBLEM',title:'Demand outruns the grid',detail:`An evening spike creates a ${spike.target_kw.toFixed(0)} kW shortfall. Whole circuits could be interrupted.`,kind:'surge'};
    case 2:return {chapter:'03 / EV CHARGING',title:'Reduce flexible charging',detail:`At ${id}, charging drops ${kw} kW for 15 minutes. ${spike.ev_count} opted-in EVs reduce demand by ${spike.ev_kw.toFixed(1)} kW.`,kind:'ev'};
    case 3:return {chapter:'04 / FLEXIBLE LOADS',title:'Defer optional home loads',detail:`With consent, ${id} pauses TV and gaming use, reducing demand by ${kw} kW. ${spike.voluntary_count} participating homes provide ${spike.voluntary_kw.toFixed(1)} kW.`,kind:'voluntary'};
    case 4:return {chapter:'05 / BATTERY DISPATCH',title:'Dispatch above backup reserves',detail:`${id} contributes ${kw} kW while keeping its ${Math.round((reserve||0)*100)}% backup floor. ${spike.dispatch_count} batteries provide ${spike.battery_kw.toFixed(1)} kW.`,kind:'battery'};
    case 5:return {chapter:'06 / CRITICAL NEED',title:'Protect a home with medical equipment',detail:`${id} has an older resident using an oxygen concentrator. Its battery is below its no-export floor, so it does not export.`,kind:'care'};
    case 6:return {chapter:'07 / NEIGHBOR PORTAL',title:'A request goes to nearby homes',detail:`${id} requests ${peer.requested_kw.toFixed(1)} kW for 15 minutes. The portal matches consented, verified neighbors.`,kind:'request'};
    case 7:return {chapter:'08 / NEIGHBOR APPROVALS',title:'Four neighbors authorize support',detail:`Each approves ${peer.supplier_kw.toFixed(1)} kW of eligible battery capacity. The plan allocates ${peer.requested_kw.toFixed(1)} kW through the shared grid.`,kind:'neighbors'};
    case 8:return {chapter:'09 / FAIR EXCHANGE',title:'Every contribution is recorded',detail:`Each helper earns ${peer.energy_per_supplier_kwh.toFixed(3)} kWh of credit. At the demo rate, that is a bill credit instead of a free giveaway.`,kind:'ledger'};
    case 9:return {chapter:'10 / TELEMETRY LOSS',title:'Unverified capacity is excluded',detail:`${failed.unverified} batteries lose communication. The revised plan excludes them and keeps essential needs protected.`,kind:'failure'};
    case 10:return {chapter:'11 / REOPTIMIZATION',title:'Recalculate verified capacity',detail:`Verified options still recover ${failed.reduction_kw.toFixed(1)} kW. ${failed.unmet_kw.toFixed(1)} kW remains for a dispatcher.`,kind:'reoptimize'};
    case 11:return {chapter:'12 / HUMAN DECISION',title:'Escalate what remains',detail:`${failed.avoided} homes are still spared versus circuit shedding. A dispatcher reviews the ${failed.unmet_kw.toFixed(1)} kW gap.`,kind:'escalate'};
    default:return {chapter:'13 / THE OUTCOME',title:'A stronger neighborhood',detail:'Less peak waste. Paid neighbor support. Protected essentials. Fewer avoidable interruptions.',kind:'conclusion'};
  }
}

export function ProblemSolution(){return <section className="problem-solution" aria-label="The problem and OurGrid response">
  <div className="primer-item"><div className="primer-icon risk"><Zap size={17}/></div><div><span className="primer-label">THE PROBLEM</span><strong>Demand can exceed supply.</strong><p>A sudden peak can force utilities to interrupt whole circuits.</p></div></div>
  <div className="primer-connector"><ArrowRight size={19}/></div>
  <div className="primer-item"><div className="primer-icon answer"><BatteryCharging size={18}/></div><div><span className="primer-label">THE RESPONSE</span><strong>Find the gentlest reduction.</strong><p>Slow flexible loads, protect backup, and match neighbor support.</p></div></div>
  <div className="primer-connector"><ArrowRight size={19}/></div>
  <div className="primer-item"><div className="primer-icon proof"><House size={17}/></div><div><span className="primer-label">THE PROOF</span><strong>Count homes that stay on.</strong><p>Compare against circuit shedding; escalate any gap.</p></div></div>
 </section>}

export function DemoPlayback({step,recovered,approved,copy,onJump}:{step:number;recovered:number;approved:number;copy:ReturnType<typeof stageCopy>;onJump:(step:number)=>void}){
 const rail=useRef<HTMLDivElement>(null);
 useEffect(()=>{const active=rail.current?.querySelector<HTMLElement>('.current');if(active&&rail.current)rail.current.scrollTo({left:active.offsetLeft-rail.current.clientWidth/2+active.clientWidth/2,behavior:'smooth'})},[step]);
 const peerStep=step>=5&&step<=8;
 return <section className="demo-playback" aria-label="Guided demonstration">
   <div className="demo-playback-head"><span className="demo-live-dot"/><strong>{copy.chapter}</strong><span>{copy.title}</span><b>{peerStep?approved*0.5:Math.round(recovered)} <small>{peerStep?'kW neighbor support':'kW grid relief'}</small></b></div>
   <div className="demo-steps" ref={rail}>{DEMO_STEPS.map((name,i)=><button key={name} className={i===step?'current':i<step?'passed':''} onClick={()=>onJump(i)} aria-label={`Jump to ${name}`} aria-current={i===step?'step':undefined}><i/>{name}</button>)}</div>
 </section>
}

export function WhyThisPlan(){return <section className="why-plan panel" aria-label="How dispatch decisions are made"><div className="why-plan-intro"><span className="eyebrow">WHY THIS ORDER?</span><h2>Protect the essentials. Move the flexible edge.</h2><p>Every kilowatt has a cost to the household. The solver starts with the least disruptive choices.</p></div><div className="why-plan-steps"><div><span className="why-step-icon"><ShieldCheck size={18}/></span><b>Protect</b><small>Essential loads and backup reserves stay locked.</small></div><ArrowRight size={16}/><div><span className="why-step-icon"><Zap size={18}/></span><b>Defer</b><small>Slow opted-in charging and voluntary extras.</small></div><ArrowRight size={16}/><div><span className="why-step-icon"><BatteryCharging size={18}/></span><b>Share</b><small>Use only verified battery energy above reserve.</small></div><ArrowRight size={16}/><div><span className="why-step-icon"><Radio size={18}/></span><b>Escalate</b><small>A person handles any remaining shortfall.</small></div></div></section>}
