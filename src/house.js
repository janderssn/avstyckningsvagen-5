import * as THREE from 'three';

/**
 * Evidence-based house reconstruction. All geometry is in metres, with Y up.
 * Source drawing interpretation and unresolved measurements are documented in
 * research/geometry-evidence.md. This file does not claim a present-day survey.
 */
export const HOUSE_DIMENSIONS = { width: 8.15, depth: 10.65 };

function standard(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0,
    side: THREE.DoubleSide, ...options });
}

function meshIn(parent, geometry, material, name, data = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { label: name, evidence: 'Tolkning av arkivritning', ...data };
  parent.add(mesh);
  return mesh;
}

function box(parent, size, position, material, name, data) {
  const m = meshIn(parent, new THREE.BoxGeometry(...size), material, name, data);
  m.position.set(...position);
  return m;
}

/** A wall in its local XY plane, including genuine empty door/window openings. */
function wall(parent, a, b, base, height, thickness, material, name, openings = []) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const group = new THREE.Group();
  group.name = name;
  group.position.set(a[0], base, a[1]);
  group.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  parent.add(group);
  const breaks = [...new Set([0, length, ...openings.flatMap(o => [
    Math.max(0, o.at - o.width / 2), Math.min(length, o.at + o.width / 2),
  ])])].sort((x, y) => x - y);
  for (let i = 0; i < breaks.length - 1; i++) {
    const start = breaks[i], end = breaks[i + 1], mid = (start + end) / 2;
    const opening = openings.find(o => mid >= o.at - o.width / 2 && mid <= o.at + o.width / 2);
    const strips = opening ? [[0, opening.sill || 0], [(opening.sill || 0) + opening.height, height]] : [[0, height]];
    for (const [bottom, top] of strips) {
      if (top - bottom > 0.001 && end - start > 0.001) {
        box(group, [end - start, top - bottom, thickness], [mid, (bottom + top) / 2, 0], material, name);
      }
    }
  }
  return group;
}

function openingDetail(parent, a, b, base, o, materials, name) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(a[0], base, a[1]);
  g.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  parent.add(g);
  const sill = o.sill || 0, frame = 0.055;
  const style = { evidence: 'Öppningsläge avläst; karmdimensioner illustrativa' };
  box(g, [frame, o.height, 0.16], [o.at - o.width / 2 + frame / 2, sill + o.height / 2, 0], materials.frame, `${name} · karm`, style);
  box(g, [frame, o.height, 0.16], [o.at + o.width / 2 - frame / 2, sill + o.height / 2, 0], materials.frame, `${name} · karm`, style);
  box(g, [o.width, frame, 0.16], [o.at, sill + o.height - frame / 2, 0], materials.frame, `${name} · överstycke`, style);
  if (o.kind === 'door' || o.kind === 'garage') {
    if (o.kind === 'garage') {
      const panel = box(g, [o.width - frame * 2, o.height - frame, 0.065], [o.at, sill + o.height / 2, 0], materials.door, name, style);
      for (let y = 0.2; y < o.height; y += 0.28) box(g, [o.width - frame * 2, 0.012, 0.075], [o.at, y, 0], materials.metal, `${name} · skarv`, style);
      return panel;
    }
    // An open door leaf makes the actual opening usable in section/room views.
    const hinge = new THREE.Group();
    const direction = o.hingeEnd ? -1 : 1;
    hinge.position.set(o.at + direction * (-o.width / 2 + frame), sill, 0);
    hinge.rotation.y = -direction * Math.PI * 0.34;
    g.add(hinge);
    box(hinge, [o.width - 2 * frame, o.height - frame, 0.045], [direction * (o.width - 2 * frame) / 2, (o.height - frame) / 2, 0], materials.door, `${name} · dörrblad`, style);
    box(hinge, [0.11, 0.025, 0.08], [direction * (o.width - 0.18), 0.98, 0.04], materials.metal, `${name} · trycke`, style);
  } else {
    box(g, [o.width, frame, 0.20], [o.at, sill + frame / 2, 0.015], materials.frame, `${name} · fönsterbänk`, style);
    box(g, [o.width - 2 * frame, o.height - 2 * frame, 0.025], [o.at, sill + o.height / 2, 0], materials.glass, name, style);
    if (o.width > 1.1) box(g, [0.042, o.height - 2 * frame, 0.15], [o.at, sill + o.height / 2, 0], materials.frame, `${name} · mittpost`, style);
  }
  return g;
}

function slab(parent, width, depth, elevation, thickness, material, holes = []) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -depth / 2);
  shape.lineTo(width / 2, -depth / 2);
  shape.lineTo(width / 2, depth / 2);
  shape.lineTo(-width / 2, depth / 2);
  shape.closePath();
  for (const hole of holes) {
    const path = new THREE.Path();
    if (Array.isArray(hole[0])) {
      // Reverse the counter-clockwise floor footprint to create a clockwise hole.
      const points = [...hole].reverse();
      path.moveTo(...points[0]); for (const p of points.slice(1)) path.lineTo(...p); path.closePath();
    } else {
      path.moveTo(hole[0], hole[1]); path.lineTo(hole[0], hole[3]);
      path.lineTo(hole[2], hole[3]); path.lineTo(hole[2], hole[1]); path.closePath();
    }
    shape.holes.push(path);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  return meshIn(parent, geometry, material, 'Bjälklag med trappöppning').translateY(elevation);
}

function straightStair(parent, from, to, width, bottom, top, material, name) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.ceil((top - bottom) / 0.19);
  const g = new THREE.Group();
  g.name = name;
  g.position.set(from[0], bottom, from[1]);
  g.rotation.y = -Math.atan2(to[1] - from[1], to[0] - from[0]);
  parent.add(g);
  for (let i = 0; i < steps; i++) {
    const h = (i + 1) * (top - bottom) / steps;
    box(g, [length / steps, 0.055, width], [(i + 0.5) * length / steps, h - 0.0275, 0], material, `${name} · steg ${i + 1}`, { evidence: 'Trappans läge enligt ritning; stegantal tolkat' });
    box(g, [0.035, (top - bottom) / steps, width], [i * length / steps, h - (top - bottom) / steps / 2, 0], material, `${name} · sättsteg`);
  }
  return g;
}

export function buildHouse() {
  const group = new THREE.Group();
  group.name = 'Avstyckningsvägen 5 · ritningsrekonstruktion';
  const roof = new THREE.Group(); roof.name = 'Tak'; group.add(roof);
  const materials = {
    exterior: standard('#93968a'), interior: standard('#eeeae1'),
    foundation: standard('#e5e2d9'), floor: standard('#c9b491'),
    tile: standard('#d2d1c9'), concrete: standard('#aaa69f'),
    roof: standard('#252b30', { roughness: 0.4 }), frame: standard('#f1ede4'),
    door: standard('#c1ab8b'), metal: standard('#747b7c', { metalness: 0.6, roughness: 0.3 }),
    glass: standard('#a1c4ca', { transparent: true, opacity: 0.27, roughness: 0.18, depthWrite: false }),
    porcelain: standard('#f4f1e9', { roughness: 0.25 }),
  };
  const floors = [];
  const pickables = [];
  const W = 8.15, D = 10.65, ext = 0.30, inner = 0.12;
  const x0 = -W / 2 + ext / 2, x1 = W / 2 - ext / 2;
  const z0 = -D / 2 + ext / 2, z1 = D / 2 - ext / 2;
  const source = 'Järfälla kommun · LOV50-017475 · 2007-10-12';
  const floorDef = (id, label, elevation, height) => {
    const g = new THREE.Group(); g.name = label; g.position.y = elevation; group.add(g);
    const result = { id, label, group: g, elevation, height }; floors.push(result); return result;
  };
  const basement = floorDef('basement', 'Källarplan', -2.45, 2.20);
  const ground = floorDef('ground', 'Bottenplan', 0, 2.40);
  const upper = floorDef('upper', 'Överplan', 2.65, 2.40);
  const holes = [[[-3.80, 0.25], [-2.84, 0.25], [-2.84, 1.10], [-1.05, 1.10], [-1.05, 2.12], [-3.80, 2.12]]];
  slab(basement.group, W, D, 0, 0.20, materials.concrete);
  slab(ground.group, W, D, 0, 0.25, materials.floor, holes);
  slab(upper.group, W, D, 0, 0.25, materials.floor, holes);

  function room(floor, id, label, rect, area, material = materials.floor) {
    const m = box(floor.group, [rect[2] - rect[0], 0.024, rect[3] - rect[1]],
      [(rect[0] + rect[2]) / 2, 0.013, (rect[1] + rect[3]) / 2], material.clone(), label,
      { roomId: id, floorId: floor.id, area, source, evidence: 'Rumsindelning från ritning 2007; vägglägen rastertolkade',
        room: { id, label, area, floor: floor.label } });
    pickables.push(m); return m;
  }
  function partition(floor, a, b, name, doors = [], height = floor.height) {
    const openings = doors.map(d => ({ ...d, kind: 'door', height: 2.05, sill: 0 }));
    let g;
    if (floor === upper) {
      // Upper partitions follow the roof envelope; no walls protrude through the slopes.
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(length, 0);
      const top = t => Math.min(height, 5.0 - Math.abs(a[1] + (b[1] - a[1]) * t) * (5 / 5.325) - 0.12);
      for (let i = 20; i >= 0; i--) shape.lineTo(length * i / 20, Math.max(0.05, top(i / 20)));
      shape.closePath();
      for (const o of openings) {
        // Doors touch the floor: use polygon holes stopping 1 mm above it for reliable triangulation.
        const p = new THREE.Path(), l = o.at - o.width / 2, r = o.at + o.width / 2;
        p.moveTo(l, 0.001); p.lineTo(l, o.height); p.lineTo(r, o.height); p.lineTo(r, 0.001); p.closePath(); shape.holes.push(p);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: inner, bevelEnabled: false });
      geo.translate(0, 0, -inner / 2);
      g = meshIn(floor.group, geo, materials.interior, name);
      g.position.set(a[0], 0, a[1]); g.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    } else g = wall(floor.group, a, b, 0, height, inner, materials.interior, name, openings);
    for (const o of openings) openingDetail(floor.group, a, b, 0, o, materials, `${name} · dörr`);
    return g;
  }
  function facade(floor, a, b, name, openings = []) {
    wall(floor.group, a, b, 0, floor.height, ext, floor === basement ? materials.foundation : materials.exterior, name, openings);
    for (const o of openings) openingDetail(floor.group, a, b, 0, o, { ...materials, door: materials.frame }, `${name} · ${o.kind === 'garage' ? 'garageport' : o.kind === 'door' ? 'dörr' : 'fönster'}`);
    if (floor === ground) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const joints = new THREE.Group(); joints.name = `${name} · liggande panel`;
      joints.position.set(a[0], 0, a[1]); joints.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); floor.group.add(joints);
      const side = (name === 'Trädgårdsfasad' || name === 'Motsatt gavel') ? -1 : 1;
      const jointMaterial = standard('#757c72');
      for (let y = 0.135; y < floor.height; y += 0.135) {
        const gaps = openings.filter(o => y >= (o.sill || 0) - 0.06 && y <= (o.sill || 0) + o.height + 0.06)
          .map(o => [Math.max(0, o.at - o.width / 2 - 0.06), Math.min(length, o.at + o.width / 2 + 0.06)]).sort((u, v) => u[0] - v[0]);
        let from = 0;
        for (const [left, right] of [...gaps, [length, length]]) {
          if (left > from) box(joints, [left - from, 0.007, 0.005], [(left + from) / 2, y, side * (ext / 2 - 0.001)], jointMaterial, 'Panel · horisontell fog', { evidence: 'Liggande panel observerad 2022; brädbredd illustrativ' });
          from = Math.max(from, right);
        }
      }
    }
  }
  const win = (at, width = 1.3, height = 1.3, sill = 0.8) => ({ at, width, height, sill, kind: 'window' });
  const door = (at, width = 0.90, height = 2.05) => ({ at, width, height, sill: 0, kind: 'door' });
  function quarterStair(floor, rise, name) {
    const firstRise = rise * 0.35;
    straightStair(floor.group, [-3.32, 0.25], [-3.32, 1.12], 0.88, 0, firstRise, materials.door, `${name} · första lopp`);
    box(floor.group, [0.96, 0.07, 1.0], [-3.32, firstRise - 0.035, 1.62], materials.door, `${name} · kvartsväng`);
    straightStair(floor.group, [-2.83, 1.61], [-1.06, 1.61], 0.94, firstRise, rise, materials.door, `${name} · andra lopp`);
    // A schematic guard follows the exposed upper edge; exact stair construction is unmeasured.
    for (let x = -2.75; x < -1.0; x += 0.40) {
      const treadHeight = firstRise + (x + 2.83) / 1.77 * (rise - firstRise);
      box(floor.group, [0.035, 0.86, 0.035], [x, treadHeight + 0.43, 2.08], materials.frame, `${name} · räckesståndare`);
    }
  }

  // Basement: the 2007 drawing retains the long garage and the west utility area.
  room(basement, 'available', 'Disponibelt utrymme', [-3.775, -5.025, 0.06, 5.025], null, materials.concrete);
  room(basement, 'garage', 'Garage', [0.18, -5.025, 3.775, 5.025], null, materials.concrete);
  facade(basement, [x0, z0], [x1, z0], 'Källare · trädgård');
  // The door near ELC on 1533711 is inside the stair enclosure. The outer wall is continuous.
  facade(basement, [x0, z0], [x0, z1], 'Källare · entrégavel');
  facade(basement, [x1, z0], [x1, z1], 'Källare · motsatt gavel');
  // The pedestrian door immediately left of the garage is also visible in Street View 2022.
  facade(basement, [x0, z1], [x1, z1], 'Källare · gata', [win(2.05), door(4.74, 0.82), { at: 6.43, width: 2.50, height: 2.05, sill: 0, kind: 'garage' }]);
  partition(basement, [0.12, -5.025], [0.12, 5.025], 'Garageavskiljning', [{ at: 3.85, width: 0.9 }]);
  partition(basement, [-3.775, 0.23], [-2.80, 0.23], 'Källartrappa · inre entré', [{ at: 0.487, width: 0.82 }]);
  partition(basement, [-2.80, 0.23], [-2.80, 1.10], 'Källartrappa · kort sida');
  partition(basement, [-2.80, 1.10], [-0.96, 1.10], 'Källartrappa · lång sida');
  partition(basement, [-0.96, 1.10], [-0.96, 2.17], 'Källartrappa · inre dörr', [{ at: 0.535, width: 0.84 }]);
  partition(basement, [-3.775, 2.17], [-0.96, 2.17], 'Källartrappa · bakvägg');
  quarterStair(basement, 2.45, 'Trappa till bottenplan');

  // Ground floor coordinates are digitised from 1533721.pdf, x1142..1388, y331..652.
  room(ground, 'laundry', 'Tvätt', [-3.775, -5.025, -2.30, -2.79], null, materials.tile);
  room(ground, 'bath', 'Bad', [-3.775, -2.65, -2.30, -0.40], null, materials.tile);
  room(ground, 'kitchen', 'Kök', [-2.16, -5.025, 0.68, -0.43], null);
  room(ground, 'dining', 'Matrum', [0.89, -5.025, 3.775, -1.00], 12.7);
  // Hall surface is split around the open stairwell.
  room(ground, 'hall', 'Hall', [-3.775, -0.25, 0.02, 0.20], null, materials.tile);
  room(ground, 'halllanding', 'Hall vid trappa', [-2.78, 0.25, 0.02, 1.02], null, materials.tile);
  room(ground, 'bedroom0', 'Sovrum', [-3.775, 2.26, -0.04, 5.025], 10.4);
  room(ground, 'living', 'Vardagsrum', [0.20, -0.84, 3.775, 5.025], 22.0);
  facade(ground, [x0, z1], [x1, z1], 'Gatufasad', [win(2.05), win(5.35), win(7.0, 1.25)]);
  // Garden elevation has three double-leaf windows and one narrower opening.
  facade(ground, [x0, z0], [x1, z0], 'Trädgårdsfasad', [win(2.98, 0.68), win(4.22, 1.20), win(5.74, 1.30), win(7.19, 1.15)]);
  facade(ground, [x0, z0], [x0, z1], 'Entréfasad', [door(1.43, 0.90), win(4.28, 0.98, 0.54, 1.48), door(5.73, 1.05)]);
  facade(ground, [x1, z0], [x1, z1], 'Motsatt gavel', [door(6.25, 0.85)]);
  partition(ground, [-2.24, -5.025], [-2.24, -0.33], 'Våtutrymmen mot kök', [{ at: 1.22, width: 0.74 }]);
  partition(ground, [-3.775, -2.72], [-2.24, -2.72], 'Mellan bad och tvätt');
  partition(ground, [-3.775, -0.33], [0.08, -0.33], 'Hall mot bad och kök', [{ at: 0.48, width: 0.76 }, { at: 2.85, width: 0.84 }]);
  partition(ground, [0.08, -2.75], [0.08, 5.025], 'Vardagsrum mot kök och sovrum', [{ at: 3.15, width: 0.96 }]);
  // 1533721 shows a door at the south end of this short partition, hinged south.
  partition(ground, [0.78, -5.025], [0.78, -2.74], 'Kök mot matrum', [{ at: 1.81, width: 0.86, hingeEnd: true }]);
  partition(ground, [0.08, -0.94], [3.775, -0.94], 'Matrum mot vardagsrum', [{ at: 1.52, width: 0.9 }]);
  partition(ground, [-3.775, 2.20], [0.08, 2.20], 'Sovrum mot hall', [{ at: 3.0, width: 0.84 }]);
  quarterStair(ground, 2.65, 'Trappa till överplan');

  // Upper storey: low storage beneath both roof slopes, three rooms, hall and shower/WC.
  room(upper, 'upperroom', 'Rum', [-3.775, -3.64, -0.18, -0.30], 10.5);
  room(upper, 'bedroom1', 'Sovrum', [-0.04, -3.64, 3.775, -0.30], 12.0);
  room(upper, 'bedroom2', 'Sovrum', [0.82, 0.51, 3.775, 3.30], 9.3);
  room(upper, 'shower', 'Dusch / WC', [-3.775, -0.16, -1.04, 1.07], null, materials.tile);
  room(upper, 'upperhall', 'Hall', [-0.92, -0.16, 0.68, 2.05], null);
  room(upper, 'attic', 'Vind / förvaring', [-3.775, 2.22, 0.70, 3.65], null, materials.concrete);
  room(upper, 'atticback', 'Lågvind', [-3.775, -5.025, 3.775, -3.80], null, materials.concrete);
  room(upper, 'atticfront', 'Lågvind', [-3.775, 3.80, 3.775, 5.025], null, materials.concrete);
  partition(upper, [-0.11, -3.70], [-0.11, -0.23], 'Mellan övre rum');
  partition(upper, [-3.775, -0.23], [3.775, -0.23], 'Övre rum mot hall', [{ at: 3.13, width: 0.80 }, { at: 4.19, width: 0.80 }]);
  partition(upper, [-0.98, -0.23], [-0.98, 2.16], 'Dusch mot hall', [{ at: 0.86, width: 0.73 }]);
  partition(upper, [-3.775, 1.12], [-0.98, 1.12], 'Dusch mot trappa');
  // 1533711 has a closed boundary and a door between HALL (10) and VIND (15).
  partition(upper, [-3.775, 2.16], [0.75, 2.16], 'Hall och trappa mot vind', [{ at: 3.27, width: 0.80, hingeEnd: true }]);
  partition(upper, [0.75, 0.44], [3.775, 0.44], 'Sovrum mot garderob');
  partition(upper, [0.75, 0.44], [0.75, 3.42], 'Sovrum mot hall', [{ at: 0.71, width: 0.80 }]);
  partition(upper, [0.75, 3.42], [3.775, 3.42], 'Sovrum mot lågvind', [], 1.55);
  partition(upper, [-3.775, -3.73], [3.775, -3.73], 'Knävägg trädgård', [], 1.45);
  partition(upper, [-3.775, 3.73], [3.775, 3.73], 'Knävägg gata', [], 1.45);

  // Full gable profiles with real window apertures, matching the two 2007 elevations.
  function gable(x, name, windows) {
    const shape = new THREE.Shape();
    shape.moveTo(-D / 2, 0); shape.lineTo(D / 2, 0); shape.lineTo(0, 5.0); shape.closePath();
    for (const o of windows) {
      const p = new THREE.Path(), left = o.center - o.width / 2, right = o.center + o.width / 2;
      p.moveTo(left, 0.80); p.lineTo(left, 2.10); p.lineTo(right, 2.10); p.lineTo(right, 0.80); p.closePath(); shape.holes.push(p);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: ext, bevelEnabled: false });
    geo.rotateY(-Math.PI / 2);
    const g = meshIn(upper.group, geo, materials.exterior, name);
    g.position.x = x;
    for (const o of windows) openingDetail(upper.group, [x - ext / 2, -D / 2], [x - ext / 2, D / 2], 0, win(o.center + D / 2, o.width), materials, `${name} · fönster`);
  }
  gable(-W / 2 + ext, 'Överplan · entrégavel', [{ center: -1.20, width: 1.25 }, { center: 0.61, width: 0.46 }]);
  gable(W / 2, 'Överplan · motsatt gavel', [{ center: -1.21, width: 1.25 }, { center: 1.10, width: 1.25 }]);

  // The roof pitch is traced from section A–A, not an explicitly dimensioned angle.
  const ridgeY = 7.65, slope = 5.0 / 5.325, reach = D / 2 + 0.32;
  const runLength = Math.hypot(reach, reach * slope), angle = Math.atan(slope);
  const tileEdge = standard('#171e23', { roughness: 0.45 });
  for (const sign of [-1, 1]) {
    const panel = box(roof, [W + 0.52, 0.17, runLength], [0, ridgeY - reach * slope / 2, sign * reach / 2], materials.roof, sign > 0 ? 'Takfall mot gata' : 'Takfall mot trädgård', { evidence: 'Profil ur sektion 1971; mörk taktäckning observerad 2022' });
    panel.rotation.x = sign * angle;
    for (let dist = 0.2; dist < runLength; dist += 0.32) {
      const z = sign * dist * Math.cos(angle), y = ridgeY - dist * Math.sin(angle) + 0.10;
      const seam = box(roof, [W + 0.54, 0.027, 0.036], [0, y, z], tileEdge, 'Takpannor · skift', { evidence: 'Illustrativ pannindelning; taktäckning från foto 2022' });
      seam.rotation.x = sign * angle;
    }
    // White fascia, dark gutter and two corner downpipes.
    box(roof, [W + 0.60, 0.19, 0.13], [0, ridgeY - reach * slope - 0.01, sign * reach], materials.frame, 'Takfot');
    box(roof, [W + 0.66, 0.105, 0.12], [0, ridgeY - reach * slope + 0.03, sign * (reach + 0.075)], materials.metal, 'Hängränna');
    for (const x of [-W / 2, W / 2]) {
      const pipe = meshIn(ground.group, new THREE.CylinderGeometry(0.045, 0.045, 2.40, 12), materials.frame, 'Stuprör', { evidence: 'Placering och diameter illustrativa' });
      pipe.position.set(x, 1.20, sign * (D / 2 + 0.17));
    }
  }
  box(roof, [W + 0.62, 0.13, 0.16], [0, ridgeY + 0.08, 0], tileEdge, 'Nock');
  for (const x of [-W / 2 - 0.15, W / 2 + 0.15]) {
    for (const sign of [-1, 1]) {
      const board = box(roof, [0.12, 0.17, runLength], [x, ridgeY - reach * slope / 2, sign * reach / 2], materials.frame, 'Vindskiva');
      board.rotation.x = sign * angle;
    }
  }
  // The section dimensions 2.40 m headroom: the upper ceiling is flat centrally
  // and follows the slope near the knee walls. It belongs to the removable roof.
  box(roof, [W - 0.60, 0.08, 5.27], [0, 5.09, 0], materials.interior, 'Överplan · innertak 2,40 m', { evidence: 'Rumshöjd 2,40 m uttryckligen måttsatt i sektion 1971' });
  for (const sign of [-1, 1]) {
    const innerRun = 3.73 - 2.635;
    const lining = box(roof, [W - 0.60, 0.065, Math.hypot(innerRun, innerRun * slope)],
      [0, ridgeY - (2.635 + innerRun / 2) * slope - 0.045, sign * (2.635 + innerRun / 2)], materials.interior, 'Överplan · snedtak');
    lining.rotation.x = sign * angle;
  }

  // White broad trim and siding joints: colour is observed on the physically numbered house 5.
  for (const floor of [ground]) {
    for (const x of [x0 - 0.02, x1 + 0.02]) for (const z of [z0 - 0.02, z1 + 0.02]) {
      box(floor.group, [0.19, floor.height, 0.19], [x, floor.height / 2, z], materials.frame, 'Vit hörnbräda');
    }
  }
  // Close the exposed perimeter of structural slabs with exterior fascia.
  for (const floor of [ground, upper]) {
    for (const sign of [-1, 1]) {
      box(floor.group, [W, 0.25, 0.035], [0, -0.125, sign * (D / 2 - 0.0175)], materials.frame, 'Bjälklagskant · vit fasadbräda');
      box(floor.group, [0.035, 0.25, D - 0.07], [sign * (W / 2 - 0.0175), -0.125, 0], materials.frame, 'Bjälklagskant · vit fasadbräda');
    }
  }

  // Fixed fittings are schematic readings of the submitted plans, never claimed as current furniture.
  function cupboard(floor, pos, size, label) {
    const m = box(floor.group, size, pos, materials.frame, label, { source, evidence: 'Fast inredning enligt arkivsymbol; detaljform och kulör illustrativa' });
    box(floor.group, [0.025, 0.16, 0.025], [pos[0], pos[1], pos[2] + size[2] / 2 + 0.018], materials.metal, `${label} · beslag`);
    return m;
  }
  for (let z = 2.55; z < 4.95; z += 0.60) cupboard(ground, [-0.43, 1.05, z], [0.57, 2.10, 0.56], 'Sovrum · garderob');
  for (let x = 1.05; x < 3.65; x += 0.58) cupboard(upper, [x, 1.02, 0.12], [0.55, 2.04, 0.58], 'Överplan · garderob');
  // Kitchen cabinets and worktop aligned along the wet-room partition.
  for (let z = -3.22; z < -0.83; z += 0.59) cupboard(ground, [-1.86, 0.43, z], [0.59, 0.86, 0.56], 'Kök · underskåp');
  box(ground.group, [0.64, 0.04, 2.92], [-1.86, 0.90, -2.27], materials.concrete, 'Kök · arbetsbänk', { evidence: 'Schematiskt enligt ritning' });
  cupboard(ground, [-0.24, 1.05, -2.00], [0.60, 2.10, 1.37], 'Kök · kyl och förvaring');
  // Two G-labelled cupboards face the dining room beside the kitchen doorway.
  for (const z of [-2.35, -1.64]) cupboard(ground, [0.44, 1.05, z], [0.57, 2.10, 0.67], 'Matrum · garderob enligt G-symbol');
  const sink = box(ground.group, [0.43, 0.025, 0.60], [-1.86, 0.93, -2.00], materials.metal, 'Kök · diskho');
  box(ground.group, [0.025, 0.25, 0.025], [-2.05, 1.045, -2.0], materials.metal, 'Kök · blandare');
  function toilet(floor, x, z) {
    box(floor.group, [0.38, 0.75, 0.19], [x, 0.375, z - 0.22], materials.porcelain, 'WC · cistern');
    const bowl = meshIn(floor.group, new THREE.CylinderGeometry(0.23, 0.16, 0.38, 20), materials.porcelain, 'WC · stol');
    bowl.scale.z = 1.32; bowl.position.set(x, 0.23, z);
    const seat = meshIn(floor.group, new THREE.TorusGeometry(0.19, 0.035, 10, 24), materials.frame, 'WC · sits');
    seat.rotation.x = -Math.PI / 2; seat.scale.y = 1.3; seat.position.set(x, 0.445, z);
  }
  toilet(ground, -2.66, -1.2); toilet(upper, -1.65, 0.31);
  // BAD is the room name. The actual fixture annotation says DUSCH, not bathtub.
  box(ground.group, [0.83, 0.045, 0.83], [-3.31, 0.035, -2.13], materials.tile, 'Bad · duschplats', { source, evidence: 'DUSCH anges uttryckligen i 1533721; exakt duschavskärmning okänd' });
  box(ground.group, [0.09, 0.014, 0.09], [-3.31, 0.063, -2.13], materials.metal, 'Bad · golvbrunn', { evidence: 'Symbolisk detalj; faktisk placering ej måttsatt' });
  box(ground.group, [0.035, 0.70, 0.035], [-3.70, 1.45, -2.13], materials.metal, 'Bad · duscharmatur', { evidence: 'Schematisk armatur vid ritningens duschplats' });
  box(ground.group, [0.40, 0.13, 0.48], [-2.52, 0.79, -1.99], materials.porcelain, 'Bad · tvättställ', { source, evidence: 'Tvättställssymbol vid högra väggen i 1533721' });
  box(upper.group, [0.47, 0.13, 0.37], [-2.55, 0.79, 0.10], materials.porcelain, 'Dusch / WC · tvättställ', { source, evidence: 'Rektangulär tvättställssymbol vid övre väggen i 1533711' });
  box(upper.group, [0.85, 0.055, 0.83], [-3.29, 0.05, 0.37], materials.porcelain, 'Dusch · golv');
  box(upper.group, [0.025, 1.9, 0.82], [-2.87, 0.98, 0.37], materials.glass, 'Dusch · skärm');
  cupboard(ground, [-3.40, 0.43, -3.55], [0.60, 0.86, 0.60], 'Tvätt · maskin');
  cupboard(ground, [-3.34, 1.04, -4.68], [0.66, 2.08, 0.57], 'Tvätt · varmvatten / torkskåp');
  // 2007 fireplace/chimney annotation is specific to this property.
  const stove = meshIn(ground.group, new THREE.CylinderGeometry(0.32, 0.34, 1.15, 24), tileEdge, 'Eldstad · anmäld 2007', { source, evidence: 'Placerad enligt påritad symbol 1533721' });
  stove.position.set(3.38, 0.60, -0.06);
  box(ground.group, [0.44, 0.54, 0.04], [3.38, 0.63, 0.275], materials.glass, 'Eldstad · glas');
  const flue = meshIn(ground.group, new THREE.CylinderGeometry(0.12, 0.12, 1.22, 16), tileEdge, 'Eldstad · rökrör');
  flue.position.set(3.38, 1.84, -0.06);
  const upperFlue = meshIn(upper.group, new THREE.CylinderGeometry(0.13, 0.13, 2.60, 16), tileEdge, 'Skorsten genom överplan');
  upperFlue.position.set(3.38, 1.30, -0.06);
  box(roof, [0.39, 1.27, 0.39], [3.38, 7.96, -0.06], tileEdge, 'Skorsten vid nock · 2007');
  box(roof, [0.50, 0.07, 0.50], [3.38, 8.63, -0.06], materials.metal, 'Skorsten · huv');
  // Original ventilation stack is shown on the other part of the roof.
  box(roof, [0.30, 1.10, 0.30], [-2.10, 6.72, -1.30], tileEdge, 'Ursprunglig takhuv');

  // Small entrance canopy observed in October 2022; its dimensions are approximate.
  const porch = new THREE.Group(); porch.name = 'Entréförstukvist · foto 2022'; ground.group.add(porch);
  const entryZ = z0 + 5.73;
  box(porch, [1.40, 0.16, 1.65], [x0 - 0.8, -0.08, entryZ], materials.concrete, 'Entré · vilplan');
  for (const z of [entryZ - 0.72, entryZ + 0.72]) box(porch, [0.095, 2.1, 0.095], [x0 - 1.4, 1.05, z], materials.frame, 'Entré · stolpe', { evidence: 'Observerad 2022; mått fototolkade' });
  for (const sign of [-1, 1]) {
    const canopy = box(porch, [1.75, 0.12, 1.03], [x0 - 0.75, 2.27, entryZ + sign * 0.39], materials.roof, 'Entré · sadeltak');
    canopy.rotation.x = sign * Math.atan(0.65);
  }
  straightStair(porch, [x0 - 0.80, entryZ + 2.85], [x0 - 0.80, entryZ + 0.82], 1.08, -1.25, 0, materials.concrete, 'Entré · yttertrappa');

  const metadata = { title: 'Avstyckningsvägen 5', units: 'm', surveyVerified: false,
    status: 'modeled', statusLabel: 'Ritningsmodell', sourceStatus: 'Ritningsmodell · 2007 / fasad 2022',
    description: 'Tre plan rekonstruerade från kommunens ritningar, med gatufasadens kulörer observerade 2022.',
    sourceDescription: 'Fastighetsspecifika planer och fasader inkomna 12 oktober 2007. Yttermått och rumshöjder ur originalsektion 1971. Nutida invändig planlösning saknar verifiering.',
    source, footprint: { width: W, depth: D },
    note: 'Planer från 2007, sektion från 1971 och gatufasad från oktober 2022. Dagens insida är inte verifierad.',
    sources: [
      { title: 'Bottenplan · 2007', url: '/sources/2007-ground-1533721.png', detail: 'Avstyckningsvägen 5 och 2:573 står på handlingen. Eldstad är inritad.', status: 'Verifierat dokument' },
      { title: 'Överplan och källare · 2007', url: '/sources/2007-upper-basement-1533711.png', detail: 'Tre övre rum, dusch/WC, garage och disponibelt utrymme.', status: 'Verifierat dokument' },
      { title: 'Fasader A · 2007', url: '/sources/2007-facades-a-1533691.png', detail: 'Båda gavlarna och tillagd skorsten.', status: 'Verifierat dokument' },
      { title: 'Fasader B · 2007', url: '/sources/2007-facades-b-1533701.png', detail: 'Gatufasad med garage och trädgårdsfasad.', status: 'Verifierat dokument' },
      { title: 'Måttsatt sektion · 1971', url: '/sources/1971-section-detail.png', detail: '2,20 m i källaren, 2,40 m på bostadsplan, yttervägg 0,30 m.', status: 'Verifierat typhusunderlag' },
      { title: 'Google Street View · oktober 2022', url: 'https://www.google.com/maps/@59.4210658,17.800986,20a,60y,153.01h,90t/data=!3m7!1e1!3m5!1sKZQYCThYtHfJkYmDeemB1g!2e0!7i16384!8i8192', image: '/sources/google-streetview-2022-number5-front.png', detail: 'Fysiskt husnummer 5, grågrön panel, vita foder och svart tak. © Google.', status: 'Visuellt observerat' },
      { title: 'Järfälla ritningsarkiv', url: 'https://e-tjanster.jarfalla.se/oversikt/overview/787', detail: 'LOV50-017475 / LOV50-005623, sök VIKSJÖ 2:573.', status: 'Primärkälla' },
    ].map(s => ({ ...s, image: s.image || (s.url.startsWith('/sources/') ? s.url : undefined) })),
    labels: pickables.filter(p => !['halllanding', 'atticback', 'atticfront'].includes(p.userData.roomId)).map(p => ({
      text: p.name, detail: p.userData.area ? `${p.userData.area.toFixed(1).replace('.', ',')} m² enligt ritning` : 'Ritning 2007', floorId: p.userData.floorId,
      position: [p.position.x, floors.find(f => f.id === p.userData.floorId).elevation + 0.12, p.position.z],
    })),
    assumptions: ['Bjälklag 0,25 m tolkat', 'Innerväggar 0,12 m illustrativa', 'Taklutning cirka 43° avläst ur sektion', 'Öppningslägen rastertolkade', 'Kvartssvängd trappgeometri tolkad; stegantal och mått behöver uppmätas', 'Förstukvistens mått fototolkade', 'Riktning mot sant norr inte kalibrerad'],
  };
  group.updateMatrixWorld(true);
  const boxBounds = new THREE.Box3().setFromObject(group);
  return { group, roof, floors, pickables, bounds: { min: boxBounds.min, max: boxBounds.max }, metadata };
}
