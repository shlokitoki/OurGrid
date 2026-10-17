"""GraceGrid: reproducible, fictional 100-home fleet and SciPy dispatch model.

Power in kW, energy in kWh. A single 15-minute planning snapshot, no time accrual.
Pre-solve all 32 finite demo scenarios for instant static-hosted playback.
This is an optimization demonstration, never a controller for real equipment.
"""
from pathlib import Path
import json, math, random, hashlib
import numpy as np
from scipy.optimize import linprog

ROOT = Path(__file__).resolve().parents[1]
SEED = 42
HORIZON = .25
EFFICIENCY = .95
CAPACITY = 39.2

def generate_fleet():
    r = random.Random(SEED)
    homes = []
    for i in range(100):
        critical = i % 9 == 0
        reserve = .55 if critical else r.choice([.25,.30,.35])
        soc = round(r.uniform(max(.42,reserve), .94), 3)
        health = round(r.uniform(.94, 1), 3)
        load = round(r.uniform(1.8, 4.8), 2)
        ev = i % 3 == 0
        consent = r.random() < .83
        voluntary = not critical and r.random() < .65
        ev_kw = round(min(load*.38,1.4),2) if ev and consent else 0
        voluntary_kw = round(min(load*.17,.55),2) if voluntary else 0
        homes.append(dict(id=f'GG-{i+1:03}',index=i,capacity_kwh=CAPACITY,
          soc=soc,health=health,reserve=reserve,critical=critical,load_kw=load,
          essential_kw=round(load*.38,2),battery_consent=consent,
          voluntary_consent=voluntary,ev_kw=ev_kw,voluntary_kw=voluntary_kw,
          max_dispatch_kw=round(r.uniform(1.1,2.5),2),circuit=i//10,
          ev_status='Charging' if ev else 'Not installed',device_status='Verified'))
    return homes

def solve(fleet, mask=0, mode='emergency'):
    overload, storm, comm, failure = [bool(mask & (1 << n)) for n in range(4)]
    target = 150.0 if overload else (28.0 if mode == 'everyday' else 0.0)
    loads=[h['load_kw']+(1.85 if overload else 0) for h in fleet]
    bounds=[]; costs=[]; states=[]
    # Offline group intentionally crosses several simulated circuits; not a real utility topology.
    for h in fleet:
        i=h['index']; status='Offline' if failure and i%4==1 else ('Unverified' if comm and i%2==0 else 'Verified')
        reserve=max(h['reserve'], .70 if storm else 0)
        energy=h['capacity_kwh']*h['health']*h['soc']
        floor=h['capacity_kwh']*h['health']*reserve
        usable=max(0,energy-floor)
        battery=min(h['max_dispatch_kw'],usable*EFFICIENCY/HORIZON) if status=='Verified' and h['battery_consent'] else 0
        ev=h['ev_kw']; voluntary=h['voluntary_kw']
        bounds.extend([(0,ev),(0,voluntary),(0,battery)])
        costs.extend([.1 + i*.00001,.4 + i*.00001,1 + (1-h['soc']) + i*.00001])
        states.append(dict(load_kw=loads[i],status=status,reserve=reserve,energy_kwh=energy,protected_kwh=min(floor,energy),battery_limit_kw=battery))
    # Essential demand is never eligible. No export: combined actions <= nonessential + eligible load.
    Aub=[];bub=[]
    for i,h in enumerate(fleet):
        row=np.zeros(301);row[3*i:3*i+3]=1
        Aub.append(row);bub.append(loads[i])
    # Unmet support is explicit and heavily penalized. No fabricated capacity.
    costs.append(10000);bounds.append((0,None))
    result=linprog(costs,A_ub=Aub,b_ub=bub,A_eq=[np.ones(301)],b_eq=[target],bounds=bounds,method='highs')
    if not result.success: raise RuntimeError(result.message)
    actions=[]
    for i,h in enumerate(fleet):
        ev,vol,batt=[max(0,float(v)) for v in result.x[3*i:3*i+3]]
        state=states[i];post=state['energy_kwh']-batt*HORIZON/EFFICIENCY
        actions.append(dict(id=h['id'],**state,ev_kw=ev,voluntary_kw=vol,battery_kw=batt,
         post_energy_kwh=post,backup_hours=post*EFFICIENCY/h['essential_kw'],
         post_soc=post/(h['capacity_kwh']*h['health'])))
    unmet=max(0,float(result.x[-1]));reduction=target-unmet
    def shedding(required, after=False):
        ids=[];supported=0.0
        for circuit in range(10):
            if supported+1e-6>=required: break
            for i in range(circuit*10,circuit*10+10):
                ids.append(fleet[i]['id'])
                a=actions[i];supported+=loads[i]-(a['ev_kw']+a['voluntary_kw']+a['battery_kw'] if after else 0)
        return dict(homes=len(ids),ids=ids,kw=supported)
    # Peak-cost mode has no interruption baseline unless an actual overload is selected.
    baseline=shedding(target if overload else 0)
    proposed=shedding(unmet if overload else 0,True)
    verified=[a for a in actions if a['status']=='Verified']
    data=dict(mask=mask,mode=mode,target_kw=target,actions=actions,
      total_load_kw=sum(loads),
      grid_capacity_kw=sum(h['load_kw'] for h in fleet)+35,
      ev_kw=sum(a['ev_kw'] for a in actions),voluntary_kw=sum(a['voluntary_kw'] for a in actions),
      battery_kw=sum(a['battery_kw'] for a in actions),reduction_kw=reduction,unmet_kw=unmet,
      verified=len(verified),unverified=sum(a['status']=='Unverified' for a in actions),
      offline=sum(a['status']=='Offline' for a in actions),
      reserve_kwh=sum(a['protected_kwh'] for a in verified),
      energy_kwh=sum(a['energy_kwh'] for a in verified),
      backup_hours=float(np.median([a['backup_hours'] for a in verified])) if verified else None,
      baseline=baseline,proposed=proposed,avoided=baseline['homes']-proposed['homes'],
      dispatch_count=sum(a['battery_kw']>.0001 for a in actions),
      ev_count=sum(a['ev_kw']>.0001 for a in actions),
      voluntary_count=sum(a['voluntary_kw']>.0001 for a in actions),
      reserve_violations=sum(a['post_energy_kwh']+1e-6 < min(a['energy_kwh'],h['capacity_kwh']*h['health']*a['reserve']) for a,h in zip(actions,fleet)),
      solver='SciPy / HiGHS',solver_status=result.message)
    return data

def main():
    fleet=generate_fleet()
    results={f'{mode}-{mask}':solve(fleet,mask,mode) for mode in ['emergency','everyday'] for mask in range(16)}
    doc=dict(seed=SEED,horizon_hours=HORIZON,discharge_efficiency=EFFICIENCY,
      capacity_reference='https://www.basepowercompany.com/specs/core',
      method='Precomputed exact scenario solves using Python scipy.optimize.linprog (HiGHS).',
      fleet=fleet,results=results)
    serialized=json.dumps(doc,separators=(',',':'))
    (ROOT/'public'/'simulation.json').write_text(serialized)
    print('Saved 32 reproducible scenario solves, 100 households.')
    for mask in [0,1,5,13,3]:
        s=results[f'emergency-{mask}']
        print(mask,{k:round(s[k],2) for k in ['target_kw','ev_kw','voluntary_kw','battery_kw','unmet_kw','avoided']})

if __name__=='__main__':main()
