import * as THREE from 'three';
import type {Action,PeerExchange} from './types';

type BuildingPoint={index:number;point:THREE.Vector3};
type Bead={mesh:THREE.Mesh;curve:THREE.QuadraticBezierCurve3;offset:number};

// Animated paths represent allocated capacity on a shared grid, never literal
// house-to-house wires or a guaranteed physical delivery route.
export function createEnergyEffects(scene:THREE.Scene,homes:BuildingPoint[],actions:Action[],stage:number,focusIndex:number,cx:number,cz:number,peer:PeerExchange,approvedMask:number){
 const group=new THREE.Group();scene.add(group);
 const hub=new THREE.Vector3(cx,9,cz),beads:Bead[]=[],rings:THREE.Mesh[]=[];
 const point=(index:number)=>homes.find(h=>h.index===index)?.point.clone();
 const focus=point(focusIndex)??new THREE.Vector3(cx,0,cz);
 const ring=(x:number,z:number,radius:number,color:number,opacity=.65)=>{
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,2.1,5,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));
  mesh.rotation.x=-Math.PI/2;mesh.position.set(x,9,z);group.add(mesh);rings.push(mesh);return mesh;
 };
 const label=(where:THREE.Vector3,title:string,color:string)=>{
  const canvas=document.createElement('canvas');const font='700 48px Arial, sans-serif';
  const measure=canvas.getContext('2d')!;measure.font=font;
  canvas.width=Math.max(310,Math.ceil(measure.measureText(title).width+100));canvas.height=140;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.roundRect(5,5,canvas.width-10,130,24);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=6;ctx.stroke();ctx.fillStyle=color;ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(title,canvas.width/2,70);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.position.set(where.x,where.y+29,where.z);sprite.scale.set(canvas.width/canvas.height*18,18,1);group.add(sprite);
 };
 const flow=(from:THREE.Vector3,to:THREE.Vector3,color:number,offset:number,dim=false)=>{
  const start=from.clone().add(new THREE.Vector3(0,8,0));
  const end=to.clone();
  const apex=new THREE.Vector3((start.x+end.x)/2,42+Math.hypot(start.x-end.x,start.z-end.z)*.14,(start.z+end.z)/2);
  const curve=new THREE.QuadraticBezierCurve3(start,apex,end);
  const path=new THREE.Mesh(new THREE.TubeGeometry(curve,28,1.15,6,false),new THREE.MeshBasicMaterial({color,transparent:true,opacity:dim?.42:.82,depthWrite:false}));group.add(path);
  const bead=new THREE.Mesh(new THREE.SphereGeometry(4.2,10,10),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.98,depthWrite:false}));bead.position.copy(curve.getPoint(offset));group.add(bead);beads.push({mesh:bead,curve,offset});
 };
 if(stage===1)for(const radius of [45,100,165,230])ring(cx,cz,radius,0xe3a762,.55);
 if(stage===2)label(focus,`EV −${actions[focusIndex]?.ev_kw.toFixed(1)} kW`,'#c58a2e');
 if(stage===3)label(focus,`FLEX LOAD −${actions[focusIndex]?.voluntary_kw.toFixed(1)} kW`,'#7965ba');
 if(stage===5){ring(focus.x,focus.z,22,0xc67760,.85);ring(focus.x,focus.z,37,0xd6ad7a,.45);label(focus,'CRITICAL HOME','#ad6856')}
 if(stage===6){ring(focus.x,focus.z,25,0x608dbd,.82);ring(focus.x,focus.z,50,0x8ea9c8,.48);label(focus,'2.0 kW REQUEST','#547cac')}
 if(stage===7||stage===8){
  const recipient=point(peer.recipient_index)??focus;
  ring(recipient.x,recipient.z,20,0x5085bc,.9);
  peer.supplier_indices.forEach((index,i)=>{
   const supplier=point(index);if(!supplier)return;
   const approved=stage===8||!!(approvedMask&(1<<i));
   ring(supplier.x,supplier.z,8,approved?0x529b79:0xc1cbb7,approved?.85:.45);
   if(approved){flow(supplier,recipient.clone().add(new THREE.Vector3(0,12,0)),0x548fbd,i*.22);label(supplier,`+${peer.supplier_kw.toFixed(1)} kW`,'#438b73')}
  });
  label(recipient,stage===8?'0.5 kWh ALLOCATED':`${(peer.supplier_indices.filter((_,i)=>approvedMask&(1<<i)).length*.5).toFixed(1)} kW ALLOCATED`,'#547cac');
 }
 if(stage===9){
  const lost=homes.filter(h=>actions[h.index].status==='Unverified');
  for(const h of lost.filter((_,i)=>i%3===0).slice(0,17))ring(h.point.x,h.point.z,6.5,0xc97463,.85);
  for(const h of lost.filter((_,i)=>i%5===0).slice(0,9)){
   const path=new THREE.Line(new THREE.BufferGeometry().setFromPoints([h.point.clone().add(new THREE.Vector3(0,8,0)),hub]),new THREE.LineDashedMaterial({color:0xd39681,dashSize:4,gapSize:4,transparent:true,opacity:.72}));path.computeLineDistances();group.add(path)
  }
 }
 const flows:{key:'ev_kw'|'voluntary_kw'|'battery_kw';color:number;limit:number}[]=stage===2?[{key:'ev_kw',color:0xd79328,limit:17}]:stage===3?[{key:'voluntary_kw',color:0x7965ba,limit:17}]:stage===4||stage>=10?[{key:'ev_kw',color:0xd79328,limit:6},{key:'voluntary_kw',color:0x7965ba,limit:6},{key:'battery_kw',color:0x269e76,limit:10}]:[];
 for(const [flowIndex,{key,color,limit}] of flows.entries()){
  let participating=homes.filter(h=>actions[h.index][key]>.01);
  const stride=Math.max(1,Math.ceil(participating.length/limit));participating=participating.filter((_,i)=>i%stride===0).slice(0,limit);
  const focused=homes.find(h=>h.index===focusIndex&&actions[h.index][key]>.01);if(focused&&!participating.some(h=>h.index===focusIndex))participating.push(focused);
  participating.forEach((h,i)=>flow(h.point,hub,color,(i/participating.length+flowIndex*.21)%1,stage>=11));
 }
 if(flows.length)ring(cx,cz,13,stage>=11?0xd19c60:0x269e76,.64);
 if(stage===11){ring(cx,cz,28,0xd6a165,.72);ring(cx,cz,39,0xd6a165,.36)}
 const animate=(time:number)=>{
  for(const bead of beads){const progress=(time*.00023+bead.offset)%1;bead.mesh.position.copy(bead.curve.getPoint(progress));bead.mesh.scale.setScalar(.72+Math.sin(progress*Math.PI)*.48)}
  rings.forEach((item,i)=>{item.scale.setScalar(.83+Math.sin(time*.003+i*.8)*.15);(item.material as THREE.MeshBasicMaterial).opacity=(stage===9?.58:.45)+Math.sin(time*.004+i)*.17});
 };
 const dispose=()=>{scene.remove(group);group.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line||o instanceof THREE.Sprite){o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{if(m instanceof THREE.SpriteMaterial)m.map?.dispose();m.dispose()})}})};
 return {animate,dispose,focus};
}
