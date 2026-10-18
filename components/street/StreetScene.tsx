'use client';
import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CSS2DObject, CSS2DRenderer} from 'three/addons/renderers/CSS2DRenderer.js';
import type {Model, StreetMap} from './types';
import {COIN_LANDS, failed, gaugeValue, homeState, type Mode, type View} from './story';

export type Shot = 'hero' | 'wide' | 'focus' | 'close' | 'share' | 'result' | 'free';
type Props = {map: StreetMap; model: Model; view: View; shot: Shot; onSelectHome: (index: number | null) => void; onSelectTransformer: (id: string) => void};

const ICONS = {
  thermo: '<svg viewBox="0 0 24 24"><path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M4 16v-2.5L6 9h12l2 4.5V16z"/><circle cx="7.5" cy="16.5" r="1.7"/><circle cx="16.5" cy="16.5" r="1.7"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 3 6 13h5l-1 8 7-10h-5z"/></svg>',
  medical: '<svg viewBox="0 0 24 24"><path class="shield" d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6z"/><path class="heart" d="M12 15.6s-3.6-2.2-3.6-4.6a2 2 0 0 1 3.6-1.1 2 2 0 0 1 3.6 1.1c0 2.4-3.6 4.6-3.6 4.6z"/></svg>',
};
const RING = 2 * Math.PI * 26, OUTER = 2 * Math.PI * 30.5;

type Label = {object: CSS2DObject; el: HTMLDivElement; text: string};
type HomeParts = {
  index: number; transformer: string; body: THREE.Mesh; roof: THREE.Mesh; halo: THREE.Mesh; windows: THREE.MeshBasicMaterial;
  battery?: {box: THREE.Mesh; pulse: THREE.Mesh}; car?: THREE.Group; center: THREE.Vector3; roofY: number;
};
type Wire = {home: number; transformer: string; curve: THREE.QuadraticBezierCurve3; line: THREE.Mesh};
type Built = {
  render: () => void; dispose: () => void;
};

// The outer element is positioned by CSS2DRenderer (it owns `transform`); styling and animation go on the inner one.
const label = (className: string, html = '') => {
  const anchor = document.createElement('div');
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = html;
  anchor.appendChild(el);
  return {object: new CSS2DObject(anchor), el, text: ''};
};
const setText = (l: Label, text: string, html: string) => {if (l.text !== text) {l.text = text; l.el.innerHTML = html;}};
const setClass = (el: HTMLElement, name: string) => {if (el.className !== name) el.className = name;};
const mix = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));

function sky(time: number) {
  const stops: [number, string][] = [[12, '#eef1ea'], [17, '#efebe1'], [18.75, '#f3dfc4'], [19.75, '#c9ac9c'], [20.5, '#68738a'], [21.25, '#4a5670'], [22, '#414d68']];
  let color = new THREE.Color(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (time <= stops[i][0]) {color = mix(stops[i - 1][1], stops[i][1], (time - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); break;}
    color = new THREE.Color(stops[i][1]);
  }
  const elevation = time <= 12.9 ? 80 : Math.max(-6, 80 * Math.cos(((time - 12.9) / (20.1 - 12.9)) * Math.PI / 2));
  const azimuth = THREE.MathUtils.degToRad(180 + ((time - 12) / 8) * 115);
  const el = THREE.MathUtils.degToRad(elevation);
  // x is east, z is south: north is -z.
  const direction = new THREE.Vector3(Math.sin(azimuth) * Math.cos(el), Math.sin(el), -Math.cos(azimuth) * Math.cos(el));
  return {color, direction, sun: 2.4 * Math.max(0, Math.min(1, elevation / 22)), night: Math.max(0, Math.min(1, (time - 19.4) / 1.3)), warm: Math.max(0, Math.min(1, 1 - elevation / 25))};
}

function palmCrown() {
  const positions: number[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const side = [-s * 0.45, c * 0.45], tip = [c * 4.2, s * 4.2], mid = [c * 2.2, s * 2.2];
    positions.push(0, 0.3, 0, mid[0] + side[0], 0.5, mid[1] + side[1], tip[0], -1.5, tip[1]);
    positions.push(0, 0.3, 0, tip[0], -1.5, tip[1], mid[0] - side[0], 0.5, mid[1] - side[1]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function haloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.55, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export default function StreetScene({map, model, view, shot, onSelectHome, onSelectTransformer}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef({view, shot, onSelectHome, onSelectTransformer});
  latest.current = {view, shot, onSelectHome, onSelectTransformer};
  const [failedToLoad, setFailedToLoad] = useState(false);

  useEffect(() => {
    const node = container.current!;
    let built: Built | null = null;
    try {
      built = build(node, map, model, latest);
    } catch (error) {
      console.error(error);
      setFailedToLoad(true);
    }
    return () => built?.dispose();
  }, [map, model]);

  return <div className="sg-canvas" ref={container}>
    {failedToLoad && <div className="sg-unavailable"><strong>The 3D street is unavailable on this device.</strong><p>The chart below still shows the full scenario.</p></div>}
  </div>;
}

function build(node: HTMLDivElement, map: StreetMap, model: Model, latest: {current: {view: View; shot: Shot; onSelectHome: (i: number | null) => void; onSelectTransformer: (id: string) => void}}): Built {
  const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  node.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Animated 3D view of a Burbank block with four transformers and the homes they serve.');

  const layers = {without: new CSS2DRenderer(), with: new CSS2DRenderer()};
  const labelScenes = {without: new THREE.Scene(), with: new THREE.Scene()};
  for (const mode of ['without', 'with'] as Mode[]) {
    const el = layers[mode].domElement;
    el.className = `sg-labels sg-labels-${mode}`;
    node.appendChild(el);
  }

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#eef1ea', 560, 980);
  const camera = new THREE.OrthographicCamera(-300, 300, 270, -270, 0.1, 3000);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {enableDamping: true, dampingFactor: 0.09, maxPolarAngle: Math.PI / 2.4, minPolarAngle: 0.2, minZoom: 0.55, maxZoom: 4});
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cfa8, 1.5);
  const sun = new THREE.DirectionalLight(0xfffcf3, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -340, right: 340, top: 340, bottom: -340, near: 1, far: 1600});
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(hemi, sun, sun.target);

  // Ground: OSM roads and paths painted on dry summer lawn.
  const size = 640, half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;
  const X = (x: number) => (x + half) / size * 2048, Z = (z: number) => (z + half) / size * 2048;
  ctx.fillStyle = '#e6ddbf';
  ctx.fillRect(0, 0, 2048, 2048);
  const path = (points: number[][]) => {ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Z(p[1])) : ctx.moveTo(X(p[0]), Z(p[1])));};
  for (const f of map.features) if (f.kind === 'park' || f.kind === 'water') {path(f.points); ctx.closePath(); ctx.fillStyle = f.kind === 'water' ? '#b3c8c2' : '#d3d6ad'; ctx.fill();}
  ctx.lineJoin = ctx.lineCap = 'round';
  for (const f of map.features) {
    if (f.kind !== 'road' && f.kind !== 'path') continue;
    const major = /Boulevard/.test(f.name);
    path(f.points);
    if (f.kind === 'path') {ctx.strokeStyle = '#efe8d6'; ctx.lineWidth = 2 / size * 2048; ctx.stroke(); continue;}
    const alley = /^Alley/.test(f.name) || !f.name;
    ctx.strokeStyle = '#f0eadb'; ctx.lineWidth = (alley ? 6 : major ? 24 : 15) / size * 2048; ctx.stroke();
    ctx.strokeStyle = alley ? '#d9d2c1' : '#c9c3b5'; ctx.lineWidth = (alley ? 4 : major ? 19 : 11) / size * 2048; ctx.stroke();
  }
  const groundTexture = new THREE.CanvasTexture(canvas);
  groundTexture.colorSpace = THREE.SRGBColorSpace;
  groundTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({map: groundTexture, roughness: 1}));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const base = new THREE.Mesh(new THREE.BoxGeometry(size, 5, size), new THREE.MeshStandardMaterial({color: '#d9cfae', roughness: 1}));
  base.position.y = -2.6;
  scene.add(base);

  // Buildings: the 38 homes in the demo, then context buildings.
  const homes: HomeParts[] = [];
  const picks: THREE.Object3D[] = [];
  const halo = haloTexture();
  const contextMat = new THREE.MeshStandardMaterial({color: '#ebe5d4', roughness: 0.95});
  const contextRoof = new THREE.MeshStandardMaterial({color: '#ddd4c1', roughness: 0.95});
  const windowGeometry = new THREE.PlaneGeometry(1.5, 1.1);
  const batteryGeometry = new THREE.BoxGeometry(2.2, 0.55, 1.3);
  const pulseGeometry = new THREE.RingGeometry(2.0, 2.6, 40);
  const carColors = ['#5f7f97', '#a8473f', '#e9e6dd', '#3f4a52'];
  for (const f of map.features) {
    if (f.kind !== 'building' || f.points.length < 4) continue;
    const pts = f.points.slice(0, -1);
    if (Math.abs(f.center[0]) > half - 8 || Math.abs(f.center[1]) > half - 8) continue;
    const isHome = f.homeIndex !== undefined;
    const shape = new THREE.Shape();
    pts.forEach((v, i) => i ? shape.lineTo(v[0], -v[1]) : shape.moveTo(v[0], -v[1]));
    shape.closePath();
    const height = isHome ? 4.6 + ((f.homeIndex ?? 0) % 3) * 0.6 : 4.2;
    const bodyGeometry = new THREE.ExtrudeGeometry(shape, {depth: height, bevelEnabled: false});
    bodyGeometry.rotateX(-Math.PI / 2);
    const roofGeometry = new THREE.ExtrudeGeometry(shape, {depth: 1.1, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.35, bevelThickness: 0.25});
    roofGeometry.rotateX(-Math.PI / 2);
    if (!isHome) {
      const body = new THREE.Mesh(bodyGeometry, contextMat);
      const roof = new THREE.Mesh(roofGeometry, contextRoof);
      roof.position.y = height;
      body.castShadow = roof.castShadow = true;
      body.receiveShadow = true;
      scene.add(body, roof);
      continue;
    }
    const index = f.homeIndex!;
    const body = new THREE.Mesh(bodyGeometry, new THREE.MeshStandardMaterial({color: '#fbf8f0', roughness: 0.85, emissive: '#000000'}));
    const roof = new THREE.Mesh(roofGeometry, new THREE.MeshStandardMaterial({color: '#8d8274', roughness: 0.9}));
    roof.position.y = height;
    body.castShadow = roof.castShadow = body.receiveShadow = roof.receiveShadow = true;
    body.userData.home = roof.userData.home = index;
    picks.push(body, roof);
    scene.add(body, roof);
    const cx = f.center[0], cz = f.center[1];
    const extent = Math.max(...pts.map(p => Math.hypot(p[0] - cx, p[1] - cz)));
    const haloMesh = new THREE.Mesh(new THREE.CircleGeometry(extent * 1.8, 40), new THREE.MeshBasicMaterial({map: halo, transparent: true, opacity: 0, depthWrite: false, color: '#5aa9e6'}));
    haloMesh.rotation.x = -Math.PI / 2;
    haloMesh.position.set(cx, 0.2, cz);
    scene.add(haloMesh);
    // Windows on the longer walls, so homes can light up at night and go dark in an outage.
    const windows = new THREE.MeshBasicMaterial({color: '#dcd6c4', side: THREE.DoubleSide, toneMapped: false});
    let placed = 0;
    for (let i = 0; i < pts.length && placed < 8; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 6) continue;
      let nx = dz / length, nz = -dx / length;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if ((mx - cx) * nx + (mz - cz) * nz < 0) {nx = -nx; nz = -nz;}
      for (const t of length >= 11 ? [0.3, 0.7] : [0.5]) {
        const w = new THREE.Mesh(windowGeometry, windows);
        w.position.set(a[0] + dx * t + nx * 0.07, 2.3, a[1] + dz * t + nz * 0.07);
        w.rotation.y = Math.atan2(nx, nz);
        scene.add(w);
        placed++;
      }
    }
    const modelHome = model.homes[index];
    const parts: HomeParts = {index, transformer: f.transformer!, body, roof, halo: haloMesh, windows, center: new THREE.Vector3(cx, 0, cz), roofY: height + 1.6};
    if (modelHome.battery) {
      const box = new THREE.Mesh(batteryGeometry, new THREE.MeshStandardMaterial({color: '#5f9a72', roughness: 0.6, emissive: '#2f8a57', emissiveIntensity: 0}));
      box.position.set(cx, height + 1.6, cz);
      const pulse = new THREE.Mesh(pulseGeometry, new THREE.MeshBasicMaterial({color: '#39b878', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide}));
      pulse.rotation.x = -Math.PI / 2;
      pulse.position.set(cx, height + 2.0, cz);
      scene.add(box, pulse);
      parts.battery = {box, pulse};
    }
    if (modelHome.ev && f.streetX !== undefined) {
      const car = new THREE.Group();
      const paint = new THREE.MeshStandardMaterial({color: carColors[index % carColors.length], roughness: 0.45, metalness: 0.2});
      const lower = new THREE.Mesh(new THREE.BoxGeometry(4.3, 1.0, 1.9), paint);
      lower.position.y = 0.75;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.8, 1.7), new THREE.MeshStandardMaterial({color: '#cfd8dc', roughness: 0.2}));
      cabin.position.set(-0.2, 1.55, 0);
      lower.castShadow = cabin.castShadow = true;
      car.add(lower, cabin);
      const toward = Math.sign(f.streetX - cx);
      car.position.set(f.streetX - toward * 8.5, 0, cz + 4.2);
      scene.add(car);
      parts.car = car;
    }
    homes[index] = parts;
  }

  // Palms and a few street trees on the mapped residential streets.
  const treePoints: THREE.Vector3[] = [];
  let seed = 7;
  const random = () => {seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646;};
  const buildings = map.features.filter(f => f.kind === 'building');
  const inside = (x: number, z: number) => buildings.some(f => Math.abs(f.center[0] - x) < 25 && Math.abs(f.center[1] - z) < 25 && pointInPolygon(x, z, f.points));
  for (const f of map.features) {
    if (f.kind !== 'road' || !f.name || /^Alley|Boulevard/.test(f.name)) continue;
    for (let i = 1; i < f.points.length; i++) {
      const a = f.points[i - 1], b = f.points[i], dx = b[0] - a[0], dz = b[1] - a[1], dist = Math.hypot(dx, dz);
      for (let d = 9; d < dist; d += 21) for (const side of [-1, 1]) {
        const x = a[0] + dx * d / dist - dz / dist * side * 9.5, z = a[1] + dz * d / dist + dx / dist * side * 9.5;
        if (Math.abs(x) < half - 12 && Math.abs(z) < half - 12 && !inside(x, z)) treePoints.push(new THREE.Vector3(x, 0, z));
      }
    }
  }
  const palms = treePoints.filter(() => random() < 0.72), shrubs = treePoints.filter(p => !palms.includes(p));
  const dummy = new THREE.Object3D();
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.38, 1, 6), new THREE.MeshStandardMaterial({color: '#a08c6c', roughness: 1}), palms.length);
  const crowns = new THREE.InstancedMesh(palmCrown(), new THREE.MeshStandardMaterial({color: '#6f8f4e', roughness: 0.9, side: THREE.DoubleSide}), palms.length);
  palms.forEach((p, i) => {
    const h = 10 + random() * 5;
    dummy.position.set(p.x, h / 2, p.z); dummy.scale.set(1, h, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, h, p.z); dummy.scale.setScalar(0.85 + random() * 0.3); dummy.rotation.set(0, random() * Math.PI, 0); dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
  });
  const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.6, 1), new THREE.MeshStandardMaterial({color: '#9aa874', roughness: 1}), shrubs.length);
  shrubs.forEach((p, i) => {dummy.position.set(p.x, 2.2, p.z); dummy.scale.set(1, 0.8, 1); dummy.rotation.set(0, random() * 3, 0); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);});
  trunks.castShadow = crowns.castShadow = leaves.castShadow = true;
  scene.add(trunks, crowns, leaves);

  // Street names from OSM.
  const used = new Set<string>();
  for (const f of map.features) {
    if (f.kind !== 'road' || !f.name || used.has(f.name) || /^Alley/.test(f.name)) continue;
    let best: number[][] | null = null, max = 0;
    for (let i = 1; i < f.points.length; i++) {
      const a = f.points[i - 1], b = f.points[i], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (d > max && Math.abs(mx) < 200 && Math.abs(mz) < 200) {max = d; best = [a, b];}
    }
    if (!best || max < 40) continue;
    used.add(f.name);
    const [a, b] = best;
    const lc = document.createElement('canvas');
    lc.width = 512; lc.height = 64;
    const c = lc.getContext('2d')!;
    c.font = '600 22px Arial'; c.fillStyle = '#8f9480'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(f.name.replace(/^North /, 'N ').replace(/^West /, 'W ').toUpperCase(), 256, 32);
    const tex = new THREE.CanvasTexture(lc);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(72, 9), new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false}));
    let angle = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
    if (angle > Math.PI / 2) angle -= Math.PI; else if (angle < -Math.PI / 2) angle += Math.PI;
    mesh.rotation.set(-Math.PI / 2, 0, angle);
    mesh.position.set((a[0] + b[0]) / 2, 0.3, (a[1] + b[1]) / 2);
    scene.add(mesh);
  }

  // Transformers: pole, cross-arm and can, wired to each of their homes.
  const poleMat = new THREE.MeshStandardMaterial({color: '#8a765c', roughness: 1});
  const canMat = new THREE.MeshStandardMaterial({color: '#8f989c', roughness: 0.5, metalness: 0.3});
  const wires: Wire[] = [];
  const wireMats: Record<string, THREE.MeshBasicMaterial> = {};
  const transformerTops: Record<string, THREE.Vector3> = {};
  const gauges: Record<Mode, Record<string, Label>> = {without: {}, with: {}};
  for (const t of map.transformers) {
    const [px, pz] = t.pole;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 11, 8), poleMat);
    pole.position.set(px, 5.5, pz);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 3), poleMat);
    arm.position.set(px, 10.3, pz);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.4, 14), canMat);
    can.position.set(px + 0.75, 8.6, pz);
    pole.castShadow = can.castShadow = true;
    const pick = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 13, 8), new THREE.MeshBasicMaterial({visible: false}));
    pick.position.set(px, 6.5, pz);
    pick.userData.transformer = can.userData.transformer = t.id;
    picks.push(pick, can);
    scene.add(pole, arm, can, pick);
    const top = new THREE.Vector3(px, 10.3, pz);
    transformerTops[t.id] = new THREE.Vector3(px + 0.75, 9.4, pz);
    wireMats[t.id] = new THREE.MeshBasicMaterial({color: '#5d6a60', transparent: true, opacity: 0.9});
    for (const index of t.homes) {
      const f = map.features.find(x => x.homeIndex === index)!;
      const corner = f.points.slice(0, -1).reduce((best, p) => Math.hypot(p[0] - px, p[1] - pz) < Math.hypot(best[0] - px, best[1] - pz) ? p : best);
      const end = new THREE.Vector3(corner[0], homes[index].roofY - 1.0, corner[1]);
      const mid = top.clone().lerp(end, 0.5);
      mid.y -= 1.4;
      const curve = new THREE.QuadraticBezierCurve3(top, mid, end);
      const line = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.13, 5, false), wireMats[t.id]);
      scene.add(line);
      wires.push({home: index, transformer: t.id, curve, line});
    }
    for (const mode of ['without', 'with'] as Mode[]) {
      const g = label('sg-gauge', `<svg viewBox="0 0 64 64"><circle class="track" cx="32" cy="32" r="26"/><circle class="ghost" cx="32" cy="32" r="30.5"/><circle class="value" cx="32" cy="32" r="26"/><circle class="over" cx="32" cy="32" r="30.5"/></svg><b></b><span>${t.id}</span><i class="shimmer"></i>`);
      g.object.position.set(px + 0.75, 17, pz);
      g.el.addEventListener('click', event => {event.stopPropagation(); latest.current.onSelectTransformer(t.id);});
      labelScenes[mode].add(g.object);
      gauges[mode][t.id] = g;
    }
  }

  // Power-flow particles along the wires.
  const flow = new THREE.InstancedMesh(new THREE.SphereGeometry(0.62, 8, 8), new THREE.MeshBasicMaterial({color: '#ffffff', toneMapped: false}), wires.length * 2);
  flow.frustumCulled = false;
  scene.add(flow);

  // The base-rate credit: a coin that drops onto the medical home's roof.
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.35, 28), new THREE.MeshStandardMaterial({color: '#e2b23c', metalness: 0.6, roughness: 0.3, emissive: '#7a5410', emissiveIntensity: 0.4}));
  coin.visible = false;
  scene.add(coin);

  // Sparks when a transformer fails without OurGrid.
  const sparkCount = 70;
  const sparkGeometry = new THREE.BufferGeometry();
  sparkGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(sparkCount * 3), 3));
  const sparks = new THREE.Points(sparkGeometry, new THREE.PointsMaterial({color: '#ffcf5a', size: 1.6, transparent: true, depthWrite: false}));
  sparks.visible = false;
  sparks.frustumCulled = false;
  scene.add(sparks);
  const sparkDirections = Array.from({length: sparkCount}, () => new THREE.Vector3(random() - 0.5, random() * 0.9 + 0.2, random() - 0.5).normalize().multiplyScalar(6 + random() * 9));
  let sparkStart = -1, lastFailed = false;

  // Labels: temperature chips, EV and medical badges, and the credit.
  const chips: Record<Mode, Label[]> = {without: [], with: []};
  const evBadges: Record<Mode, Label[]> = {without: [], with: []};
  const medicalBadges: Record<Mode, Label[]> = {without: [], with: []};
  const credit: Record<Mode, Label> = {without: label('sg-credit'), with: label('sg-credit')};
  for (const mode of ['without', 'with'] as Mode[]) {
    for (const parts of homes) {
      if (!parts) continue;
      const chip = label('sg-chip');
      chip.object.position.set(parts.center.x, parts.roofY + 4.8, parts.center.z);
      labelScenes[mode].add(chip.object);
      chips[mode][parts.index] = chip;
      if (parts.car) {
        const badge = label('sg-badge sg-ev');
        badge.object.position.set(parts.car.position.x, 5.2, parts.car.position.z);
        labelScenes[mode].add(badge.object);
        evBadges[mode][parts.index] = badge;
      }
      if (model.homes[parts.index].medical) {
        const badge = label('sg-badge sg-medical', ICONS.medical);
        badge.object.position.set(parts.center.x, parts.roofY + 9.5, parts.center.z);
        labelScenes[mode].add(badge.object);
        medicalBadges[mode][parts.index] = badge;
      }
    }
    labelScenes[mode].add(credit[mode].object);
  }

  // Camera shots.
  const centroid = (indices: number[]) => indices.reduce((sum, i) => sum.add(homes[i].center), new THREE.Vector3()).divideScalar(indices.length);
  const focusCentroid = (id: string | null) => id ? centroid(map.transformers.find(t => t.id === id)!.homes) : new THREE.Vector3();
  let azimuth = 0.72, lastTime = performance.now();
  const target = new THREE.Vector3(), goalTarget = new THREE.Vector3();
  let goalRadius = 620, goalZoom = 1, goalPolar = 0.95, lastShot: Shot | null = null;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setShot = (s: Shot, v: View) => {
    const focus = focusCentroid(v.focus ?? 'B');
    const scenario = model.scenarios[v.scenario];
    if (s === 'hero') {goalTarget.set(0, 0, 0); goalZoom = 1.2; goalPolar = 0.98;}
    else if (s === 'wide') {goalTarget.set(0, 0, 0); goalZoom = 1.05; goalPolar = 0.95;}
    else if (s === 'focus') {goalTarget.copy(focus); goalZoom = 1.9; goalPolar = 0.9;}
    else if (s === 'close') {
      const ids = model.homes.filter(h => h.transformer === (v.focus ?? 'B') && (h.ev || h.battery)).map(h => h.index);
      goalTarget.copy(ids.length ? centroid(ids) : focus); goalZoom = 2.5; goalPolar = 0.88;
    } else if (s === 'share' && scenario.share) {
      goalTarget.copy(centroid([...scenario.share.suppliers, scenario.share.recipient])); goalZoom = 2.9; goalPolar = 0.86;
    } else if (s === 'result') {goalTarget.copy(focus); goalZoom = 1.55; goalPolar = 0.92;}
    goalRadius = 620;
  };
  camera.position.set(420, 430, 420);
  camera.zoom = 1;

  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = {x: 0, y: 0};
  const onDown = (e: PointerEvent) => {down = {x: e.clientX, y: e.clientY};};
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(picks, false)[0];
    if (hit?.object.userData.transformer) latest.current.onSelectTransformer(hit.object.userData.transformer);
    else latest.current.onSelectHome(hit ? hit.object.userData.home : null);
  };
  const onMove = (e: PointerEvent) => {
    if (e.buttons) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    node.style.cursor = raycaster.intersectObjects(picks, false).length ? 'pointer' : latest.current.shot === 'free' ? 'grab' : 'default';
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointermove', onMove);

  let width = 0, height = 0;
  const resize = () => {
    width = node.clientWidth; height = node.clientHeight;
    if (!width || !height) return;
    const halfH = 125;
    Object.assign(camera, {left: -halfH * width / height, right: halfH * width / height, top: halfH, bottom: -halfH});
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    layers.without.setSize(width, height);
    layers.with.setSize(width, height);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(node);

  const hot = (v: number) => v >= 100 ? 'red' : v >= 90 ? 'yellow' : 'green';
  let lastSkyTime = -1;

  const apply = (mode: Mode, v: View, now: number) => {
    const scenario = model.scenarios[v.scenario];
    const focus = v.focus;
    const storyFocus = v.beat !== null && v.beat !== 'forecast' && focus;
    const night = sky(v.time).night;
    for (const parts of homes) {
      if (!parts) continue;
      const s = homeState(model, scenario, parts.index, mode, v.time);
      const body = parts.body.material as THREE.MeshStandardMaterial;
      const roof = parts.roof.material as THREE.MeshStandardMaterial;
      const haloMat = parts.halo.material as THREE.MeshBasicMaterial;
      const selected = v.selectedHome === parts.index;
      const dimmed = storyFocus && parts.transformer !== focus;
      body.color.set(s.dark ? '#868b88' : '#fbf8f0');
      roof.color.set(selected ? '#3f7a5c' : s.dark ? '#565a57' : dimmed ? '#c9c0b0' : '#8d8274');
      if (s.glow === 'cool') {body.emissive.set('#3d8fd6'); body.emissiveIntensity = 0.3; haloMat.color.set('#4f9fe3'); haloMat.opacity = 0.85; if (!selected) roof.color.copy(mix('#8d8274', '#5f9fdc', 0.75));}
      else if (s.glow === 'warm') {body.emissive.set('#e08a2c'); body.emissiveIntensity = 0.26; haloMat.color.set('#f0a142'); haloMat.opacity = 0.8; if (!selected) roof.color.copy(mix('#8d8274', '#e39a45', 0.7));}
      else {body.emissiveIntensity = 0; haloMat.opacity = 0;}
      parts.windows.color.copy(s.dark ? new THREE.Color('#24272c') : mix('#d8d2bf', '#ffc65c', 0.2 + night * 0.8));
      if (parts.battery) {
        const active = s.battery !== 'idle';
        const pulse = (Math.sin(now * (s.battery === 'share' ? 0.009 : 0.005)) + 1) / 2;
        (parts.battery.box.material as THREE.MeshStandardMaterial).emissiveIntensity = active ? 0.4 + pulse * 0.9 : 0;
        const ring = parts.battery.pulse.material as THREE.MeshBasicMaterial;
        ring.opacity = active ? 0.75 * (1 - pulse) : 0;
        parts.battery.pulse.scale.setScalar(active ? 1 + pulse * (s.battery === 'share' ? 2.4 : 1.4) : 1);
      }
      const inFocus = parts.transformer === focus || (v.beat === null && v.selectedHome !== null && model.homes[v.selectedHome]?.transformer === parts.transformer);
      const chip = chips[mode][parts.index];
      const showChip = !!chip && inFocus && v.beat !== 'forecast' && !s.dark && !model.homes[parts.index].medical && (v.beat !== null || scenario.at_risk.length > 0);
      chip.object.visible = showChip;
      if (showChip) {
        const temp = Math.round(s.temp);
        setClass(chip.el, `sg-chip ${s.glow ?? ''}`);
        setText(chip, `${temp}${s.glow}`, `${ICONS.thermo}${temp}°F`);
      }
      const badge = evBadges[mode][parts.index];
      if (badge) {
        badge.object.visible = s.ev !== 'none' && (inFocus || v.beat === null);
        setClass(badge.el, `sg-badge sg-ev ${s.ev}`);
        setText(badge, s.ev, s.ev === 'moon' ? `${ICONS.car}${ICONS.moon}<em>10 PM</em>` : `${ICONS.car}${ICONS.bolt}`);
      }
      const medical = medicalBadges[mode][parts.index];
      if (medical) {
        medical.object.visible = v.beat !== 'forecast' || parts.transformer !== focus;
        setClass(medical.el, `sg-badge sg-medical ${parts.transformer === focus && v.beat === 'street' ? 'pop' : ''}`);
      }
    }
    // Wires, particles and the coin.
    const sharing = mode === 'with' && scenario.share && v.time >= scenario.share.start && v.time < scenario.share.end;
    for (const t of map.transformers) {
      const mat = wireMats[t.id];
      const down = failed(scenario, t.id, mode, v.time);
      mat.color.set(down ? '#b9bdb7' : storyFocus && t.id === focus ? '#2f7a56' : '#5d6a60');
      mat.opacity = storyFocus && t.id !== focus ? 0.2 : down ? 0.55 : 0.9;
    }
    const color = new THREE.Color();
    wires.forEach((wire, w) => {
      const down = failed(scenario, wire.transformer, mode, v.time);
      const active = !down && (wire.transformer === focus ? v.beat !== 'forecast' : v.beat === null && v.selectedHome !== null && model.homes[v.selectedHome].transformer === wire.transformer);
      const supplier = sharing && scenario.share!.suppliers.includes(wire.home);
      const recipient = sharing && scenario.share!.recipient === wire.home;
      for (let k = 0; k < 2; k++) {
        let progress = ((now * (supplier || recipient ? 0.00045 : 0.00022) + k * 0.5 + wire.home * 0.137) % 1);
        if (supplier) progress = 1 - progress;
        if (active) {
          dummy.position.copy(wire.curve.getPoint(progress));
          dummy.scale.setScalar(supplier || recipient ? 1.5 : 1);
        } else {
          dummy.position.set(0, -50, 0);
          dummy.scale.setScalar(0.001);
        }
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        flow.setMatrixAt(w * 2 + k, dummy.matrix);
        flow.setColorAt(w * 2 + k, color.set(supplier || recipient ? '#3fd08a' : '#ffe08a'));
      }
    });
    flow.instanceMatrix.needsUpdate = true;
    if (flow.instanceColor) flow.instanceColor.needsUpdate = true;
    const share = scenario.share;
    coin.visible = false;
    for (const m of ['without', 'with'] as Mode[]) credit[m].object.visible = false;
    if (mode === 'with' && share && v.time >= share.start - 0.02) {
      const recipient = homes[share.recipient];
      const fall = Math.min(1, (v.time - (share.start - 0.02)) / (COIN_LANDS - share.start + 0.02));
      coin.visible = true;
      coin.position.set(recipient.center.x, recipient.roofY + 0.4 + (1 - fall) * 26, recipient.center.z);
      coin.rotation.set(fall < 1 ? now * 0.01 : 0, 0, fall < 1 ? 0.4 : 0);
      credit.with.object.visible = fall >= 1;
      credit.with.object.position.set(recipient.center.x, recipient.roofY + 15, recipient.center.z);
      setText(credit.with, 'credit', `<span class="coin"></span>+${share.kwh.toFixed(1)} kWh at base rate`);
    }
    // Gauges.
    for (const t of map.transformers) {
      const g = gauges[mode][t.id];
      const value = gaugeValue(model, scenario, t.id, mode, v.time, v.beat);
      const down = failed(scenario, t.id, mode, v.time);
      const forecast = v.beat === 'forecast' && t.id === focus ? Math.max(...scenario.transformers[t.id].without.slice(0, model.chart_end + 1)) : 0;
      const dim = storyFocus && t.id !== focus;
      setClass(g.el, `sg-gauge ${down ? 'down' : hot(value)} ${value >= 100 && !down ? 'hot' : ''} ${dim ? 'dim' : ''} ${forecast ? 'forecast' : ''} ${t.id === focus && v.beat ? 'focus' : ''}`);
      const svg = g.el.querySelector('svg')!;
      (svg.querySelector('.value') as SVGCircleElement).style.strokeDasharray = `${Math.min(value, 100) / 100 * RING} ${RING}`;
      (svg.querySelector('.over') as SVGCircleElement).style.strokeDasharray = `${Math.max(0, Math.min(value - 100, 100)) / 100 * OUTER} ${OUTER}`;
      (svg.querySelector('.ghost') as SVGCircleElement).style.strokeDasharray = forecast ? `${(forecast - 100) / 100 * OUTER} ${OUTER}` : `0 ${OUTER}`;
      const text = down ? 'OFF' : forecast ? `${Math.round(forecast)}%` : `${Math.round(value)}%`;
      const b = g.el.querySelector('b')!;
      if (b.textContent !== text) b.textContent = text;
    }
    // Sparks and darkness only exist in the world without OurGrid.
    const isDown = !!focus && failed(scenario, focus, 'without', v.time);
    if (mode === 'without') {
      if (isDown && !lastFailed) sparkStart = now;
      lastFailed = isDown;
    }
    const age = (now - sparkStart) / 1000;
    sparks.visible = mode === 'without' && sparkStart > 0 && age < 1.6 && !!focus;
    if (sparks.visible) {
      const origin = transformerTops[focus!];
      const positions = sparkGeometry.getAttribute('position') as THREE.BufferAttribute;
      sparkDirections.forEach((d, i) => positions.setXYZ(i, origin.x + d.x * age, origin.y + d.y * age - 9.8 * age * age, origin.z + d.z * age));
      positions.needsUpdate = true;
      (sparks.material as THREE.PointsMaterial).opacity = 1 - age / 1.6;
    }
  };

  let frame = 0;
  const animate = (now: number) => {
    frame = requestAnimationFrame(animate);
    const {view: v, shot: s} = latest.current;
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    // Sky and sun follow the clock.
    if (Math.abs(v.time - lastSkyTime) > 0.004) {
      lastSkyTime = v.time;
      const k = sky(v.time);
      renderer.setClearColor(k.color);
      (scene.fog as THREE.Fog).color.copy(k.color);
      sun.position.copy(k.direction).multiplyScalar(700);
      sun.intensity = k.sun;
      sun.color.copy(mix('#fffcf3', '#ffbe7d', k.warm));
      hemi.intensity = 1.5 - k.night * 0.6;
      hemi.color.copy(mix('#ffffff', '#8796b8', k.night));
      renderer.toneMappingExposure = 1 - k.night * 0.12;
      renderer.shadowMap.needsUpdate = true;
    }
    // Camera: slow three-quarter orbit between shots, or free when exploring.
    if (s !== lastShot) {setShot(s, v); lastShot = s;}
    controls.enabled = s === 'free';
    if (s !== 'free') {
      if (!reduced) azimuth += dt * (s === 'hero' ? 0.05 : 0.018);
      const ease = reduced ? 1 : 1 - Math.pow(0.04, dt);
      target.lerp(goalTarget, ease);
      const desired = new THREE.Vector3(
        target.x + goalRadius * Math.sin(goalPolar) * Math.sin(azimuth),
        target.y + goalRadius * Math.cos(goalPolar),
        target.z + goalRadius * Math.sin(goalPolar) * Math.cos(azimuth));
      camera.position.lerp(desired, ease);
      camera.zoom += (goalZoom - camera.zoom) * ease;
      camera.updateProjectionMatrix();
      camera.lookAt(target);
      controls.target.copy(target);
    } else {
      controls.update();
    }
    const split = v.split;
    if (s === 'hero') {
      apply(v.mode, v, now);
      renderer.setScissorTest(false);
      renderer.render(scene, camera);
      layers.with.domElement.style.display = layers.without.domElement.style.display = 'none';
    } else if (split === null) {
      apply(v.mode, v, now);
      renderer.setScissorTest(false);
      renderer.render(scene, camera);
      const other: Mode = v.mode === 'with' ? 'without' : 'with';
      layers[v.mode].domElement.style.display = '';
      layers[v.mode].domElement.style.clipPath = '';
      layers[other].domElement.style.display = 'none';
      layers[v.mode].render(labelScenes[v.mode], camera);
    } else {
      const cut = Math.round(width * split);
      renderer.setScissorTest(true);
      apply('without', v, now);
      renderer.setScissor(0, 0, cut, height);
      renderer.render(scene, camera);
      apply('with', v, now);
      renderer.setScissor(cut, 0, width - cut, height);
      renderer.render(scene, camera);
      renderer.setScissorTest(false);
      for (const mode of ['without', 'with'] as Mode[]) {
        const el = layers[mode].domElement;
        el.style.display = '';
        el.style.clipPath = mode === 'without' ? `inset(0 ${100 - split * 100}% 0 0)` : `inset(0 0 0 ${split * 100}%)`;
        layers[mode].render(labelScenes[mode], camera);
      }
    }
  };
  frame = requestAnimationFrame(animate);

  return {
    render: () => renderer.render(scene, camera),
    dispose: () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      scene.traverse(o => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {('map' in m) && (m.map as THREE.Texture | null)?.dispose(); m.dispose();});
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      for (const mode of ['without', 'with'] as Mode[]) layers[mode].domElement.remove();
    },
  };
}

function pointInPolygon(x: number, z: number, points: number[][]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
