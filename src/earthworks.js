import * as THREE from 'three';

const EPS = 1e-9;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const area2 = ring => ring.reduce((sum, p, i) => sum + cross(p, ring[(i + 1) % ring.length]), 0);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const box = ring => ({ minX: Math.min(...ring.map(p => p[0])), maxX: Math.max(...ring.map(p => p[0])), minZ: Math.min(...ring.map(p => p[1])), maxZ: Math.max(...ring.map(p => p[1])) });
const overlaps = (a, b) => a.minX < b.maxX + EPS && a.maxX > b.minX - EPS && a.minZ < b.maxZ + EPS && a.maxZ > b.minZ - EPS;
const clean = ring => {
  const result = ring.filter((p, i) => Math.hypot(...sub(p, ring[(i + ring.length - 1) % ring.length])) > EPS);
  return result.length >= 3 && Math.abs(area2(result)) > EPS ? result : [];
};

// Sutherland–Hodgman half-plane clipping, with separate polygons on the two sides.
function halfPlane(subject, a, b, keepInside) {
  const result = [], edge = sub(b, a);
  for (let i = 0; i < subject.length; i++) {
    const p = subject[i], q = subject[(i + 1) % subject.length];
    const dp = cross(edge, sub(p, a)), dq = cross(edge, sub(q, a));
    const pInside = keepInside ? dp >= -EPS : dp <= EPS, qInside = keepInside ? dq >= -EPS : dq <= EPS;
    if (pInside) result.push(p);
    if (pInside !== qInside && Math.abs(dp - dq) > EPS) result.push(lerp(p, q, dp / (dp - dq)));
  }
  return clean(result);
}

function ccw(ring) { return area2(ring) >= 0 ? ring : [...ring].reverse(); }
function intersection(subject, clip) {
  let result = subject;
  for (let i = 0; i < clip.length && result.length; i++) result = halfPlane(result, clip[i], clip[(i + 1) % clip.length], true);
  return result;
}
function subtractConvex(subject, clip) {
  if (!overlaps(box(subject), box(clip))) return [subject];
  let remaining = subject;
  const result = [];
  for (let i = 0; i < clip.length && remaining.length; i++) {
    const outside = halfPlane(remaining, clip[i], clip[(i + 1) % clip.length], false);
    if (outside.length) result.push(outside);
    remaining = halfPlane(remaining, clip[i], clip[(i + 1) % clip.length], true);
  }
  return result;
}
function triangles(ring) {
  return THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(...p)), [])
    .map(face => ccw(face.map(i => ring[i]))).filter(t => Math.abs(area2(t)) > EPS);
}
function convex(ring) {
  const points = ccw(ring);
  return points.every((p, i) => cross(sub(points[(i + 1) % points.length], p), sub(points[(i + 2) % points.length], points[(i + 1) % points.length])) >= -EPS);
}
function cutters(ring) { return convex(ring) ? [ccw(ring)] : triangles(ring); }
function subtractAll(subjects, clips) {
  let result = subjects;
  for (const clip of clips) result = result.flatMap(subject => subtractConvex(subject, clip));
  return result;
}
function segmentDistance(point, a, b) {
  const v = sub(b, a), d = sub(point, a), length2 = v[0] ** 2 + v[1] ** 2;
  const t = THREE.MathUtils.clamp((d[0] * v[0] + d[1] * v[1]) / length2, 0, 1);
  return Math.hypot(...sub(point, lerp(a, b, t)));
}

function geometryFromTriangles(faces, heightAt, resolution = Infinity) {
  const positions = [];
  const emit = (a, b, c, depth) => {
    const longest = Math.max(Math.hypot(...sub(a, b)), Math.hypot(...sub(b, c)), Math.hypot(...sub(c, a)));
    if (longest > resolution && depth < 9) {
      const ab = lerp(a, b, 0.5), bc = lerp(b, c, 0.5), ca = lerp(c, a, 0.5);
      emit(a, ab, ca, depth + 1); emit(ab, b, bc, depth + 1); emit(ca, bc, c, depth + 1); emit(ab, bc, ca, depth + 1);
      return;
    }
    for (const p of area2([a, b, c]) > 0 ? [a, c, b] : [a, b, c]) positions.push(p[0], heightAt(...p), p[1]);
    if (positions.length > 4500000) throw new Error('Earthworks surface is too complex at this resolution');
  };
  for (const face of faces) for (let i = 1; i < face.length - 1; i++) emit(face[0], face[i], face[i + 1], 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function mesh(geometry, color, name, userData) {
  const result = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.94, side: THREE.DoubleSide }));
  result.name = name; result.receiveShadow = true; result.castShadow = true;
  result.userData = { label: name, units: 'm', parcelOnly: true, ...userData };
  return result;
}

// Different surface tessellations can share an XZ edge but linearly sample its
// curved DEM at different intervals. Close those vertical seams using the actual
// rendered edge heights, including backfill end faces at a wall's corner.
function closeBackfillSeams(group, terrain, surfaces) {
  if (!surfaces.some(surface => surface.userData.earthworkType === 'backfill')) return 0;
  const edges = [], buckets = new Map(), positions = [];
  const key = p => `${p[0].toFixed(5)},${p[2].toFixed(5)}`;
  for (const object of [terrain, ...surfaces]) {
    const backfill = object.userData.earthworkType === 'backfill';
    const geometry = object.geometry, p = geometry.attributes.position, index = geometry.index, local = new Map();
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const face = [0, 1, 2].map(j => { const n = index ? index.getX(i + j) : i + j; return [p.getX(n), p.getY(n), p.getZ(n)]; });
      for (let j = 0; j < 3; j++) {
        const a = face[j], b = face[(j + 1) % 3], ka = key(a), kb = key(b);
        if (ka === kb) continue;
        const edgeKey = [ka, kb].sort().join('|'), old = local.get(edgeKey);
        if (old) old.count++;
        else local.set(edgeKey, { a, b, backfill, count: 1 });
      }
    }
    for (const edge of local.values()) if (edge.count === 1) edges.push(edge);
  }
  let seamCount = 0;
  for (let id = 0; id < edges.length; id++) {
    const edge = edges[id], { a, b } = edge, dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
    if (length < 1e-5) continue;
    const candidates = new Set(), cells = [];
    for (let x = Math.floor(Math.min(a[0], b[0]) - 1e-5); x <= Math.floor(Math.max(a[0], b[0]) + 1e-5); x++) {
      for (let z = Math.floor(Math.min(a[2], b[2]) - 1e-5); z <= Math.floor(Math.max(a[2], b[2]) + 1e-5); z++) {
        const cell = `${x},${z}`; cells.push(cell);
        for (const candidate of buckets.get(cell) || []) candidates.add(candidate);
      }
    }
    for (const otherId of candidates) {
      const other = edges[otherId]; if (!edge.backfill && !other.backfill) continue;
      const distance = p => Math.abs(dx * (p[2] - a[2]) - dz * (p[0] - a[0])) / length;
      if (distance(other.a) > 1e-5 || distance(other.b) > 1e-5) continue;
      const along = p => ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / length ** 2;
      const ta = along(other.a), tb = along(other.b), lo = Math.max(0, Math.min(ta, tb)), hi = Math.min(1, Math.max(ta, tb));
      if ((hi - lo) * length < 1e-5 || Math.abs(tb - ta) < 1e-9) continue;
      const p = lerp(a, b, lo), q = lerp(a, b, hi), r = lerp(other.a, other.b, (lo - ta) / (tb - ta)), s = lerp(other.a, other.b, (hi - ta) / (tb - ta));
      if (Math.max(Math.abs(p[1] - r[1]), Math.abs(q[1] - s[1])) < 1e-5) continue;
      positions.push(...p, ...q, ...s, ...p, ...s, ...r); seamCount++;
    }
    for (const cell of cells) { if (!buckets.has(cell)) buckets.set(cell, []); buckets.get(cell).push(id); }
  }
  if (positions.length) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
    group.add(mesh(geometry, '#777c58', 'Markanslutningarnas slutna skarvar', { earthworkType: 'backfillSeam', interpreted: true }));
  }
  return seamCount;
}

/** Local interpreted construction above an unchanged DEM. All coordinates are metres, Y up. */
export function createEarthworks(input = {}, { parcel, footprint, domainTriangles, baseHeightAt, pointInPolygon, validatePolygon }) {
  const group = new THREE.Group(); group.name = 'Lokala markarbeten';
  const domain = domainTriangles.map(ccw), surfaces = [], walls = [], wallRegions = [], backfills = [], groundSurfaces = [];
  const inDomain = p => pointInPolygon(p, parcel) && (!footprint || !pointInPolygon(p, footprint)
    || footprint.some((a, i) => segmentDistance(p, a, footprint[(i + 1) % footprint.length]) < EPS));
  const clipped = ring => {
    const result = [];
    for (const face of triangles(ring)) for (const domainFace of domain) {
      if (!overlaps(box(face), box(domainFace))) continue;
      const part = intersection(face, domainFace); if (part.length) result.push(part);
    }
    return result;
  };
  const ids = new Set();
  const patches = (input.surfacePatches || []).map((source, index) => {
    const id = source.id || `surface-${index}`;
    if (ids.has(id)) throw new Error(`Duplicate earthworks surface id: ${id}`);
    ids.add(id);
    const ring = validatePolygon(source.polygon, `earthworks surface ${id}`);
    const plane = { x0: 0, z0: 0, dx: 0, dz: 0, ...source.plane };
    if (![plane.x0, plane.z0, plane.y0, plane.dx, plane.dz].every(Number.isFinite)) throw new Error(`Invalid surface plane: ${id}`);
    const blendEdges = source.blendEdges || [], blendWidth = source.blendWidth ?? 0.7;
    if (!Array.isArray(blendEdges) || blendEdges.some(i => !Number.isInteger(i) || i < 0 || i >= ring.length)
      || !Number.isFinite(blendWidth) || blendWidth <= 0) throw new Error(`Invalid blend edges/width: ${id}`);
    const resolution = source.resolution ?? 0.4;
    if (!Number.isFinite(resolution) || resolution <= 0) throw new Error(`Invalid surface resolution: ${id}`);
    const heightAt = (x, z) => {
      const planeY = plane.y0 + plane.dx * (x - plane.x0) + plane.dz * (z - plane.z0);
      if (!blendEdges.length) return planeY;
      const distance = Math.min(...blendEdges.map(i => segmentDistance([x, z], ring[i], ring[(i + 1) % ring.length])));
      const weight = THREE.MathUtils.clamp(distance / blendWidth, 0, 1);
      return THREE.MathUtils.lerp(baseHeightAt(x, z), planeY, weight);
    };
    return { ...source, id, polygon: ring, plane, resolution, heightAt, cutters: cutters(ring), faces: clipped(ring) };
  });
  for (const source of input.retainingWalls || []) {
    const patch = patches.find(p => p.id === source.surfaceId);
    if (!patch) throw new Error(`Wall ${source.id} refers to an unknown surfaceId`);
    const path = source.path, topHeights = source.topHeights, width = source.width ?? 0.22;
    const capThickness = source.capThickness ?? 0.05, backfillWidth = source.backfillWidth ?? 0;
    if (!Array.isArray(path) || path.length < 2 || path.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))
      || !Array.isArray(topHeights) || topHeights.length !== path.length || !topHeights.every(Number.isFinite)
      || !Number.isFinite(width) || width <= 0 || !Number.isFinite(capThickness) || capThickness < 0
      || !Number.isFinite(backfillWidth) || backfillWidth < 0) throw new Error(`Invalid retaining wall: ${source.id}`);
    const boards = source.boards && { count: 3, height: 0.11, gap: 0.05, postSpacing: 1.8, thickness: 0.035, postWidth: 0.065, ...source.boards };
    if (boards && (!Number.isInteger(boards.count) || boards.count < 1 || boards.count > 12
      || ![boards.height, boards.postSpacing, boards.thickness, boards.postWidth].every(v => Number.isFinite(v) && v > 0)
      || !Number.isFinite(boards.gap) || boards.gap < 0)) throw new Error(`Invalid retaining wall boards: ${source.id}`);
    const wall = new THREE.Group(); wall.name = source.label || source.id || 'Stödmur';
    wall.userData = { label: wall.name, earthworkType: 'retainingWall', surfaceId: patch.id, parcelOnly: true,
      topHeights: [...topHeights], width, capThickness, path: path.map(p => [...p]), interpretation: source.evidence || 'Lokalt tolkad konstruktion; ej uppmätt' };
    const normals = path.slice(0, -1).map((a, i) => {
      const b = path[i + 1], direction = sub(b, a), length = Math.hypot(...direction);
      if (length < EPS) throw new Error(`Zero length wall segment: ${source.id}`);
      let normal = [-direction[1] / length, direction[0] / length];
      const midpoint = lerp(a, b, 0.5), left = [midpoint[0] + normal[0] * 0.001, midpoint[1] + normal[1] * 0.001];
      if (pointInPolygon(left, patch.polygon)) normal = normal.map(v => -v);
      if (source.side === 'left') normal = [-direction[1] / length, direction[0] / length];
      else if (source.side === 'right') normal = [direction[1] / length, -direction[0] / length];
      return normal;
    });
    // Shared mitered cross-sections make both wall and backfill meet at bends.
    const joinedOffset = (index, distance) => {
      const a = normals[Math.max(0, index - 1)], b = normals[Math.min(normals.length - 1, index)];
      const denominator = 1 + a[0] * b[0] + a[1] * b[1];
      if (denominator < 0.1) throw new Error(`Retaining wall corner is too acute: ${source.id}`);
      return [path[index][0] + (a[0] + b[0]) * distance / denominator, path[index][1] + (a[1] + b[1]) * distance / denominator];
    };
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], direction = sub(b, a), length = Math.hypot(...direction);
      const normal = normals[i];
      const offset = (p, distance) => [p[0] + normal[0] * distance, p[1] + normal[1] * distance];
      const ring = [a, b, joinedOffset(i + 1, width), joinedOffset(i, width)];
      const tAt = (x, z) => THREE.MathUtils.clamp(((x - a[0]) * direction[0] + (z - a[1]) * direction[1]) / length ** 2, 0, 1);
      const top = (x, z) => THREE.MathUtils.lerp(topHeights[i], topHeights[i + 1], tAt(x, z));
      const bottom = (x, z) => patch.heightAt(...lerp(a, b, tAt(x, z)));
      for (let j = 0; j <= Math.ceil(length / 0.2); j++) {
        const p = lerp(a, b, j / Math.ceil(length / 0.2));
        if (top(...p) < bottom(...p) - 1e-6) throw new Error(`Wall top is below its surface: ${source.id}`);
      }
      const faces = subtractAll(clipped(ring), wallRegions.flatMap(region => region.cutters));
      const bodyTop = (x, z) => Math.max(bottom(x, z), top(x, z) - capThickness);
      // Clip every prism footprint against the parcel and house hole before extrusion.
      const prism = (lower, upper, color, suffix, prismFaces = faces, kind = null, groundSurface = false) => {
        const positions = [];
        const triangle = (p, q, r) => positions.push(...p, ...q, ...r);
        const lowerGeometry = geometryFromTriangles(prismFaces, lower, 0.4);
        const upperGeometry = geometryFromTriangles(prismFaces, upper, 0.4);
        for (const value of lowerGeometry.attributes.position.array) positions.push(value);
        if (groundSurface) {
          const topMesh = mesh(upperGeometry, color, `${wall.name} · krönyta`, { earthworkType: 'wallTop', surfaceId: patch.id, groundSurface: true });
          wall.add(topMesh); groundSurfaces.push(topMesh);
        } else {
          for (const value of upperGeometry.attributes.position.array) positions.push(value);
          upperGeometry.dispose();
        }
        lowerGeometry.dispose();
        for (const face of prismFaces) {
          const at = (p, h) => [p[0], h(...p), p[1]];
          for (let j = 0; j < face.length; j++) {
            const start = face[j], end = face[(j + 1) % face.length], steps = Math.max(1, Math.ceil(Math.hypot(...sub(end, start)) / 0.2));
            for (let step = 0; step < steps; step++) {
              const p = lerp(start, end, step / steps), q = lerp(start, end, (step + 1) / steps);
              triangle(at(p, lower), at(q, lower), at(q, upper)); triangle(at(p, lower), at(q, upper), at(p, upper));
            }
          }
        }
        const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
        wall.add(mesh(geometry, color, `${wall.name} · ${suffix}`, { earthworkType: kind || (suffix === 'krön' ? 'wallCap' : 'wallBody'), surfaceId: patch.id }));
      };
      prism(bottom, bodyTop, source.color || '#898779', 'mur', faces, null, capThickness === 0);
      if (capThickness > 0) prism(bodyTop, top, source.capColor || '#a4a195', 'krön', faces, null, true);
      if (boards) {
        const boardFaces = clipped([offset(a, (width - boards.thickness) / 2), offset(b, (width - boards.thickness) / 2),
          offset(b, (width + boards.thickness) / 2), offset(a, (width + boards.thickness) / 2)]);
        for (let row = 0; row < boards.count; row++) {
          const lift = boards.gap + row * (boards.height + boards.gap);
          prism((x, z) => top(x, z) + lift, (x, z) => top(x, z) + lift + boards.height,
            boards.color || '#e6e7dd', `bräda ${row + 1}`, boardFaces, 'wallBoard');
        }
        const count = Math.max(1, Math.ceil(length / boards.postSpacing)), half = boards.postWidth / 2;
        for (let post = i === 0 ? 0 : 1; post <= count; post++) {
          const center = offset(lerp(a, b, post / count), width / 2);
          const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [center[0] + half * (u * direction[0] / length + v * normal[0]),
            center[1] + half * (u * direction[1] / length + v * normal[1])]);
          prism(top, (x, z) => top(x, z) + boards.count * (boards.height + boards.gap), boards.color || '#e6e7dd',
            `stolpe ${post + 1}`, clipped(ring), 'wallPost');
        }
      }
      wallRegions.push({ polygon: ring, cutters: cutters(ring), heightAt: top });
      if (backfillWidth > 0) {
        const backRing = [joinedOffset(i, width), joinedOffset(i + 1, width), joinedOffset(i + 1, width + backfillWidth), joinedOffset(i, width + backfillWidth)];
        const heightAt = (x, z) => {
          // Interpolate blend weight and wall-top datum over the joined quad.
          // Both neighbors use the identical cross-section at every path bend.
          let chosen = null;
          for (const indices of [[0, 1, 2], [0, 2, 3]]) {
            const [p, q, r] = indices.map(index => backRing[index]), den = cross(sub(q, p), sub(r, p));
            const wb = cross(sub([x, z], p), sub(r, p)) / den, wc = cross(sub(q, p), sub([x, z], p)) / den, wa = 1 - wb - wc;
            const weights = [wa, wb, wc];
            if (!chosen || Math.min(...weights) > chosen.minimum) chosen = { indices, weights, minimum: Math.min(...weights) };
          }
          let weight = 0, topY = 0;
          chosen.indices.forEach((index, j) => {
            weight += chosen.weights[j] * (index >= 2 ? 1 : 0);
            topY += chosen.weights[j] * topHeights[index === 0 || index === 3 ? i : i + 1];
          });
          return THREE.MathUtils.lerp(topY, baseHeightAt(x, z), THREE.MathUtils.clamp(weight, 0, 1));
        };
        backfills.push({ id: `${source.id || 'wall'}-backfill-${i}`, label: `${wall.name} · markanslutning`, polygon: backRing,
          heightAt, cutters: cutters(backRing), faces: clipped(backRing), resolution: 0.4, color: source.backfillColor || '#777c58', kind: 'backfill' });
      }
    }
    group.add(wall); walls.push(wall);
  }
  // Later listed patches win overlaps; apron surfaces take priority over backfill.
  const regions = [...backfills, ...patches], allCuts = [...regions, ...wallRegions].flatMap(p => p.cutters);
  for (let i = 0; i < regions.length; i++) {
    const region = regions[i], blockers = [...regions.slice(i + 1), ...wallRegions].flatMap(p => p.cutters);
    const faces = subtractAll(region.faces, blockers);
    const surface = mesh(geometryFromTriangles(faces, region.heightAt, region.resolution), region.color || '#666660', region.label || region.id,
      { earthworkType: region.kind || 'surfacePatch', surfaceId: region.id, groundSurface: true, interpreted: true, evidence: region.evidence || 'Lokalt tolkad konstruktion; ej uppmätt' });
    group.add(surface); surfaces.push(surface); groundSurfaces.push(surface);
  }
  const heightAt = (x, z) => {
    if (inDomain([x, z])) {
      for (const region of [...wallRegions, ...[...regions].reverse()]) if (pointInPolygon([x, z], region.polygon)) return region.heightAt(x, z);
    }
    return baseHeightAt(x, z);
  };
  group.userData = { interpreted: true, surfaceCount: patches.length, retainingWallCount: walls.length, modifiesSourceDEM: false, parcelOnly: true };
  return { group, surfaces, walls, groundSurfaces, heightAt, baseHeightAt, metadata: group.userData,
    closeSurfaceSeams: terrain => { group.userData.closedBackfillSeamCount = closeBackfillSeams(group, terrain, surfaces); },
    clipTerrainTriangle: triangle => subtractAll([triangle], allCuts) };
}
