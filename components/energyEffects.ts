import * as THREE from 'three';
import type {Action} from './types';

type BuildingPoint={index:number;point:THREE.Vector3};
type Bead={mesh:THREE.Mesh;curve:THREE.QuadraticBezierCurve3;offset:number};

// These paths illustrate released grid capacity. They are not a representation
// of physical wiring between the mapped buildings.
export function createEnergyEffects(scene:THREE.Scene,homes:BuildingPoint[],actions:Action[],stage:number,focusIndex:number,cx:number,cz:number){
 const group=new THREE.Group();scene.add(group);
 const hub=new THREE.Vector3(cx,9,cz),beads:Bead[]=[],rings:THREE.Mesh[]=[];
 const focus=homes.find(h=>h.index===focusIndex)?.point.clone()??new THREE.Vector3(cx,0,cz);
 const ring=(x:number,z:number,radius:number,color:number,opacity=.65)=>{
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,2.1,5,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));
  mesh.rotation.x=-Math.PI/2;mesh.position.set(x,9,z);group.add(mesh);rings.push(mesh);return mesh;
 };
 if(stage===1){for(const radius of [45,100,165,230])ring(cx,cz,radius,0xe3a762,.55)}
 if(stage===5){
  const lost=homes.filter(h=>actions[h.index].status==='Unverified');
  for(const h of lost.filter((_,i)=>i%3===0).slice(0,17))ring(h.point.x,h.point.z,6.5,0xc97463,.85);
  for(const h of lost.filter((_,i)=>i%5===0).slice(0,9)){
   const path=new THREE.Line(new THREE.BufferGeometry().setFromPoints([h.point.clone().add(new THREE.Vector3(0,8,0)),hub]),new THREE.LineDashedMaterial({color:0xd39681,dashSize:4,gapSize:4,transparent:true,opacity:.72}));path.computeLineDistances();group.add(path)
  }
 }
 const flows:{key:'ev_kw'|'voluntary_kw'|'battery_kw';color:number;limit:number}[]=stage===2?[{key:'ev_kw',color:0xd79328,limit:17}]:stage===3?[{key:'voluntary_kw',color:0x7965ba,limit:17}]:stage===4||stage===6||stage===7?[{key:'ev_kw',color:0xd79328,limit:6},{key:'voluntary_kw',color:0x7965ba,limit:6},{key:'battery_kw',color:0x269e76,limit:10}]:[];
 for(const [flowIndex,{key,color,limit}] of flows.entries()){
  let participating=homes.filter(h=>actions[h.index][key]>.01);
  // Sample every response type across the neighborhood and retain the focused home.
  const stride=Math.max(1,Math.ceil(participating.length/limit));participating=participating.filter((_,i)=>i%stride===0).slice(0,limit);
  const focused=homes.find(h=>h.index===focusIndex&&actions[h.index][key]>.01);if(focused&&!participating.some(h=>h.index===focusIndex))participating.push(focused);
  participating.forEach((h,i)=>{
   const start=h.point.clone().add(new THREE.Vector3(0,8,0));
   const apex=new THREE.Vector3((start.x+hub.x)/2,42+Math.hypot(start.x-hub.x,start.z-hub.z)*.14,(start.z+hub.z)/2);
   const curve=new THREE.QuadraticBezierCurve3(start,apex,hub);
   const path=new THREE.Mesh(new THREE.TubeGeometry(curve,28,1.15,6,false),new THREE.MeshBasicMaterial({color,transparent:true,opacity:stage===7?.42:.78,depthWrite:false}));group.add(path);
   const particle=new THREE.Mesh(new THREE.SphereGeometry(4.2,10,10),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.98,depthWrite:false}));particle.position.copy(curve.getPoint(i/participating.length));group.add(particle);beads.push({mesh:particle,curve,offset:(i/participating.length+flowIndex*.21)%1});
  });
 }
 if(flows.length)ring(cx,cz,13,stage===7?0xd19c60:0x269e76,.64);
 if(stage===7){ring(cx,cz,28,0xd6a165,.72);ring(cx,cz,39,0xd6a165,.36)}
 const animate=(time:number)=>{
  for(const bead of beads){const progress=(time*.00023+bead.offset)%1;bead.mesh.position.copy(bead.curve.getPoint(progress));bead.mesh.scale.setScalar(.72+Math.sin(progress*Math.PI)*.48)}
  rings.forEach((ring,i)=>{const pulse=.83+Math.sin(time*.003+i*.8)*.15;ring.scale.setScalar(pulse);(ring.material as THREE.MeshBasicMaterial).opacity=(stage===5?.58:.45)+Math.sin(time*.004+i)*.17});
 };
 const dispose=()=>{scene.remove(group);group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose())}})};
 return {animate,dispose,focus};
}
