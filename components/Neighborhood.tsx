'use client';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import type {Action,Home,MapData} from './types';

type Props={actions:Action[];fleet:Home[];layer:string;selected:number|null;onSelect:(n:number)=>void;resetView:number;zoom:number};
type Building={body:THREE.Mesh;roof:THREE.Mesh;marker:THREE.Mesh;battery:THREE.Mesh;index:number;point:THREE.Vector3};
export default function Neighborhood({actions,fleet,layer,selected,onSelect,resetView,zoom}:Props){
 const container=useRef<HTMLDivElement>(null),state=useRef<{camera:THREE.OrthographicCamera;controls:OrbitControls;buildings:Building[];render:()=>void;reset:()=>void}|null>(null),latest=useRef({actions,fleet,layer,selected,onSelect}),[failed,setFailed]=useState(false),[loaded,setLoaded]=useState(false),[hover,setHover]=useState<{id:string;x:number;y:number}|null>(null);
 useEffect(()=>{latest.current={actions,fleet,layer,selected,onSelect};if(state.current)updateColors(state.current.buildings,latest.current);},[actions,fleet,layer,selected,onSelect]);
 useEffect(()=>{state.current?.reset()},[resetView]);
 const previousZoom=useRef(zoom);useEffect(()=>{if(state.current){state.current.camera.zoom=Math.min(3,Math.max(.5,state.current.camera.zoom*Math.pow(1.2,zoom-previousZoom.current)));state.current.camera.updateProjectionMatrix();state.current.render()}previousZoom.current=zoom},[zoom]);
 useEffect(()=>{
  let stopped=false,cleanup=()=>{};const node=container.current!;
  fetch('/neighborhood.json').then(r=>{if(!r.ok)throw Error('Map data unavailable');return r.json()}).then((data:MapData)=>{
   if(stopped)return;
   const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor('#edf1e7');renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;node.appendChild(renderer.domElement);
   renderer.domElement.setAttribute('aria-label','Interactive 3D map of 100 fictional households on real building footprints in Mueller, Austin. Use the Fleet tab for keyboard-accessible details.');renderer.domElement.setAttribute('role','img');
   const scene=new THREE.Scene();scene.fog=new THREE.Fog('#edf1e7',1100,2100);
   const cx=(data.bounds[0]+data.bounds[2])/2,cz=(data.bounds[1]+data.bounds[3])/2;
   const camera=new THREE.OrthographicCamera(-350,350,250,-250,.1,3000);camera.position.set(cx+360,480,cz+420);
   const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(cx,0,cz);controls.enableDamping=true;controls.dampingFactor=.09;controls.maxPolarAngle=Math.PI/2.5;controls.minPolarAngle=.15;controls.minZoom=.55;controls.maxZoom=3;controls.enablePan=true;controls.maxDistance=1400;
   scene.add(new THREE.HemisphereLight(0xffffff,0xc1d4ad,1.6));const sun=new THREE.DirectionalLight(0xfffcf3,2.3);sun.position.set(-250,600,-100);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-600,right:600,top:600,bottom:-600,near:1,far:1500});sun.shadow.bias=-.0006;sun.shadow.normalBias=.7;sun.shadow.radius=4;sun.target.position.set(cx,0,cz);scene.add(sun,sun.target);
   const mapW=720,mapH=760,originX=cx-mapW/2,originZ=cz-mapH/2;
   const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=2048;const ctx=canvas.getContext('2d')!;const X=(x:number)=>(x-originX)/mapW*2048,Z=(z:number)=>(z-originZ)/mapH*2048;
   ctx.fillStyle='#e5ebda';ctx.fillRect(0,0,2048,2048);
   // Real source geometry, with a deliberately soft cartographic treatment.
   const drawPath=(points:number[][])=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(X(p[0]),Z(p[1])):ctx.moveTo(X(p[0]),Z(p[1])))};
   for(const f of data.features){if(f.kind==='park'||f.kind==='water'){drawPath(f.points);ctx.closePath();ctx.fillStyle=f.kind==='water'?'#adc6be':'#d7e3c8';ctx.fill()}}
   for(const f of data.features){if(f.kind==='road'||f.kind==='path'){drawPath(f.points);ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle=f.kind==='road'?'#d4dbc9':'#eef1e8';ctx.lineWidth=(f.kind==='road'?12:2.5)/mapW*2048;ctx.stroke();if(f.kind==='road'){ctx.strokeStyle='#f7f7ed';ctx.lineWidth=8.2/mapW*2048;ctx.stroke()}}}
   const mapTexture=new THREE.CanvasTexture(canvas);mapTexture.colorSpace=THREE.SRGBColorSpace;mapTexture.anisotropy=renderer.capabilities.getMaxAnisotropy();
   const ground=new THREE.Mesh(new THREE.PlaneGeometry(mapW,mapH),new THREE.MeshStandardMaterial({map:mapTexture,roughness:1,metalness:0}));ground.rotation.x=-Math.PI/2;ground.position.set(cx,0,cz);ground.receiveShadow=true;scene.add(ground);
   const base=new THREE.Mesh(new THREE.BoxGeometry(mapW,5,mapH),new THREE.MeshStandardMaterial({color:'#d7dfcb',roughness:1}));base.position.set(cx,-2.8,cz);scene.add(base);
   const buildings:Building[]=[];const picks:THREE.Object3D[]=[];
   const solarMat=new THREE.MeshStandardMaterial({color:'#607a76',roughness:.5,metalness:.05});const lineMat=new THREE.LineBasicMaterial({color:'#d4ded1'});
   for(const f of data.features.filter(f=>f.kind==='building')){
    if(f.points.length<4)continue;const p=f.points.slice(0,-1);const centerX=p.reduce((s,v)=>s+v[0],0)/p.length,centerZ=p.reduce((s,v)=>s+v[1],0)/p.length;if(Math.abs(centerX-cx)>mapW/2-10||Math.abs(centerZ-cz)>mapH/2-10)continue;
    const homeIndex=f.homeIndex;const isHome=homeIndex!==undefined;
    const shape=new THREE.Shape();p.forEach((v,i)=>i?shape.lineTo(v[0],-v[1]):shape.moveTo(v[0],-v[1]));shape.closePath();
    const height=isHome?6+(homeIndex%3)*1.5:5.5;const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});geometry.rotateX(-Math.PI/2);
    const mat=new THREE.MeshStandardMaterial({color:isHome?'#f5f5e9':'#e8ecdf',roughness:.9});const body=new THREE.Mesh(geometry,mat);body.castShadow=true;body.receiveShadow=true;scene.add(body);
    const roofGeometry=new THREE.ExtrudeGeometry(shape,{depth:1.2,bevelEnabled:true,bevelSegments:1,bevelSize:.25,bevelThickness:.3});roofGeometry.rotateX(-Math.PI/2);
    const roof=new THREE.Mesh(roofGeometry,new THREE.MeshStandardMaterial({color:isHome?'#678576':'#a6b49c',roughness:.9}));roof.position.y=height;roof.castShadow=true;roof.receiveShadow=true;scene.add(roof);
    if(isHome){
     body.userData.homeIndex=homeIndex;roof.userData.homeIndex=homeIndex;picks.push(body,roof);
     const edges=new THREE.LineSegments(new THREE.EdgesGeometry(roofGeometry,35),lineMat);edges.position.y=height;scene.add(edges);
     // Small roof-mounted panels and a visible home battery make each household legible.
     const a=p[0],b=p[1];const angle=-Math.atan2(b[1]-a[1],b[0]-a[0]);
     const solar=new THREE.Mesh(new THREE.BoxGeometry(5,.3,3.6),solarMat);solar.rotation.y=angle;solar.position.set(centerX,height+1.7,centerZ);solar.castShadow=true;scene.add(solar);
     const grid=new THREE.LineSegments(new THREE.EdgesGeometry(solar.geometry),new THREE.LineBasicMaterial({color:'#a8bbb2'}));grid.position.copy(solar.position);grid.rotation.copy(solar.rotation);scene.add(grid);
     const marker=new THREE.Mesh(new THREE.RingGeometry(4.2,5.3,32),new THREE.MeshBasicMaterial({color:'#70a27f',transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false}));marker.rotation.x=-Math.PI/2;marker.position.set(centerX,height+2.3,centerZ);scene.add(marker);
     const battery=new THREE.Mesh(new THREE.BoxGeometry(1.5,2.7,.8),new THREE.MeshStandardMaterial({color:'#659d74',roughness:.7,emissive:'#3b6946',emissiveIntensity:.12}));battery.position.set(a[0]-.5,1.7,a[1]-.5);battery.rotation.y=angle;scene.add(battery);
     buildings.push({body,roof,marker,battery,index:homeIndex,point:new THREE.Vector3(centerX,height+2,centerZ)});
    }
   }
   // Stylized street trees follow actual mapped road segments; landscaping is illustrative.
   const treePoints:THREE.Vector3[]=[];let seed=31;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
   const insideBuilding=(x:number,z:number)=>data.features.some(f=>f.kind==='building'&&pointInPolygon(x,z,f.points));
   for(const f of data.features.filter(f=>f.kind==='road'&&f.name))for(let i=1;i<f.points.length;i++){const a=f.points[i-1],b=f.points[i],dx=b[0]-a[0],dz=b[1]-a[1],dist=Math.hypot(dx,dz);if(dist<8)continue;for(let d=10;d<dist;d+=24){for(const side of [-1,1]){const x=a[0]+dx*d/dist-dz/dist*side*10,z=a[1]+dz*d/dist+dx/dist*side*10;if(Math.abs(x-cx)<mapW/2-10&&Math.abs(z-cz)<mapH/2-10&&!insideBuilding(x,z))treePoints.push(new THREE.Vector3(x,0,z))}}}
   const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.55,.7,5,5),new THREE.MeshStandardMaterial({color:'#b2b197'}),treePoints.length);const leaves=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(4.5,1),new THREE.MeshStandardMaterial({color:'#9cb887',roughness:1}),treePoints.length);const dummy=new THREE.Object3D();treePoints.forEach((p,i)=>{const scale=.8+random()*.5;dummy.position.set(p.x,2.5,p.z);dummy.scale.set(1,1,1);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);dummy.position.y=5.6*scale;dummy.scale.set(scale,scale*1.1,scale);dummy.rotation.y=random()*Math.PI;dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);leaves.setColorAt(i,new THREE.Color().setHSL(.24+random()*.025,.19,.55+random()*.1))});leaves.castShadow=true;trunk.castShadow=true;leaves.receiveShadow=true;scene.add(trunk,leaves);
   // Labels retain OSM street names; place a single readable label on longer segments.
   const used=new Set<string>();for(const f of data.features.filter(f=>f.kind==='road'&&f.name)){if(used.has(f.name))continue;let best:number[][]|null=null;let max=0;for(let i=1;i<f.points.length;i++){const a=f.points[i-1],b=f.points[i],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(d>max){max=d;best=[a,b]}}if(!best||max<50)continue;const [a,b]=best;const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;if(Math.abs(x-cx)>300||Math.abs(z-cz)>320)continue;used.add(f.name);const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=64;const c=labelCanvas.getContext('2d')!;c.font='500 23px Arial';c.fillStyle='#8d9c82';c.textAlign='center';c.textBaseline='middle';c.fillText(f.name.toUpperCase(),256,32);const tex=new THREE.CanvasTexture(labelCanvas);tex.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Mesh(new THREE.PlaneGeometry(80,10),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));label.rotation.set(-Math.PI/2,0,Math.atan2(-(b[1]-a[1]),b[0]-a[0]));label.position.set(x,.3,z);scene.add(label)}
   const render=()=>renderer.render(scene,camera);const resize=()=>{const w=node.clientWidth,h=node.clientHeight;if(!w||!h)return;const half=270;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(w,h);render()};
   const reset=()=>{camera.position.set(cx+360,480,cz+420);controls.target.set(cx,0,cz);camera.zoom=1.32;camera.updateProjectionMatrix();controls.update();render()};
   state.current={camera,controls,buildings,render,reset};updateColors(buildings,latest.current);reset();resize();
   const observer=new ResizeObserver(resize);observer.observe(node);const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();let down={x:0,y:0};
   const getHit=(e:PointerEvent)=>{const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(picks,false)[0]};
   const onDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY}};const onUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const hit=getHit(e);if(hit)latest.current.onSelect(hit.object.userData.homeIndex)};
   const onMove=(e:PointerEvent)=>{if(e.buttons)return;const hit=getHit(e);node.style.cursor=hit?'pointer':'grab';if(hit){const rect=node.getBoundingClientRect();setHover({id:latest.current.fleet[hit.object.userData.homeIndex].id,x:e.clientX-rect.left,y:e.clientY-rect.top})}else setHover(null)};const onLeave=()=>setHover(null);
   renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointerleave',onLeave);
   let frame=0,last=0;const animate=(time:number)=>{frame=requestAnimationFrame(animate);if(time-last<32)return;last=time;controls.update();renderer.render(scene,camera)};frame=requestAnimationFrame(animate);setLoaded(true);
   cleanup=()=>{observer.disconnect();cancelAnimationFrame(frame);controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);renderer.domElement.removeEventListener('pointermove',onMove);renderer.domElement.removeEventListener('pointerleave',onLeave);scene.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{if('map'in m)(m.map as THREE.Texture|null)?.dispose();m.dispose()})}});renderer.dispose();renderer.domElement.remove();state.current=null};
  }).catch(()=>{if(!stopped)setFailed(true)});
  return()=>{stopped=true;cleanup()};
 },[]);
 return <><div ref={container} className="map-canvas"/>{!loaded&&!failed&&<div className="map-loading"><span className="loader"/>Building Mueller in 3D…</div>}{failed&&<div className="map-error"><strong>The 3D view is unavailable on this device.</strong><p>The Fleet tab contains all 100 homes and their live scenario details.</p><button onClick={()=>window.location.reload()}>Reload 3D view</button></div>}{hover&&selected===null&&<div style={{position:'absolute',left:hover.x+12,top:hover.y-22,pointerEvents:'none',background:'#fff',borderRadius:5,padding:'6px 9px',boxShadow:'0 2px 10px #0001',fontSize:9,color:'#668055'}}>{hover.id} · inspect home</div>}</>
}
function updateColors(buildings:Building[],props:{actions:Action[];fleet:Home[];layer:string;selected:number|null}){for(const b of buildings){const a=props.actions[b.index];const c=a.status==='Offline'?'#bf7768':a.status==='Unverified'?'#c69964':a.battery_kw>.01?'#d6b05c':'#86aa8c';const color=props.layer==='charge'?new THREE.Color().setHSL(.22+props.fleet[b.index].soc*.12,.22,.54):new THREE.Color(c);(b.marker.material as THREE.MeshBasicMaterial).color.copy(color);(b.marker.material as THREE.MeshBasicMaterial).opacity=b.index===props.selected?1:.7;b.marker.scale.setScalar(b.index===props.selected?1.4:1);(b.battery.material as THREE.MeshStandardMaterial).color.copy(color);(b.roof.material as THREE.MeshStandardMaterial).color.set(a.status==='Verified'?'#678576':a.status==='Unverified'?'#c3b39b':'#b5998a');if(b.index===props.selected)(b.roof.material as THREE.MeshStandardMaterial).color.set('#648f72')}}
function pointInPolygon(x:number,z:number,points:number[][]){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside}return inside}
