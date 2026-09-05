import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildHouse } from './house.js';
import { sectionMesh } from './section.js';
import { buildSite } from './site.js';
import { appAssetUrl } from './asset-url.js';
import './style.css';

const paths = {
  house: '<path d="M3 11 12 3l9 8v10H3z"/><path d="M8 21v-8h8v8M3 11h18"/>',
  cube: '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M8 5l9 5"/>',
  plan: '<rect x="4" y="4" width="16" height="16"/><path d="M4 11h9V4M13 15v5M13 11h7"/>',
  layers: '<path d="m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  export: '<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  sources: '<path d="M5 3h11l3 3v15H5zM15 3v5h4M8 12h8M8 16h6"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  ruler: '<path d="m3 16 13-13 5 5L8 21zM7 12l2 2M10 9l2 2M13 6l2 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  upload: '<path d="M12 16V3m-4 4 4-4 4 4M4 15v6h16v-6"/>',
  fit: '<path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/>',
  north: '<path d="m12 3 7 18-7-5-7 5zM12 3v13"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.house}</svg>`;
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = id => document.getElementById(id);
const assetUrl = path => appAssetUrl(path, import.meta.env.BASE_URL);

document.querySelector('#app').innerHTML = `
<div class="app-shell">
  <header class="topbar">
    <div class="brand"><button class="icon-button mobile-menu" id="menu-button" aria-label="Öppna modellverktyg" aria-expanded="false">${icon('menu')}</button><div class="brand-mark">${icon('house')}</div><div class="brand-title"><h1>Avstyckningsvägen 5</h1><p>En plats att utforska · Arkitekturmodell</p></div></div>
    <div class="top-actions"><span class="project-status"><i class="status-dot"></i><span id="project-status">Underlag saknas</span></span><button class="button" id="sources-button">${icon('sources')}<span>Underlag & källor</span></button><button class="button primary" id="export-button" title="Spara aktuell vy som PNG">${icon('export')}<span>Spara vy</span></button></div>
  </header>
  <main class="workspace">
    <aside class="inspector" id="inspector" aria-label="Modellverktyg">
      <div class="project-intro"><button class="icon-button mobile-close" id="menu-close" aria-label="Stäng modellverktyg">${icon('close')}</button><div class="eyebrow">Fastighetsstudie / 005</div><h2>Ditt hus.<br>Från alla håll.</h2><p id="project-description">Utforska byggnaden, öppna taket<br>och se hur rummen hänger ihop.</p></div>
      <section class="inspector-section"><div class="section-heading"><h3>Vy & projektion</h3><span class="section-number">01</span></div><div class="segmented view-segments" aria-label="Välj projektion"><button id="projection-perspective" aria-pressed="true">Perspektiv</button><button id="projection-orthographic" aria-pressed="false">Ortografisk</button></div><div class="preset-grid" aria-label="Välj sida"><button id="view-3d" data-preset="iso" aria-pressed="true">${icon('cube')}3D / Iso</button><button data-preset="street" aria-pressed="false">Gata</button><button data-preset="garden" aria-pressed="false">Trädgård</button><button data-preset="entrance" aria-pressed="false">Entré</button><button data-preset="opposite" aria-pressed="false">Gavel</button><button id="view-plan" data-preset="top" aria-pressed="false">${icon('plan')}Ovanifrån</button></div><p class="control-help" id="view-help">Dra för att rotera. Skrolla för att komma närmare.</p></section>
      <section class="inspector-section site-section"><div class="section-heading"><h3>Tomt & terräng</h3><span class="section-number">02</span></div><div class="control-row"><span>Visa hela tomten</span><button class="toggle" id="site-toggle" aria-label="Visa terräng och hela tomten" aria-pressed="false" disabled></button></div><label class="control-row" id="outside-style-label">Utanför tomten</label><div class="segmented outside-style" aria-labelledby="outside-style-label"><button data-outside-style="grid" aria-pressed="true">Rutnät</button><button data-outside-style="contours" aria-pressed="false">Höjdkurvor</button></div><button class="button site-fit-button" id="site-fit-button" disabled>${icon('fit')}Visa hela tomten</button><p class="control-help" id="site-status" role="status">Läser terrängunderlag…</p><button class="text-button hidden" id="site-retry">Försök igen</button></section>
      <section class="inspector-section"><div class="section-heading"><h3>Byggnadens lager</h3><span class="section-number">03</span></div><div class="control-row"><span>Visa tak</span><button class="toggle" id="roof-toggle" aria-label="Visa tak" aria-pressed="true"></button></div><label for="floor-select" class="control-row">Våningsplan</label><select class="select" id="floor-select"><option value="all">Hela byggnaden</option></select><div class="range-row"><label for="explode-range">Separera våningar</label><output class="range-value" id="explode-value">0,0 m</output></div><input id="explode-range" type="range" min="0" max="6" step="0.1" value="0" aria-label="Avstånd mellan våningar"><div class="range-endpoints"><span>Sammanhållet</span><span>Isärtaget</span></div></section>
      <section class="inspector-section"><div class="section-heading"><h3>Skär genom huset</h3><span class="section-number">04</span></div><div class="control-row"><span>Aktivera snitt</span><button class="toggle" id="cut-toggle" aria-label="Aktivera snitt" aria-pressed="false"></button></div><div class="axis-controls" id="cut-controls"><div class="segmented" aria-label="Snittets riktning"><button data-axis="x" aria-pressed="false">X · Bredd</button><button data-axis="z" aria-pressed="false">Y · Djup</button><button data-axis="y" aria-pressed="true">Z · Höjd</button></div><div class="range-row"><label for="cut-range">Snittläge</label><output class="range-value" id="cut-value">—</output></div><input id="cut-range" type="range" min="0" max="100" value="46" step="0.25" aria-label="Snittplanets position"><div class="control-row"><span>Vänd snittriktning</span><button class="toggle" id="cut-flip" aria-label="Vänd snittriktning" aria-pressed="false"></button></div></div><p class="control-help" id="cut-help">Flytta snittet för att upptäcka insidan.</p></section>
      <section class="inspector-section"><div class="section-heading"><h3>Mät & orientera</h3><span class="section-number">05</span></div><button class="button measure-button" id="measure-button" aria-pressed="false"><span>${icon('ruler')}Mät mellan två punkter</span><span>↗</span></button><p class="measure-value hidden" id="measure-value">— <small>meter</small></p><p class="control-help" id="measure-help">Klicka på två synliga ytor i modellen.</p><div class="control-row"><span>Rumsnamn</span><button class="toggle" id="labels-toggle" aria-label="Visa rumsnamn" aria-pressed="true"></button></div><div class="control-row"><span>Visa omgivning</span><button class="toggle" id="grid-toggle" aria-label="Visa omgivningens linjer" aria-pressed="true"></button></div><div class="evidence-note">${icon('info')}<span id="evidence-note">Modellens mått och interiör behöver verifieras mot ritningar och fotografier.</span></div></section>
    </aside>
    <section class="viewport" id="viewport" aria-label="Interaktiv 3D-modell">
      <div class="viewport-top"><div class="view-caption"><span class="line"></span><span id="view-caption">Perspektiv / Modellvy</span></div><div class="scene-badge" id="scene-badge">Underlag saknas</div></div>
      <div class="cut-indicator hidden" id="cut-indicator"></div>
      <div class="viewport-toolstrip" aria-label="Kameraverktyg"><button class="icon-button" id="fit-button" title="Anpassa modellen till vyn" aria-label="Anpassa modellen till vyn">${icon('fit')}</button><button class="icon-button" id="reset-button" title="Återställ vyn" aria-label="Återställ vyn">${icon('reset')}</button><div class="divider"></div><button class="icon-button" id="zoom-in" title="Zooma in" aria-label="Zooma in">${icon('plus')}</button><button class="icon-button" id="zoom-out" title="Zooma ut" aria-label="Zooma ut">${icon('minus')}</button></div>
      <div id="labels-layer" aria-hidden="true"></div>
      <div class="empty-state hidden" id="empty-state"><div class="empty-symbol">${icon('house')}</div><div class="eyebrow">Modellunderlag</div><h2 style="margin-top:9px">Huset börjar med underlaget.</h2><p>Byggnadens form och rum visas när det finns tillräckligt med ritningar, mått och bilder för en spårbar modell.</p><button class="button" id="empty-sources">${icon('sources')}Se underlag & nästa steg</button></div>
      <div class="compass"><span id="north-label">N</span><div id="compass-arrow">${icon('north')}</div></div>
      <div class="viewport-bottom"><div class="viewport-hint"><span><b>Rotera</b> · dra</span><span><b>Panorera</b> · högerklick + dra</span><span><b>Zooma</b> · skrolla</span></div><div class="scale-bar"><span id="scale-text">5 m</span><div class="scale-line" id="scale-line"></div></div></div>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
    </section>
  </main>
  <footer class="bottom-bar"><span><i class="status-dot"></i><span id="footer-status">Underlagsmodell</span></span><span class="footer-center">AVSTYCKNINGSVÄGEN 5 · INTERAKTIV BYGGNADSSTUDIE</span><span id="model-unit">MODELLENHET · METER</span></footer>
</div>
<div class="drawer-backdrop" id="drawer-backdrop"></div><aside class="drawer" id="sources-drawer" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="sources-heading" inert><div class="drawer-header"><h2 id="sources-heading">Underlag & källor</h2><button class="icon-button" id="close-sources" aria-label="Stäng underlag och källor">${icon('close')}</button></div><div class="drawer-content" id="sources-content"></div></aside><input type="file" id="glb-input" accept=".glb" class="hidden" />`;

const viewport = $('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#eeeee7');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor('#eeeee7');
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label', '3D-vy. Dra för att rotera, använd skrollhjulet för att zooma.');
viewport.prepend(renderer.domElement);
const perspective = new THREE.PerspectiveCamera(38, 1, .05, 1500);
const orthographic = new THREE.OrthographicCamera(-20, 20, 20, -20, .05, 1500);
let camera = perspective;
let controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .085;
controls.minDistance = .05;
controls.maxDistance = 180;
controls.maxPolarAngle = Math.PI;
const ambient = new THREE.HemisphereLight('#fffefa', '#b3bba9', 1.3);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#fffaf0', 2.5);
sun.position.set(-15, 26, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: .5, far: 100 });
sun.shadow.bias = -.00025;
sun.shadow.normalBias = .04;
scene.add(sun);
const fill = new THREE.DirectionalLight('#c9ded7', .65);
fill.position.set(12, 10, -18);
scene.add(fill);

let house = buildHouse();
scene.add(house.group);
let metadata = house.metadata || {};
let bounds = new THREE.Box3(new THREE.Vector3(...(house.bounds?.min || [-6, 0, -5])), new THREE.Vector3(...(house.bounds?.max || [6, 8, 5])));
let center = bounds.getCenter(new THREE.Vector3());
let size = bounds.getSize(new THREE.Vector3());
const state = { view: '3d', preset: 'iso', projection: 'perspective', site: false, outsideStyle: 'grid', roof: true, floor: 'all', explode: 0, cut: false, axis: 'y', cutPosition: .46, flip: false, labels: true, grid: true, measuring: false, imported: false };
let site = null;
const presetDirections = {
  iso: new THREE.Vector3(-1, 1, 1).normalize(), street: new THREE.Vector3(0, 0, 1),
  garden: new THREE.Vector3(0, 0, -1), entrance: new THREE.Vector3(-1, 0, 0),
  opposite: new THREE.Vector3(1, 0, 0), top: new THREE.Vector3(0, 1, 0),
};
const presetNames = { iso: '3D / Isometrisk', street: 'Gatufasad', garden: 'Trädgårdsfasad', entrance: 'Entrégavel', opposite: 'Motsatt gavel', top: 'Ovanifrån', free: 'Fri vy' };
const initialPositions = new Map();
const clippingPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 3);
let sectionLines = null;
let sectionCaps = null;
let sectionDiagnostics = {};
const sectionMaterial = new THREE.LineBasicMaterial({ color: '#245b48', depthTest: false, transparent: true, opacity: .86 });
const sectionCapMaterial = new THREE.MeshBasicMaterial({ color: '#71816c', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
let labels = [];
const labelRaycaster = new THREE.Raycaster();
let lastLabelOcclusion = -Infinity;
const measurementGroup = new THREE.Group();
scene.add(measurementGroup);
let measurePoints = [];
let measureLabel = null;

const contextGroup = new THREE.Group();
contextGroup.name = 'Omgivning endast rutnät';
const grid = new THREE.GridHelper(130, 130, '#b8c2b1', '#d3d9ca');
grid.position.y = -.11;
grid.material.transparent = true;
grid.material.opacity = .56;
contextGroup.add(grid);
const broadGrid = new THREE.GridHelper(130, 26, '#b0bca8', '#b0bca8');
broadGrid.position.y = -.10;
broadGrid.material.transparent = true;
broadGrid.material.opacity = .45;
contextGroup.add(broadGrid);
scene.add(contextGroup);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: .09, depthWrite: false }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -.12;
ground.receiveShadow = true;
scene.add(ground);

function objectVisible(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

function prepareModel() {
  house.group.updateMatrixWorld(true);
  const actualBounds = new THREE.Box3().setFromObject(house.group);
  if (!actualBounds.isEmpty()) bounds.copy(actualBounds);
  center = bounds.getCenter(new THREE.Vector3());
  size = bounds.getSize(new THREE.Vector3());
  ground.position.y = bounds.min.y - .06;
  contextGroup.position.y = Math.min(bounds.min.y, 0);
  initialPositions.clear();
  for (const floor of house.floors || []) initialPositions.set(floor.group, floor.group.position.clone());
  if (house.roof) initialPositions.set(house.roof, house.roof.position.clone());
  house.group.traverse(object => {
    if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
    if (object.material) {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.clippingPlanes = [];
        material.clipShadows = true;
        material.needsUpdate = true;
      }
    }
  });
  $('floor-select').innerHTML = '<option value="all">Hela byggnaden</option>' + (house.floors || []).map(floor => `<option value="${esc(floor.id)}">${esc(floor.label)}</option>`).join('');
  $('floor-select').disabled = !(house.floors || []).length;
  $('roof-toggle').disabled = !house.roof;
  $('explode-range').disabled = !(house.floors || []).length;
  createLabels();
  updateMetadata();
}

function updateMetadata() {
  let meshCount = 0;
  house.group.traverse(object => { if (object.isMesh) meshCount++; });
  $('empty-state').classList.toggle('hidden', meshCount > 0);
  $('project-status').textContent = metadata.status === 'modeled' ? 'Modell under verifiering' : metadata.statusLabel || 'Underlag saknas';
  $('scene-badge').textContent = metadata.sourceStatus || (meshCount ? 'Mått och interiör ej verifierade' : 'Underlag saknas');
  $('footer-status').textContent = metadata.footerStatus || (meshCount ? 'Underlagsmodell · se källor' : 'Inväntar modellunderlag');
  $('evidence-note').textContent = metadata.note || 'Modellens mått och interiör behöver verifieras mot ritningar och fotografier.';
  updateNorthUI();
  if (metadata.description) $('project-description').textContent = metadata.description;
  renderSources();
}

function renderSources() {
  const sources = [...(metadata.sources || []), ...(site?.metadata?.sources || [])].map(source => ({ ...source, title: source.title || source.label || source.name, url: assetUrl(source.url), image: assetUrl(source.image || (/^\/sources\/.*\.(png|jpe?g|webp)$/i.test(source.url || '') ? source.url : undefined)) }));
  $('sources-content').innerHTML = `<p>${esc(metadata.sourceDescription || 'Modellen är en tolkning av tillgängligt underlag. Här kan du se vad som är belagt, vad som är antaget och vilket underlag som återstår.')}</p><h3>Källor till modellen</h3>${sources.length ? sources.map(source => `<article class="source-card"><span class="source-status">${esc(source.status || 'Ej verifierad')}</span><h4>${esc(source.title || source.name || 'Underlag')}</h4>${safeLink(source.image) ? `<a href="${esc(source.image)}" target="_blank" rel="noopener noreferrer"><img class="source-thumbnail" src="${esc(source.image)}" alt="${esc(source.title || 'Ritningsunderlag')}" loading="lazy"></a>` : ''}<p>${esc(source.detail || source.description || '')}</p>${safeLink(source.url) ? `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">Öppna källa ↗</a>` : ''}</article>`).join('') : '<article class="source-card"><h4>Inget verifierat byggnadsunderlag ännu</h4><p>Originalritningar, fotografier och kontrollmått behövs för att fastställa husets verkliga form och planlösning.</p></article>'}<h3>Antaganden & återstående underlag</h3><ul class="assumption-list">${(metadata.assumptions?.length ? metadata.assumptions : ['Byggnadens mått behöver kontrolleras mot tillförlitligt underlag.', 'Interiör och material behöver verifieras på plats.']).map(item => `<li>${esc(typeof item === 'string' ? item : item.description || item.text || JSON.stringify(item))}</li>`).join('')}</ul><div class="upload-box"><h3>Öppna en rekonstruerad modell</h3><p>Importera en GLB från till exempel Blender eller fotogrammetri. Filen stannar i din webbläsare. Modellens enhet förutsätts vara meter; kontrollera skalan innan mätning. En importerad modell ersätter visningen och dess våningsindelning.</p><button class="button" id="upload-button">${icon('upload')}Välj GLB-fil</button><p id="upload-status" role="status" style="margin:10px 0 0"></p></div>`;
  $('sources-content').querySelector('.upload-box').insertAdjacentHTML('beforebegin', `<div class="upload-box download-box"><h3>Ta med modellen</h3><p>Ritningsmodellen använder meter och bygger på projektets arkivunderlag. Dagens insida är inte verifierad.</p><a class="button" href="${esc(assetUrl('/models/avstyckningsvagen-5-ritningsmodell.glb'))}" download="avstyckningsvagen-5-ritningsmodell.glb">${icon('export')}Ladda ner ritningsmodell · GLB</a></div>`);
  if (site?.metadata) $('sources-content').querySelector('.download-box').insertAdjacentHTML('beforebegin', `<h3>Tomt & terräng</h3><p class="site-source-note">${esc(site.metadata.note || site.metadata.sourceStatus || '')}</p>${site.metadata.assumptions?.length ? `<ul class="assumption-list">${site.metadata.assumptions.map(item => `<li>${esc(typeof item === 'string' ? item : item.description || item.text || JSON.stringify(item))}</li>`).join('')}</ul>` : ''}`);
  if (Number.isFinite(site?.metadata?.northRotation) || Array.isArray(site?.metadata?.northDirection)) {
    for (const item of $('sources-content').querySelectorAll('.assumption-list:first-of-type li')) if (/Riktning mot sant norr inte kalibrerad/i.test(item.textContent)) item.textContent = 'Den fristående GLB-filen använder husets lokala axlar. Webbvyns norriktning följer terrängunderlagets georeferering.';
  }
  $('upload-button').addEventListener('click', () => $('glb-input').click());
}

function safeLink(url) {
  if (!url) return false;
  try { return ['http:', 'https:'].includes(new URL(url, window.location.href).protocol); } catch { return false; }
}

function createLabels() {
  lastLabelOcclusion = -Infinity;
  for (const label of labels) label.element.remove();
  labels = (metadata.labels || []).map(label => {
    const element = document.createElement('div');
    element.className = 'scene-label room-label';
    element.innerHTML = `${esc(label.text || label.label)}${label.detail ? `<small>${esc(label.detail)}</small>` : ''}`;
    $('labels-layer').append(element);
    return { ...label, element, position: new THREE.Vector3(...label.position) };
  });
}

function resize() {
  const { width, height } = viewport.getBoundingClientRect();
  renderer.setSize(width, height);
  perspective.aspect = width / height;
  perspective.updateProjectionMatrix();
  const frame = (orthographic.top - orthographic.bottom) / 2;
  orthographic.left = -frame * width / height;
  orthographic.right = frame * width / height;
  orthographic.top = frame;
  orthographic.bottom = -frame;
  orthographic.updateProjectionMatrix();
}

function visibleSceneBounds() {
  house.group.updateMatrixWorld(true);
  const visibleBounds = new THREE.Box3();
  house.group.traverse(object => {
    if (!object.isMesh || !objectVisible(object)) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    visibleBounds.union(object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld));
  });
  if (visibleBounds.isEmpty()) visibleBounds.copy(bounds);
  if (state.site && site?.bounds) {
    const siteBounds = site.bounds.isBox3 ? site.bounds : new THREE.Box3(new THREE.Vector3(...site.bounds.min), new THREE.Vector3(...site.bounds.max));
    if (!siteBounds.isEmpty()) visibleBounds.union(siteBounds);
  }
  return visibleBounds;
}

function fitView(reset = false) {
  const visibleBounds = visibleSceneBounds();
  const target = visibleBounds.getCenter(new THREE.Vector3());
  const oldDistance = camera.position.distanceTo(controls.target);
  const direction = reset ? presetDirections.iso.clone() : camera.position.clone().sub(controls.target).normalize();
  if (!Number.isFinite(direction.x) || direction.lengthSq() < .1) direction.copy(presetDirections.iso);
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  if (right.lengthSq() < .1) right.crossVectors(new THREE.Vector3(0, 0, -1), direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const corners = [];
  for (const x of [visibleBounds.min.x, visibleBounds.max.x]) for (const y of [visibleBounds.min.y, visibleBounds.max.y]) for (const z of [visibleBounds.min.z, visibleBounds.max.z]) corners.push(new THREE.Vector3(x, y, z).sub(target));
  controls.target.copy(target);
  const frameFraction = .80;
  let distance;
  if (camera.isPerspectiveCamera) {
    const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanHorizontal = tanVertical * camera.aspect;
    distance = 2;
    for (const point of corners) {
      const depth = point.dot(direction);
      distance = Math.max(distance, depth + Math.abs(point.dot(right)) / (tanHorizontal * frameFraction), depth + Math.abs(point.dot(up)) / (tanVertical * frameFraction));
    }
  } else {
    const aspect = viewport.clientWidth / viewport.clientHeight;
    let halfHeight = .25;
    for (const point of corners) halfHeight = Math.max(halfHeight, Math.abs(point.dot(up)) / frameFraction, Math.abs(point.dot(right)) / (aspect * frameFraction));
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.zoom = 1;
    distance = Math.max(oldDistance, visibleBounds.getSize(new THREE.Vector3()).length() * 1.1, 2);
  }
  camera.position.copy(target).addScaledVector(direction, distance);
  camera.far = Math.max(1500, distance * 6);
  camera.updateProjectionMatrix();
  controls.maxDistance = Math.max(300, distance * 4);
  camera.lookAt(target);
  controls.update();
}

function updateCameraUI() {
  $('projection-perspective').setAttribute('aria-pressed', String(state.projection === 'perspective'));
  $('projection-orthographic').setAttribute('aria-pressed', String(state.projection === 'orthographic'));
  document.querySelectorAll('[data-preset]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.preset === state.preset)));
  $('view-caption').textContent = `${state.projection === 'orthographic' ? 'Ortografisk' : 'Perspektiv'} / ${presetNames[state.preset] || 'Fri vy'}`;
  $('view-help').textContent = state.view === 'plan' ? 'Ovanifrån. Högerklicka och dra för att panorera. Taket kan öppnas under Byggnadens lager.' : state.projection === 'orthographic' ? 'Parallella linjer. Dra för att rotera fritt eller välj en sida.' : 'Dra för att rotera. Skrolla för att komma närmare.';
}

function connectControls(target = controls.target.clone()) {
  controls.dispose();
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.dampingFactor = .085;
  controls.minDistance = .05;
  controls.maxDistance = Math.max(300, camera.position.distanceTo(target) * 4);
  controls.maxPolarAngle = Math.PI;
  controls.enableRotate = state.view !== 'plan';
  controls.update();
  controls.addEventListener('change', () => {
    const expected = presetDirections[state.preset];
    if (expected && state.view !== 'plan' && camera.position.clone().sub(controls.target).normalize().dot(expected) < 1 - 1e-7) {
      state.preset = 'free'; updateCameraUI();
    }
  });
}

function setProjection(projection) {
  if (!['perspective', 'orthographic'].includes(projection)) return;
  if (state.projection === projection) { updateCameraUI(); return; }
  const target = controls.target.clone();
  const direction = camera.position.clone().sub(target).normalize();
  const distance = camera.position.distanceTo(target);
  const halfHeight = camera.isOrthographicCamera ? (camera.top - camera.bottom) / (2 * camera.zoom) : Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
  const up = camera.up.clone();
  state.projection = projection;
  camera = projection === 'orthographic' ? orthographic : perspective;
  camera.up.copy(up); camera.zoom = 1;
  if (camera.isOrthographicCamera) {
    const aspect = viewport.clientWidth / viewport.clientHeight;
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.position.copy(target).addScaledVector(direction, distance);
  } else {
    camera.aspect = viewport.clientWidth / viewport.clientHeight;
    camera.position.copy(target).addScaledVector(direction, halfHeight / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }
  const sceneBounds = visibleSceneBounds();
  camera.far = Math.max(1500, camera.position.distanceTo(sceneBounds.getCenter(new THREE.Vector3())) + sceneBounds.getSize(new THREE.Vector3()).length() * 3);
  camera.updateProjectionMatrix(); camera.lookAt(target);
  connectControls(target);
  lastLabelOcclusion = -Infinity;
  updateCameraUI();
}

function setPreset(preset) {
  if (!presetDirections[preset]) return;
  state.preset = preset;
  state.view = preset === 'top' ? 'plan' : '3d';
  const target = controls.target.clone(), distance = Math.max(camera.position.distanceTo(target), 2);
  camera.up.set(...(preset === 'top' ? [0, 0, -1] : [0, 1, 0]));
  camera.position.copy(target).addScaledVector(presetDirections[preset], distance);
  camera.lookAt(target);
  connectControls(target);
  updateLayers();
  fitView();
  lastLabelOcclusion = -Infinity;
  updateCameraUI();
}

function setView(view) {
  if (view === 'plan') {
    state.roof = false; $('roof-toggle').setAttribute('aria-pressed', 'false');
    setProjection('orthographic'); setPreset('top');
  } else setPreset('iso');
}

function updateLayers() {
  const floors = house.floors || [];
  for (let index = 0; index < floors.length; index++) {
    const floor = floors[index];
    floor.group.visible = state.floor === 'all' || String(floor.id) === state.floor;
    floor.group.position.copy(initialPositions.get(floor.group));
    floor.group.position.y += index * state.explode;
  }
  if (house.roof) {
    house.roof.visible = state.roof && (state.floor === 'all' || String(floors.at(-1)?.id) === state.floor);
    house.roof.position.copy(initialPositions.get(house.roof));
    house.roof.position.y += floors.length * state.explode;
  }
  updateSiteVisibility();
  $('explode-value').textContent = `${state.explode.toLocaleString('sv-SE', {minimumFractionDigits: 1})} m`;
  house.group.updateMatrixWorld(true);
  updateCut();
}

function currentCutPosition() {
  const max = bounds.max[state.axis] + (state.axis === 'y' ? state.explode * (house.floors || []).length : 0);
  return THREE.MathUtils.lerp(bounds.min[state.axis], max, state.cutPosition);
}

function updateCut() {
  const position = currentCutPosition();
  const sign = state.flip ? 1 : -1;
  clippingPlane.normal.set(0, 0, 0)[state.axis] = sign;
  clippingPlane.constant = -position * sign;
  for (const root of [house.group, ...(site ? [site.group] : [])]) root.traverse(object => {
    if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const wasClipped = material.clippingPlanes?.length > 0;
      material.clippingPlanes = state.cut ? [clippingPlane] : [];
      if (wasClipped !== state.cut) material.needsUpdate = true;
    }
  });
  const text = `${position.toLocaleString('sv-SE', {minimumFractionDigits: 2, maximumFractionDigits: 2})} m`;
  $('cut-value').textContent = text;
  $('cut-controls').style.opacity = state.cut ? '1' : '.48';
  $('cut-indicator').classList.toggle('hidden', !state.cut);
  $('cut-indicator').textContent = `${({x:'X', z:'Y', y:'Z'})[state.axis]}-SNITT / ${text}`;
  rebuildSection();
}

function updateSiteVisibility() {
  if (site) {
    site.group.visible = state.site;
    site.setOutsideStyle(state.grid ? state.outsideStyle : 'none');
  }
  contextGroup.visible = state.grid && !state.site;
  ground.visible = !state.site;
  $('site-toggle').setAttribute('aria-pressed', String(state.site));
  document.querySelectorAll('[data-outside-style]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.outsideStyle === state.outsideStyle));
    button.disabled = !site;
  });
  $('scene-badge').textContent = state.site && site?.metadata?.sourceStatus ? site.metadata.sourceStatus : metadata.sourceStatus || 'Underlagsmodell';
}

function setSiteVisible(visible) {
  if (!site && visible) return;
  state.site = visible;
  clearMeasurement();
  updateSiteVisibility();
  updateCut();
  fitView();
  lastLabelOcclusion = -Infinity;
}

let siteRequest = null;
async function loadSite() {
  siteRequest?.abort();
  const controller = new AbortController(); siteRequest = controller;
  const timeout = setTimeout(() => controller.abort(), 12000);
  $('site-status').textContent = 'Läser terrängunderlag…';
  $('site-retry').classList.add('hidden');
  try {
    const response = await fetch(assetUrl('/data/site.json'), { signal: controller.signal });
    if (!response.ok) throw new Error(`Terrängunderlaget kunde inte läsas (${response.status}).`);
    if (!response.headers.get('content-type')?.includes('json')) throw new Error('Terrängunderlaget är ännu inte tillgängligt. Försök igen om en stund.');
    const data = await response.json().catch(() => { throw new Error('Terrängunderlaget har ett ogiltigt format.'); });
    if (!Array.isArray(data.parcel) || data.parcel.length < 3) throw new Error('Terrängunderlaget saknar en giltig tomtpolygon.');
    const loadedSite = buildSite(data);
    if (siteRequest !== controller) return;
    if (site) {
      scene.remove(site.group);
      const materials = new Set();
      site.group.traverse(object => { object.geometry?.dispose(); for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) materials.add(material); });
      materials.forEach(material => material.dispose());
    }
    site = loadedSite; scene.add(site.group);
    site.group.traverse(object => { if (object.isMesh) object.receiveShadow = true; });
    $('site-toggle').disabled = false; $('site-fit-button').disabled = false;
    $('site-status').textContent = site.metadata.note || site.metadata.sourceStatus || 'Tomt och terräng är tillgängliga. Grannmarken visas med linjer.';
    updateNorthUI();
    updateSiteVisibility(); updateCut(); renderSources();
    if (state.site) fitView();
  } catch (error) {
    if (siteRequest !== controller) return;
    $('site-status').textContent = error.name === 'AbortError' ? 'Terrängunderlaget tog för lång tid att läsa.' : error instanceof TypeError ? 'Terrängunderlaget kunde inte hämtas. Kontrollera anslutningen och försök igen.' : error.message || 'Terrängunderlaget kunde inte läsas.';
    $('site-retry').classList.remove('hidden');
  } finally { clearTimeout(timeout); }
}

function rebuildSection() {
  if (sectionLines) { scene.remove(sectionLines); sectionLines.geometry.dispose(); sectionLines = null; }
  if (sectionCaps) { scene.remove(sectionCaps); sectionCaps.geometry.dispose(); sectionCaps = null; }
  sectionDiagnostics = { meshes: 0, loops: 0, triangles: 0, openChains: 0, triangulationFailures: 0, unresolvedMeshes: [] };
  if (!state.cut) return;
  const vertices = [];
  const capVertices = [];
  house.group.traverse(object => {
    if (!object.isMesh || !objectVisible(object) || object.userData.noSection || !object.geometry.attributes.position) return;
    const section = sectionMesh(object, clippingPlane);
    for (const value of section.segments) vertices.push(value);
    for (const value of section.positions) capVertices.push(value);
    if (section.segments.length) sectionDiagnostics.meshes++;
    for (const key of ['loops', 'triangles', 'openChains', 'triangulationFailures']) sectionDiagnostics[key] += section.diagnostics[key];
    if (section.diagnostics.openChains || section.diagnostics.triangulationFailures) sectionDiagnostics.unresolvedMeshes.push({ name: object.name, ...section.diagnostics });
  });
  if (vertices.length) {
    sectionLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)), sectionMaterial);
    sectionLines.renderOrder = 10;
    scene.add(sectionLines);
  }
  if (capVertices.length) {
    const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(capVertices, 3));
    geometry.computeVertexNormals();
    sectionCaps = new THREE.Mesh(geometry, sectionCapMaterial);
    sectionCaps.name = 'Snittytor i massiva byggnadsdelar';
    sectionCaps.userData.sectionDiagnostics = sectionDiagnostics;
    scene.add(sectionCaps);
  }
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $('toast').classList.remove('show'), 4200);
}

let previousFocus;
function openSources() {
  previousFocus = document.activeElement;
  $('sources-drawer').inert = false;
  $('sources-drawer').setAttribute('aria-hidden', 'false');
  $('sources-drawer').classList.add('open');
  $('drawer-backdrop').classList.add('open');
  document.querySelector('.app-shell').inert = true;
  $('close-sources').focus();
}
function closeSources() {
  $('sources-drawer').classList.remove('open');
  $('drawer-backdrop').classList.remove('open');
  $('sources-drawer').inert = true;
  $('sources-drawer').setAttribute('aria-hidden', 'true');
  document.querySelector('.app-shell').inert = false;
  previousFocus?.focus();
}

function clearMeasurement() {
  for (const child of [...measurementGroup.children]) {
    child.geometry?.dispose(); child.material?.dispose(); measurementGroup.remove(child);
  }
  measureLabel?.remove();
  measureLabel = null;
  measurePoints = [];
  $('measure-value').classList.add('hidden');
}

function setMeasuring(active) {
  state.measuring = active;
  $('measure-button').setAttribute('aria-pressed', String(active));
  renderer.domElement.style.cursor = active ? 'crosshair' : '';
  $('measure-help').textContent = active ? 'Välj första punkten på en synlig yta. Esc avslutar.' : 'Klicka på två synliga ytor i modellen.';
  if (active) clearMeasurement();
}

const raycaster = new THREE.Raycaster();
let pointerStart;
renderer.domElement.addEventListener('pointerdown', event => { pointerStart = {x:event.clientX, y:event.clientY}; });
renderer.domElement.addEventListener('pointerup', event => {
  if (!state.measuring || event.button !== 0 || !pointerStart || Math.hypot(event.clientX-pointerStart.x, event.clientY-pointerStart.y) > 5) return;
  const rect = renderer.domElement.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1), camera);
  const pickables = [house.group, ...(sectionCaps ? [sectionCaps] : []), ...(state.site && site ? [site.terrain, site.earthworks.group] : [])];
  const hit = raycaster.intersectObjects(pickables, true).find(result => result.object.isMesh && !result.object.userData.noMeasure && objectVisible(result.object) && (!state.cut || clippingPlane.distanceToPoint(result.point) >= -.0001));
  if (!hit) { toast('Välj en synlig yta på huset eller tomten.'); return; }
  if (measurePoints.length === 2) clearMeasurement();
  measurePoints.push(hit.point.clone());
  const marker = new THREE.Mesh(new THREE.SphereGeometry(.065, 12, 8), new THREE.MeshBasicMaterial({color:'#235f4f',depthTest:false}));
  marker.position.copy(hit.point); marker.renderOrder = 20; measurementGroup.add(marker);
  $('measure-help').textContent = measurePoints.length === 1 ? 'Välj den andra punkten.' : 'Klicka för att starta en ny mätning. Esc avslutar.';
  if (measurePoints.length === 2) {
    const distance = measurePoints[0].distanceTo(measurePoints[1]);
    const value = `${distance.toLocaleString('sv-SE', {minimumFractionDigits:2, maximumFractionDigits:2})} m`;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(measurePoints), new THREE.LineDashedMaterial({color:'#235f4f',dashSize:.15,gapSize:.08,depthTest:false}));
    line.computeLineDistances(); line.renderOrder = 19; measurementGroup.add(line);
    measureLabel = document.createElement('div'); measureLabel.className = 'scene-label'; measureLabel.textContent = value; $('labels-layer').append(measureLabel);
    $('measure-value').innerHTML = `${esc(value)} <small>i modellen</small>`;
    $('measure-value').classList.remove('hidden');
    toast(state.explode > 0 ? 'Mätning i isärtagen vy. Återställ separation för byggnadens avstånd.' : 'Avstånd i modellens skala. Se källor för måttens tillförlitlighet.');
  }
});

function positionLabel(element, position) {
  const vector = position.clone().project(camera);
  if (vector.z < -1 || vector.z > 1) { element.style.display = 'none'; return; }
  element.style.display = '';
  element.style.left = `${(vector.x*.5+.5)*viewport.clientWidth}px`;
  element.style.top = `${(-vector.y*.5+.5)*viewport.clientHeight}px`;
}

function labelIsOccluded(position) {
  const projected = position.clone().project(camera);
  labelRaycaster.setFromCamera(projected, camera);
  labelRaycaster.near = 0;
  labelRaycaster.far = Math.max(0, labelRaycaster.ray.origin.distanceTo(position) - .04);
  const objects = [house.group, ...(sectionCaps ? [sectionCaps] : []), ...(state.site && site ? [site.terrain, site.earthworks.group] : [])];
  return labelRaycaster.intersectObjects(objects, true).some(hit => {
    if (!hit.object.isMesh || !objectVisible(hit.object)) return false;
    for (let node = hit.object; node; node = node.parent) if (node.userData.noLabelOccluder) return false;
    if (state.cut && clippingPlane.distanceToPoint(hit.point) < -.0001) return false;
    const material = Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex || 0] : hit.object.material;
    if (!material || material.visible === false || (material.transparent && material.opacity < .5)) return false;
    return true;
  });
}

function updateLabels() {
  const now = performance.now();
  const refreshOcclusion = now - lastLabelOcclusion >= 150;
  if (refreshOcclusion) lastLabelOcclusion = now;
  for (const label of labels) {
    const floorIndex = (house.floors || []).findIndex(floor => String(floor.id) === String(label.floorId));
    const visible = state.labels && (state.floor === 'all' || !label.floorId || state.floor === String(label.floorId));
    const position = label.position.clone();
    if (floorIndex >= 0) position.y += floorIndex * state.explode;
    if (!visible || (state.cut && clippingPlane.distanceToPoint(position) < 0) || (state.view === '3d' && state.roof && state.floor === 'all' && !state.cut && !state.explode)) { label.element.style.display = 'none'; continue; }
    const selectedPlan = state.view === 'plan' && camera.isOrthographicCamera && state.floor !== 'all';
    if (refreshOcclusion && !selectedPlan) label.occluded = labelIsOccluded(position);
    if (!selectedPlan && label.occluded !== false) { label.element.style.display = 'none'; continue; }
    positionLabel(label.element, position);
  }
  if (measureLabel && measurePoints.length === 2) positionLabel(measureLabel, measurePoints[0].clone().lerp(measurePoints[1], .5));
}

function updateScale() {
  const distance = camera.position.distanceTo(controls.target);
  const visibleHeight = camera.isOrthographicCamera ? (camera.top-camera.bottom)/camera.zoom : 2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*distance;
  const pixelsPerMeter = viewport.clientHeight/visibleHeight;
  const desired = 80/pixelsPerMeter;
  const magnitude = 10**Math.floor(Math.log10(desired));
  const chosen = [1,2,5,10].map(n=>n*magnitude).find(n=>n>=desired) || magnitude*10;
  $('scale-text').textContent = `${chosen.toLocaleString('sv-SE')} m${camera.isPerspectiveCamera ? ' ≈' : ''}`;
  $('scale-line').style.width = `${chosen*pixelsPerMeter}px`;
  const north = northVector();
  const start = controls.target.clone().project(camera), end = controls.target.clone().add(north.direction).project(camera);
  const dx = end.x - start.x, dy = end.y - start.y;
  const angle = Math.atan2(dx * viewport.clientWidth, dy * viewport.clientHeight);
  $('compass-arrow').style.transform = `rotate(${angle}rad)`;
  $('compass-arrow').style.opacity = Math.hypot(dx, dy) < 1e-7 ? '.25' : '1';
}

function northVector() {
  const source = !state.imported && site?.metadata ? site.metadata : metadata;
  if (Array.isArray(source.northDirection) && source.northDirection.length === 2 && source.northDirection.every(Number.isFinite)) return { direction: new THREE.Vector3(source.northDirection[0], 0, source.northDirection[1]).normalize(), verified: true };
  if (Number.isFinite(source.northRotation)) return { direction: new THREE.Vector3(Math.sin(source.northRotation), 0, -Math.cos(source.northRotation)), verified: true };
  return { direction: new THREE.Vector3(0, 0, -1), verified: false };
}

function updateNorthUI() {
  const north = northVector();
  $('north-label').textContent = north.verified ? 'N' : '−Z';
  $('compass-arrow').title = north.verified ? 'Norr enligt terrängunderlagets georeferering' : 'Modellaxel −Z. Norriktning ej verifierad.';
}

function zoom(factor) {
  if (camera.isOrthographicCamera) { camera.zoom = THREE.MathUtils.clamp(camera.zoom/factor,.2,15); camera.updateProjectionMatrix(); }
  else camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
  controls.update();
}

document.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => setPreset(button.dataset.preset)));
$('projection-perspective').addEventListener('click', () => setProjection('perspective'));
$('projection-orthographic').addEventListener('click', () => setProjection('orthographic'));
$('site-toggle').addEventListener('click', () => setSiteVisible(!state.site));
$('site-fit-button').addEventListener('click', () => setSiteVisible(true));
$('site-retry').addEventListener('click', loadSite);
document.querySelectorAll('[data-outside-style]').forEach(button => button.addEventListener('click', () => {
  state.outsideStyle = button.dataset.outsideStyle;
  if (site && !state.site) setSiteVisible(true);
  else updateSiteVisibility();
}));
for (const [id, key] of [['roof-toggle','roof'],['cut-toggle','cut'],['cut-flip','flip'],['labels-toggle','labels'],['grid-toggle','grid']]) {
  $(id).addEventListener('click', () => { state[key] = !state[key]; $(id).setAttribute('aria-pressed',String(state[key])); updateLayers(); });
}
$('floor-select').addEventListener('change', event => { state.floor = event.target.value; clearMeasurement(); updateLayers(); fitView(); });
$('explode-range').addEventListener('input', event => { state.explode = Number(event.target.value); clearMeasurement(); updateLayers(); fitView(); });
$('cut-range').addEventListener('input', event => { state.cutPosition = Number(event.target.value)/100; updateCut(); });
document.querySelectorAll('[data-axis]').forEach(button => button.addEventListener('click', () => {
  state.axis = button.dataset.axis;
  document.querySelectorAll('[data-axis]').forEach(item => item.setAttribute('aria-pressed',String(item === button)));
  updateCut();
}));
$('measure-button').addEventListener('click', () => setMeasuring(!state.measuring));
$('zoom-in').addEventListener('click', () => zoom(.8));
$('zoom-out').addEventListener('click', () => zoom(1.25));
$('fit-button').addEventListener('click', () => fitView());
$('reset-button').addEventListener('click', () => {
  Object.assign(state, {roof:true, floor:'all',explode:0,cut:false,flip:false});
  for (const [id,key] of [['roof-toggle','roof'],['cut-toggle','cut'],['cut-flip','flip']]) $(id).setAttribute('aria-pressed',String(state[key]));
  $('floor-select').value = 'all'; $('explode-range').value = '0';
  clearMeasurement(); setMeasuring(false); setProjection('perspective'); setView('3d'); toast('Vyn är återställd.');
});
$('sources-button').addEventListener('click',openSources);
$('empty-sources').addEventListener('click',openSources);
$('close-sources').addEventListener('click',closeSources);
$('drawer-backdrop').addEventListener('click',closeSources);
$('menu-button').addEventListener('click',() => { const open = !$('inspector').classList.contains('open'); $('inspector').classList.toggle('open',open); $('menu-button').setAttribute('aria-expanded',String(open)); });
$('menu-close').addEventListener('click',() => { $('inspector').classList.remove('open'); $('menu-button').setAttribute('aria-expanded','false'); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if ($('sources-drawer').classList.contains('open')) closeSources();
    setMeasuring(false); $('inspector').classList.remove('open'); $('menu-button').setAttribute('aria-expanded','false');
  }
  if (event.key === 'Tab' && $('sources-drawer').classList.contains('open')) {
    const focusable = [...$('sources-drawer').querySelectorAll('button,a,input,select')].filter(item => !item.disabled);
    if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
  }
});

$('export-button').addEventListener('click', () => {
  renderer.render(scene,camera);
  const output = document.createElement('canvas');
  const source = renderer.domElement;
  output.width = source.width; output.height = source.height + 100;
  const ctx = output.getContext('2d');
  ctx.fillStyle = '#f5f3ed'; ctx.fillRect(0,0,output.width,output.height); ctx.drawImage(source,0,0);
  const pixelRatio = source.width / viewport.clientWidth;
  for (const label of $('labels-layer').children) {
    if (label.style.display === 'none' || !label.style.left) continue;
    const x = parseFloat(label.style.left)*pixelRatio, y = parseFloat(label.style.top)*pixelRatio;
    const lines = label.innerText.split('\n');
    ctx.font = `${11*pixelRatio}px sans-serif`;
    const textWidth = Math.max(...lines.map(line=>ctx.measureText(line).width));
    ctx.fillStyle = '#f7f6eeee'; ctx.fillRect(x-textWidth/2-7*pixelRatio,y-10*pixelRatio,textWidth+14*pixelRatio,lines.length*15*pixelRatio+5*pixelRatio);
    ctx.fillStyle = '#526651'; ctx.textAlign = 'center';
    lines.forEach((line,index)=>ctx.fillText(line,x,y+(index*15+1)*pixelRatio));
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#293934'; ctx.font = '24px sans-serif'; ctx.fillText(metadata.title || 'Avstyckningsvägen 5',30,source.height+40);
  ctx.fillStyle = '#7b8375'; ctx.font = '14px sans-serif'; ctx.fillText(`${metadata.sourceStatus || 'Underlagsmodell · ej verifierad'} | ${state.projection === 'orthographic' ? 'Ortografisk' : 'Perspektiv'} · ${presetNames[state.preset] || 'Fri vy'}${state.cut ? ' · Snitt' : ''}`,30,source.height+70);
  if (measurePoints.length === 2) { ctx.textAlign = 'right'; ctx.fillText(`Mätning: ${measurePoints[0].distanceTo(measurePoints[1]).toFixed(2)} m i modellen`,output.width-30,source.height+70); }
  const anchor = document.createElement('a'); anchor.download = `avstyckningsvagen-5-${state.view}-${new Date().toISOString().slice(0,10)}.png`; anchor.href = output.toDataURL('image/png'); anchor.click();
  toast('Aktuell vy har sparats med modellens underlagsstatus.');
});

$('glb-input').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  $('upload-status').textContent = 'Läser modellen…';
  try {
    const buffer = await file.arrayBuffer();
    const gltf = await new GLTFLoader().parseAsync(buffer, '');
    const importedBounds = new THREE.Box3().setFromObject(gltf.scene);
    if (importedBounds.isEmpty()) throw new Error('Filen innehåller ingen synlig geometri.');
    const importedSize = importedBounds.getSize(new THREE.Vector3());
    if (![importedSize.x, importedSize.y, importedSize.z].every(Number.isFinite)) throw new Error('Modellens mått är ogiltiga.');
    scene.remove(house.group);
    if (sectionLines) { scene.remove(sectionLines); sectionLines.geometry.dispose(); sectionLines = null; }
    const importedCenter = importedBounds.getCenter(new THREE.Vector3());
    gltf.scene.position.x -= importedCenter.x; gltf.scene.position.z -= importedCenter.z; gltf.scene.position.y -= importedBounds.min.y;
    gltf.scene.updateMatrixWorld(true);
    house = {group:gltf.scene, floors:[], roof:null, pickables:[gltf.scene], metadata:{title:'Avstyckningsvägen 5',status:'modeled',sourceStatus:'Importerad GLB · skala ej verifierad',description:'Importerad rekonstruktion. Använd snittverktyget för att utforska modellen.',note:'Enheten antas vara meter. Importerad geometri och skala har inte verifierats.',sources:[{title:file.name,status:'Lokalt importerad',detail:`${(file.size/1024/1024).toFixed(1)} MB. Filen har lästs i webbläsaren.`}],assumptions:['Enheten antas vara meter enligt glTF-konventionen; kontrollera ett känt mått.','Modellen saknar separata våningslager i denna import. Använd snitt för att se insidan.','Importen innehåller endast de ytor som finns i filen. Saknade innerväggar eller rum återskapas inte automatiskt.']}};
    metadata = house.metadata; scene.add(house.group); bounds = new THREE.Box3().setFromObject(house.group); center = bounds.getCenter(new THREE.Vector3()); size = bounds.getSize(new THREE.Vector3());
    Object.assign(state,{imported:true,roof:true,floor:'all',explode:0,cut:false,site:false});
    $('explode-range').value = 0; $('cut-toggle').setAttribute('aria-pressed','false');
    clearMeasurement(); setMeasuring(false); prepareModel(); resize(); setView('3d'); closeSources(); toast('GLB-modellen är öppnad. Kontrollera skalan med ett känt mått.');
  } catch (error) { $('upload-status').textContent = `Kunde inte öppna filen: ${error.message}`; }
  event.target.value = '';
});

prepareModel();
resize();
perspective.position.set(-25,21,28);
connectControls();
fitView(true);
updateCameraUI();
updateLayers();
loadSite();
new ResizeObserver(() => { resize(); fitView(); }).observe(viewport);
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene,camera);
  updateLabels();
  updateScale();
});
window.__houseViewer = { scene, get house(){return house;}, get camera(){return camera;}, renderer, state, get controls(){return controls;}, get bounds(){return bounds;}, get site(){return site;}, get sectionDiagnostics(){return sectionDiagnostics;}, setView, setPreset, setProjection, setSiteVisible, loadSite, visibleSceneBounds, updateLayers, updateCut, fitView };
