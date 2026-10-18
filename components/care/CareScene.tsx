'use client';
import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {CSS2DObject, CSS2DRenderer} from 'three/addons/renderers/CSS2DRenderer.js';
import type {Care, Mode, Timeline, Trip} from './logic';
import {ordinaryState, patientState} from './logic';

export type CareMap = {center: number[]; features: {id: number; kind: string; name: string; points: number[][]; center: number[]; buildingType?: string; homeIndex?: number; street?: string}[]; cooling: {id: number; center: number[]}; depot: number[]; place: string; retrieved: string};
export type CareView = {time: number; mode: Mode; beat: string | null; split: number | null; selected: string | null; risk: number; scenario: string};
export type CareShot = 'hero' | 'wide' | 'street' | 'free';
type Props = {map: CareMap; care: Care; plan: Timeline; view: CareView; shot: CareShot; onSelect: (id: string | null) => void};

const DEVICE_ICONS: Record<string, string> = {
  oxygen: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v3M14 3v3"/><rect x="7" y="6" width="10" height="15" rx="4"/><path d="M10 13h4M12 11v4"/></svg>',
  ventilator: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="12" rx="2"/><path d="M7 12l2-3 2 5 2-4 2 2h2"/><path d="M9 21h6"/></svg>',
  bipap: '<svg viewBox="0 0 24 24"><path d="M6 9a6 6 0 0 1 12 0v3a6 6 0 0 1-12 0z"/><path d="M12 18v3M9 21h6"/></svg>',
  dialysis: '<svg viewBox="0 0 24 24"><path d="M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10z"/></svg>',
  heart_pump: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.3-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.7 12 20 12 20z"/></svg>',
};
const STATUS_ICONS: Record<string, string> = {
  sent: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  confirmed: '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>',
  calling: '<svg viewBox="0 0 24 24"><path d="M6 3h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z"/></svg>',
  flagged: '<svg viewBox="0 0 24 24"><path d="M12 4v10M12 18v1"/></svg>',
  ambulance: '<svg viewBox="0 0 24 24"><path d="M3 16V8h10v8M13 11h4l3 3v2H13"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M8 9v4M6 11h4"/></svg>',
  warning: '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/></svg>',
  scheduled: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  tanks: '<svg viewBox="0 0 24 24"><rect x="5" y="7" width="5" height="13" rx="2.5"/><rect x="14" y="7" width="5" height="13" rx="2.5"/><path d="M7.5 4v3M16.5 4v3"/></svg>',
};
const RING = 2 * Math.PI * 21;

const mix = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, t)));
function sky(hour: number) {
  const h = hour % 24;
  const stops: [number, string][] = [[0, '#3a4560'], [5.5, '#56627c'], [7, '#e9e2d4'], [9, '#eef1ea'], [17, '#efebe1'], [18.75, '#f3dfc4'], [19.75, '#c9ac9c'], [20.5, '#727d93'], [21.5, '#56627c'], [24, '#3a4560']];
  let color = new THREE.Color(stops[0][1]);
  for (let i = 1; i < stops.length; i++) if (h <= stops[i][0]) {color = mix(stops[i - 1][1], stops[i][1], (h - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); break;}
  const day = Math.max(0, Math.sin(Math.PI * (h - 6) / 14));
  const azimuth = THREE.MathUtils.degToRad(90 + ((h - 6) / 14) * 180);
  const el = THREE.MathUtils.degToRad(Math.max(4, day * 72));
  return {color, direction: new THREE.Vector3(Math.sin(azimuth) * Math.cos(el), Math.sin(el), -Math.cos(azimuth) * Math.cos(el)), sun: 2.3 * Math.min(1, day * 2.2), night: Math.max(0, 1 - day * 3)};
}

function palmCrown() {
  const positions: number[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const side = [-s * 0.45, c * 0.45], tip = [c * 4.2, s * 4.2], mid = [c * 2.2, s * 2.2];
    positions.push(0, 0.3, 0, mid[0] + side[0], 0.5, mid[1] + side[1], tip[0], -1.5, tip[1], 0, 0.3, 0, tip[0], -1.5, tip[1], mid[0] - side[0], 0.5, mid[1] - side[1]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

export default function CareScene(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let dispose = () => {};
    try {dispose = build(container.current!, props.map, props.care, props.plan, latest);} catch (error) {console.error(error); setFailed(true);}
    return () => dispose();
  }, [props.map, props.care, props.plan]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="sg-canvas" ref={container}>{failed && <div className="sg-unavailable"><strong>The 3D view is unavailable on this device.</strong><p>The ranked list still shows every patient.</p></div>}</div>;
}

function build(node: HTMLDivElement, map: CareMap, care: Care, plan: Timeline, latest: {current: Props}) {
  const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  node.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'Animated 3D view of a North Hollywood neighborhood with fictional older patients on home medical devices.');
  const layers = {without: new CSS2DRenderer(), with: new CSS2DRenderer()};
  const labelScenes = {without: new THREE.Scene(), with: new THREE.Scene()};
  for (const mode of ['without', 'with'] as Mode[]) {layers[mode].domElement.className = 'sg-labels'; node.appendChild(layers[mode].domElement);}

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#eef1ea', 560, 980);
  const camera = new THREE.OrthographicCamera(-300, 300, 125, -125, 0.1, 3000);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, {enableDamping: true, dampingFactor: 0.09, maxPolarAngle: Math.PI / 2.4, minPolarAngle: 0.2, minZoom: 0.5, maxZoom: 4});
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cfa8, 1.5);
  const sun = new THREE.DirectionalLight(0xfffcf3, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -360, right: 360, top: 360, bottom: -360, near: 1, far: 1600});
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(hemi, sun, sun.target);

  // Ground and roads.
  const size = 700, half = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;
  const X = (x: number) => (x + half) / size * 2048, Z = (z: number) => (z + half) / size * 2048;
  const path = (c: CanvasRenderingContext2D, pts: number[][]) => {c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1])));};
  ctx.fillStyle = '#e6ddbf'; ctx.fillRect(0, 0, 2048, 2048);
  ctx.lineJoin = ctx.lineCap = 'round';
  const roads = map.features.filter(f => f.kind === 'road');
  for (const f of map.features) if (f.kind === 'park') {path(ctx, f.points); ctx.closePath(); ctx.fillStyle = '#d3d6ad'; ctx.fill();}
  for (const f of roads) {
    const major = /Boulevard|Avenue$/.test(f.name) && !f.name.includes('Alley') ? 1 : 0;
    path(ctx, f.points);
    ctx.strokeStyle = '#f0eadb'; ctx.lineWidth = (major ? 16 : 13) / size * 2048; ctx.stroke();
    ctx.strokeStyle = '#c9c3b5'; ctx.lineWidth = (major ? 12 : 9) / size * 2048; ctx.stroke();
  }
  const groundTexture = new THREE.CanvasTexture(canvas);
  groundTexture.colorSpace = THREE.SRGBColorSpace;
  groundTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({map: groundTexture, roughness: 1}));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Street outage-risk overlay (fictional), painted along each named street.
  const riskCanvas = document.createElement('canvas');
  riskCanvas.width = riskCanvas.height = 1024;
  const rctx = riskCanvas.getContext('2d')!;
  const RX = (x: number) => (x + half) / size * 1024, RZ = (z: number) => (z + half) / size * 1024;
  const paintRisk = (outage: boolean) => {
    rctx.clearRect(0, 0, 1024, 1024);
    rctx.filter = 'blur(10px)';
    rctx.lineJoin = rctx.lineCap = 'round';
    for (const f of roads) {
      const risk = care.streets[f.name];
      if (risk === undefined) continue;
      rctx.beginPath();
      f.points.forEach((p, i) => i ? rctx.lineTo(RX(p[0]), RZ(p[1])) : rctx.moveTo(RX(p[0]), RZ(p[1])));
      rctx.strokeStyle = outage && f.name === care.outage.street ? 'rgba(90,96,104,0.75)' : risk >= 0.6 ? 'rgba(214,84,64,0.55)' : risk >= 0.3 ? 'rgba(230,170,60,0.5)' : 'rgba(96,170,110,0.4)';
      rctx.lineWidth = 34;
      rctx.stroke();
    }
    riskTexture.needsUpdate = true;
  };
  const riskTexture = new THREE.CanvasTexture(riskCanvas);
  const riskMat = new THREE.MeshBasicMaterial({map: riskTexture, transparent: true, opacity: 0, depthWrite: false});
  const riskPlane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), riskMat);
  riskPlane.rotation.x = -Math.PI / 2;
  riskPlane.position.y = 0.35;
  scene.add(riskPlane);
  paintRisk(false);
  let riskOutage = false;

  // Buildings. Homes on the outage street share materials so the whole street can go dark.
  const homeMat = new THREE.MeshStandardMaterial({color: '#fbf8f0', roughness: 0.85});
  const homeRoof = new THREE.MeshStandardMaterial({color: '#8d8274', roughness: 0.9});
  const outageMat = new THREE.MeshStandardMaterial({color: '#fbf8f0', roughness: 0.85});
  const outageRoof = new THREE.MeshStandardMaterial({color: '#8d8274', roughness: 0.9});
  const contextMat = new THREE.MeshStandardMaterial({color: '#ebe5d4', roughness: 0.95});
  const contextRoof = new THREE.MeshStandardMaterial({color: '#ddd4c1', roughness: 0.95});
  const windowsLit = new THREE.MeshBasicMaterial({color: '#dcd6c4', toneMapped: false, side: THREE.DoubleSide});
  const windowsOutage = new THREE.MeshBasicMaterial({color: '#dcd6c4', toneMapped: false, side: THREE.DoubleSide});
  const windowGeometry = new THREE.PlaneGeometry(1.5, 1.1);
  const homes: Record<number, {center: THREE.Vector3; roofY: number; curb: THREE.Vector3; roof: THREE.Mesh}> = {};
  const picks: THREE.Object3D[] = [];
  const patientByHome = new Map(care.patients.map(p => [p.home, p.id]));
  for (const f of map.features) {
    if (f.kind !== 'building' || f.points.length < 4 || Math.abs(f.center[0]) > half - 6 || Math.abs(f.center[1]) > half - 6) continue;
    const pts = f.points.slice(0, -1);
    const shape = new THREE.Shape();
    pts.forEach((v, i) => i ? shape.lineTo(v[0], -v[1]) : shape.moveTo(v[0], -v[1]));
    shape.closePath();
    const isHome = f.homeIndex !== undefined;
    const outage = isHome && f.street === care.outage.street;
    const height = isHome ? 4.6 + ((f.homeIndex ?? 0) % 3) * 0.6 : f.id === map.cooling.id ? 8 : 4.2;
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: height, bevelEnabled: false}).rotateX(-Math.PI / 2), isHome ? (outage ? outageMat : homeMat) : contextMat);
    const patient = isHome && patientByHome.has(f.homeIndex!);
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: 1.1, bevelEnabled: true, bevelSegments: 1, bevelSize: 0.35, bevelThickness: 0.25}).rotateX(-Math.PI / 2),
      patient ? new THREE.MeshStandardMaterial({color: '#7b6f61', roughness: 0.9}) : isHome ? (outage ? outageRoof : homeRoof) : f.id === map.cooling.id ? new THREE.MeshStandardMaterial({color: '#5f8fb0'}) : contextRoof);
    roof.position.y = height;
    body.castShadow = roof.castShadow = body.receiveShadow = true;
    scene.add(body, roof);
    if (!isHome) continue;
    const cx = f.center[0], cz = f.center[1];
    // Windows on the two longest walls.
    const edges = pts.map((a, i) => ({a, b: pts[(i + 1) % pts.length]})).sort((e1, e2) => Math.hypot(e2.b[0] - e2.a[0], e2.b[1] - e2.a[1]) - Math.hypot(e1.b[0] - e1.a[0], e1.b[1] - e1.a[1])).slice(0, 2);
    for (const {a, b} of edges) {
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 5) continue;
      let nx = dz / length, nz = -dx / length;
      if (((a[0] + b[0]) / 2 - cx) * nx + ((a[1] + b[1]) / 2 - cz) * nz < 0) {nx = -nx; nz = -nz;}
      const w = new THREE.Mesh(windowGeometry, outage ? windowsOutage : windowsLit);
      w.position.set(a[0] + dx / 2 + nx * 0.07, 2.3, a[1] + dz / 2 + nz * 0.07);
      w.rotation.y = Math.atan2(nx, nz);
      scene.add(w);
    }
    if (patient) {body.userData.patient = roof.userData.patient = patientByHome.get(f.homeIndex!); picks.push(body, roof);}
    homes[f.homeIndex!] = {center: new THREE.Vector3(cx, 0, cz), roofY: height + 1.5, curb: new THREE.Vector3(cx, 0, cz), roof};
  }

  // Palms along residential streets.
  let seed = 11;
  const random = () => {seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646;};
  const palmPoints: THREE.Vector3[] = [];
  for (const f of roads) {
    if (!care.streets[f.name]) continue;
    for (let i = 1; i < f.points.length; i++) {
      const a = f.points[i - 1], b = f.points[i], dx = b[0] - a[0], dz = b[1] - a[1], dist = Math.hypot(dx, dz);
      for (let d = 12; d < dist; d += 30) for (const side of [-1, 1]) {
        const x = a[0] + dx * d / dist - dz / dist * side * 8, z = a[1] + dz * d / dist + dx / dist * side * 8;
        if (Math.abs(x) < half - 10 && Math.abs(z) < half - 10 && random() < 0.6) palmPoints.push(new THREE.Vector3(x, 0, z));
      }
    }
  }
  const dummy = new THREE.Object3D();
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.38, 1, 6), new THREE.MeshStandardMaterial({color: '#a08c6c'}), palmPoints.length);
  const crowns = new THREE.InstancedMesh(palmCrown(), new THREE.MeshStandardMaterial({color: '#6f8f4e', side: THREE.DoubleSide}), palmPoints.length);
  palmPoints.forEach((p, i) => {
    const h = 10 + random() * 5;
    dummy.position.set(p.x, h / 2, p.z); dummy.scale.set(1, h, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, h, p.z); dummy.scale.setScalar(0.85 + random() * 0.3); dummy.rotation.set(0, random() * Math.PI, 0); dummy.updateMatrix(); crowns.setMatrixAt(i, dummy.matrix);
  });
  trunks.castShadow = crowns.castShadow = true;
  scene.add(trunks, crowns);

  // Road graph for vehicles: OSM ways share nodes at intersections.
  const key = (p: number[]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
  const graph = new Map<string, {p: THREE.Vector3; next: Map<string, number>}>();
  for (const f of roads) {
    for (let i = 0; i < f.points.length; i++) {
      const k = key(f.points[i]);
      if (!graph.has(k)) graph.set(k, {p: new THREE.Vector3(f.points[i][0], 0, f.points[i][1]), next: new Map()});
      if (i) {
        const j = key(f.points[i - 1]), d = Math.hypot(f.points[i][0] - f.points[i - 1][0], f.points[i][1] - f.points[i - 1][1]);
        graph.get(k)!.next.set(j, d);
        graph.get(j)!.next.set(k, d);
      }
    }
  }
  const nearest = (v: THREE.Vector3) => {let best = '', d = Infinity; for (const [k, n] of graph) {const dd = n.p.distanceTo(v); if (dd < d && n.next.size) {d = dd; best = k;}} return best;};
  const route = (a: THREE.Vector3, b: THREE.Vector3) => {
    const s = nearest(a), e = nearest(b), dist = new Map([[s, 0]]), prev = new Map<string, string>(), open = new Set([s]);
    while (open.size) {
      let u = '', du = Infinity;
      for (const k of open) if ((dist.get(k) ?? Infinity) < du) {du = dist.get(k)!; u = k;}
      open.delete(u);
      if (u === e) break;
      for (const [v, w] of graph.get(u)!.next) if (du + w < (dist.get(v) ?? Infinity)) {dist.set(v, du + w); prev.set(v, u); open.add(v);}
    }
    const points = [b.clone()];
    for (let k: string | undefined = e; k; k = prev.get(k)) points.unshift(graph.get(k)!.p.clone());
    points.unshift(a.clone());
    return points;
  };
  for (const h of Object.values(homes)) h.curb.copy(graph.get(nearest(h.center))!.p);
  const coolingPoint = new THREE.Vector3(map.cooling.center[0], 0, map.cooling.center[1]);
  const depotPoint = new THREE.Vector3(map.depot[0], 0, map.depot[1]);
  const placeOf = (where: Trip['from']) => where.home !== undefined ? homes[where.home].curb : where.place === 'cooling' ? graph.get(nearest(coolingPoint))!.p : depotPoint;
  const vehicle = (color: string, cabin: string, length = 5) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(length, 2.2, 2.2), new THREE.MeshStandardMaterial({color, roughness: 0.5}));
    body.position.y = 1.5;
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 2.1), new THREE.MeshStandardMaterial({color: cabin, roughness: 0.3}));
    front.position.set(length / 2 + 0.5, 1.15, 0);
    body.castShadow = true;
    g.add(body, front);
    g.visible = false;
    scene.add(g);
    return g;
  };
  const trips = plan.trips.map(t => {
    const pts = route(placeOf(t.from), placeOf(t.to));
    const lengths = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    return {...t, pts, lengths, total: lengths.reduce((a, b) => a + b, 0), mesh: t.vehicle === 'car' ? vehicle('#5f7f97', '#cfd8dc', 3.6) : t.vehicle === 'oxygen' ? vehicle('#e9eef5', '#3e7fbf') : vehicle('#ffffff', '#2e7655')};
  });
  const place = (trip: typeof trips[number], progress: number) => {
    let d = progress * trip.total;
    for (let i = 0; i < trip.lengths.length; i++) {
      if (d <= trip.lengths[i] || i === trip.lengths.length - 1) {
        const a = trip.pts[i], b = trip.pts[i + 1], f = trip.lengths[i] ? Math.min(1, d / trip.lengths[i]) : 1;
        trip.mesh.position.copy(a).lerp(b, f);
        if (trip.lengths[i] > 0.1) trip.mesh.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
        return;
      }
      d -= trip.lengths[i];
    }
  };

  // Labels: one pin per patient (per world, for the split view), the cooling centre and the depot.
  type Pin = {object: CSS2DObject; el: HTMLDivElement; key: string};
  const pins: Record<Mode, Record<string, Pin>> = {without: {}, with: {}};
  for (const mode of ['without', 'with'] as Mode[]) {
    for (const p of care.patients) {
      const anchor = document.createElement('div');
      const el = document.createElement('div');
      anchor.appendChild(el);
      el.addEventListener('click', e => {e.stopPropagation(); latest.current.onSelect(p.id);});
      const object = new CSS2DObject(anchor);
      object.position.set(homes[p.home].center.x, homes[p.home].roofY + 6, homes[p.home].center.z);
      labelScenes[mode].add(object);
      pins[mode][p.id] = {object, el, key: ''};
    }
    for (const [text, where, cls] of [['Cooling center', coolingPoint, 'cooling'], ['Agency depot', depotPoint, 'depot']] as const) {
      const anchor = document.createElement('div');
      anchor.innerHTML = `<div class="cg-place ${cls}">${text}</div>`;
      const object = new CSS2DObject(anchor);
      object.position.set(where.x, 13, where.z);
      labelScenes[mode].add(object);
    }
  }

  // Camera.
  const outageHomes = care.patients.filter(p => p.street === care.outage.street).map(p => homes[p.home].center);
  const outageCenter = outageHomes.reduce((s, v) => s.add(v), new THREE.Vector3()).divideScalar(Math.max(1, outageHomes.length));
  let azimuth = 0.7, lastShot: CareShot | null = null, lastTime = performance.now(), shift = 0, goalShift = 0;
  const target = new THREE.Vector3(), goalTarget = new THREE.Vector3();
  let goalZoom = 1, goalPolar = 0.95;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setShot = (s: CareShot) => {
    goalShift = s === 'hero' ? -0.38 : 0;
    if (s === 'hero') {goalTarget.set(0, 0, 0); goalZoom = 1.05; goalPolar = 0.98;}
    else if (s === 'wide') {goalTarget.set(0, 0, 0); goalZoom = 0.95; goalPolar = 0.92;}
    else if (s === 'street') {goalTarget.copy(outageCenter); goalZoom = 1.7; goalPolar = 0.88;}
  };
  camera.position.set(420, 430, 420);

  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = {x: 0, y: 0};
  const onDown = (e: PointerEvent) => {down = {x: e.clientX, y: e.clientY};};
  const onUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    latest.current.onSelect(raycaster.intersectObjects(picks, false)[0]?.object.userData.patient ?? null);
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  let width = 0, height = 0, halfW = 125;
  const frame3d = () => Object.assign(camera, {left: -halfW - shift * halfW, right: halfW - shift * halfW});
  const resize = () => {
    width = node.clientWidth; height = node.clientHeight;
    if (!width || !height) return;
    halfW = 125 * width / height;
    Object.assign(camera, {top: 125, bottom: -125});
    frame3d();
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    layers.with.setSize(width, height);
    layers.without.setSize(width, height);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(node);
  let visible = true;
  const seen = new IntersectionObserver(entries => {visible = entries.some(e => e.isIntersecting);});
  seen.observe(node);

  const apply = (mode: Mode, v: CareView) => {
    const outageOn = v.scenario === 'heat' && v.time >= care.outage.start;
    const k = sky(v.time);
    const darkOutage = outageOn;
    outageMat.color.set(darkOutage ? '#7f8482' : '#fbf8f0');
    outageRoof.color.set(darkOutage ? '#535654' : '#8d8274');
    windowsOutage.color.copy(darkOutage ? new THREE.Color('#24272c') : mix('#d8d2bf', '#ffc65c', 0.2 + k.night * 0.8));
    windowsLit.color.copy(mix('#d8d2bf', '#ffc65c', 0.2 + k.night * 0.8));
    if (outageOn !== riskOutage) {riskOutage = outageOn; paintRisk(outageOn);}
    riskMat.opacity = v.risk;
    for (const trip of trips) {
      const showTrip = v.scenario === 'heat' && mode === 'with' && v.time >= trip.depart && v.time <= trip.arrive + 0.35;
      trip.mesh.visible = showTrip;
      if (showTrip) place(trip, Math.min(1, (v.time - trip.depart) / (trip.arrive - trip.depart)));
    }
    for (const p of care.patients) {
      const pin = pins[mode][p.id];
      const s = v.scenario === 'ordinary' ? ordinaryState(care, p, v.time) : patientState(care, plan, p, mode, v.time);
      const show = v.beat !== 'forecast' && v.beat !== null || v.selected !== null || v.beat === null;
      pin.object.visible = show && !s.moved;
      if (!pin.object.visible) continue;
      const hours = s.countdown ?? s.hours;
      const label = hours >= 100 ? '99+ h' : hours >= 10 ? `${Math.round(hours)} h` : `${hours.toFixed(1)} h`;
      const ring = s.countdown !== null && s.full > 0 ? Math.max(0, Math.min(1, s.countdown / s.full)) : null;
      const status = s.status === 'none' ? '' : s.status;
      const nextKey = `${s.tier}|${label}|${status}|${ring === null ? '' : ring.toFixed(2)}|${v.selected === p.id}|${s.note ?? ''}`;
      if (nextKey === pin.key) continue;
      pin.key = nextKey;
      pin.el.className = `cg-pin ${s.tier} ${status} ${v.selected === p.id ? 'selected' : ''}`;
      const icon = status === 'delivered' || status === 'swapped' ? STATUS_ICONS.confirmed : STATUS_ICONS[status] ?? '';
      pin.el.innerHTML = `${ring !== null ? `<svg class="cg-ring" viewBox="0 0 48 48"><circle cx="24" cy="24" r="21"/><circle class="left" cx="24" cy="24" r="21" style="stroke-dasharray:${(ring * RING).toFixed(1)} ${RING.toFixed(1)}"/></svg>` : ''}`
        + `<span class="cg-device">${DEVICE_ICONS[p.device]}</span><span class="cg-age">${p.age >= 75 ? '75+' : p.age}</span><b class="cg-hours">${label}</b>`
        + (status ? `<i class="cg-status ${status}">${icon}${status === 'calling' ? '<em>Care coordinator calling</em>' : status === 'ambulance' ? '<em>911</em>' : status === 'tanks' ? '<em>O₂ tanks</em>' : status === 'sent' ? '<em>Check-in sent</em>' : status === 'warning' ? `<em>${s.note}</em>` : status === 'scheduled' ? '<em>Replacement scheduled</em>' : ''}</i>` : '');
    }
  };

  let frame = 0, lastSky = -1;
  const animate = (now: number) => {
    frame = requestAnimationFrame(animate);
    if (!visible || document.hidden) {lastTime = now; return;}
    const {view: v, shot: s} = latest.current;
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    if (Math.abs(v.time - lastSky) > 0.004) {
      lastSky = v.time;
      const k = sky(v.time);
      renderer.setClearColor(k.color);
      (scene.fog as THREE.Fog).color.copy(k.color);
      sun.position.copy(k.direction).multiplyScalar(700);
      sun.intensity = k.sun;
      hemi.intensity = 1.5 - k.night * 0.5;
      hemi.color.copy(mix('#ffffff', '#8796b8', k.night));
      renderer.shadowMap.needsUpdate = true;
    }
    if (s !== lastShot) {setShot(s); lastShot = s;}
    controls.enabled = s === 'free';
    if (s !== 'free') {
      if (!reduced) azimuth += dt * (s === 'hero' ? 0.05 : 0.018);
      const ease = reduced ? 1 : 1 - Math.pow(0.04, dt);
      target.lerp(goalTarget, ease);
      camera.position.lerp(new THREE.Vector3(target.x + 620 * Math.sin(goalPolar) * Math.sin(azimuth), 620 * Math.cos(goalPolar), target.z + 620 * Math.sin(goalPolar) * Math.cos(azimuth)), ease);
      camera.zoom += (goalZoom - camera.zoom) * ease;
      shift += (goalShift - shift) * ease;
      frame3d();
      camera.updateProjectionMatrix();
      camera.lookAt(target);
      controls.target.copy(target);
    } else controls.update();
    const hide = s === 'hero';
    if (v.split === null) {
      apply(v.mode, v);
      renderer.setScissorTest(false);
      renderer.render(scene, camera);
      const other: Mode = v.mode === 'with' ? 'without' : 'with';
      layers[other].domElement.style.display = 'none';
      layers[v.mode].domElement.style.display = hide ? 'none' : '';
      layers[v.mode].domElement.style.clipPath = '';
      if (!hide) layers[v.mode].render(labelScenes[v.mode], camera);
    } else {
      const cut = Math.round(width * v.split);
      renderer.setScissorTest(true);
      apply('without', v); renderer.setScissor(0, 0, cut, height); renderer.render(scene, camera);
      apply('with', v); renderer.setScissor(cut, 0, width - cut, height); renderer.render(scene, camera);
      renderer.setScissorTest(false);
      for (const mode of ['without', 'with'] as Mode[]) {
        const el = layers[mode].domElement;
        el.style.display = '';
        el.style.clipPath = mode === 'without' ? `inset(0 ${100 - v.split * 100}% 0 0)` : `inset(0 0 0 ${v.split * 100}%)`;
        layers[mode].render(labelScenes[mode], camera);
      }
    }
  };
  frame = requestAnimationFrame(animate);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    seen.disconnect();
    controls.dispose();
    renderer.domElement.removeEventListener('pointerdown', onDown);
    renderer.domElement.removeEventListener('pointerup', onUp);
    scene.traverse(o => {if (o instanceof THREE.Mesh) {o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());}});
    renderer.dispose();
    renderer.domElement.remove();
    for (const mode of ['without', 'with'] as Mode[]) layers[mode].domElement.remove();
  };
}
