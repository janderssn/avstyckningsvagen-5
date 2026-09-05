import { Box3, Matrix4, Plane, ShapeUtils, Vector2, Vector3 } from 'three';

const emptySection = () => ({
  positions: new Float32Array(), segments: new Float32Array(), contours: [],
  diagnostics: { openChains: 0, loops: 0, triangles: 0, ambiguousComponents: 0, grazingComponents: 0, triangulationFailures: 0, sampleOffset: 0 },
});

function inside(point, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}

function simplify(ids, nodes, tolerance) {
  const result = [...ids];
  let changed = true;
  while (changed && result.length > 3) {
    changed = false;
    for (let i = result.length - 1; i >= 0 && result.length > 3; i--) {
      const a = nodes[result[(i + result.length - 1) % result.length]].uv;
      const b = nodes[result[i]].uv;
      const c = nodes[result[(i + 1) % result.length]].uv;
      const abx = b.x - a.x, aby = b.y - a.y, bcx = c.x - b.x, bcy = c.y - b.y;
      if (Math.abs(abx * bcy - aby * bcx) <= tolerance * (Math.hypot(abx, aby) + Math.hypot(bcx, bcy)) && abx * bcx + aby * bcy >= 0) {
        result.splice(i, 1); changed = true;
      }
    }
  }
  return result;
}

/**
 * Cross-section of a triangle mesh, in world metres. Closed contours are
 * triangulated with their immediate holes; nested islands become separate
 * solids. No geometry-type assumptions or convex fan triangulation are used.
 *
 * Open/non-manifold intersection graphs retain outlines and diagnostics, but
 * are never joined by an invented edge. A grazing/coplanar-only surface does
 * not create a cap. At vertex/edge coincidences, a sub-millimetre sample into
 * the retained half-space resolves the section; vertices project back onto
 * the exact supplied plane. epsilon is a world-space tolerance in metres.
 */
export function sectionMesh(mesh, suppliedPlane, { epsilon } = {}) {
  const result = emptySection();
  if (!mesh?.geometry?.attributes?.position || !suppliedPlane?.normal?.lengthSq()) return result;
  mesh.updateWorldMatrix(true, false);

  if (mesh.isInstancedMesh) {
    const positions = [], segments = [], matrix = new Matrix4();
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const proxy = {
        geometry: mesh.geometry, matrixWorld: mesh.matrixWorld.clone().multiply(matrix),
        updateWorldMatrix() {},
      };
      const section = sectionMesh(proxy, suppliedPlane, { epsilon });
      for (const n of section.positions) positions.push(n);
      for (const n of section.segments) segments.push(n);
      result.contours.push(...section.contours);
      for (const key of Object.keys(result.diagnostics)) result.diagnostics[key] += section.diagnostics[key] || 0;
    }
    result.positions = new Float32Array(positions); result.segments = new Float32Array(segments);
    return result;
  }

  const plane = new Plane().copy(suppliedPlane).normalize();
  const geometry = mesh.geometry, attribute = geometry.attributes.position;
  const count = attribute.count;
  const world = new Float64Array(count * 3), distances = new Float64Array(count);
  const box = new Box3(), point = new Vector3();
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < count; i++) {
    if (mesh.getVertexPosition) mesh.getVertexPosition(i, point);
    else point.fromBufferAttribute(attribute, i);
    point.applyMatrix4(mesh.matrixWorld);
    world[i * 3] = point.x; world[i * 3 + 1] = point.y; world[i * 3 + 2] = point.z;
    const d = plane.distanceToPoint(point); distances[i] = d;
    min = Math.min(min, d); max = Math.max(max, d); box.expandByPoint(point);
  }
  const extent = box.getSize(new Vector3()).length();
  const eps = epsilon ?? Math.max(1e-7, extent * 1e-8);
  if (!(eps > 0) || !Number.isFinite(eps)) throw new RangeError('Section epsilon must be a finite positive distance.');
  if (!(min < -eps && max > eps)) return result;

  // Avoid ambiguous triangle/plane coincidence. Sampling toward distance > 0
  // matches Three.js clipping's retained half-space; the final cap remains on
  // the original plane. Strict side masks later reject tangent-only loops.
  let offset = distances.some(d => Math.abs(d) <= eps) ? eps * 4 : 0;
  if (offset) for (let attempt = 0; attempt < 8 && distances.some(d => Math.abs(d - offset) <= eps * .05); attempt++) offset *= 1.618;
  result.diagnostics.sampleOffset = offset;

  const normal = plane.normal;
  const origin = normal.clone().multiplyScalar(-plane.constant);
  const u = new Vector3().crossVectors(normal, Math.abs(normal.y) > .9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)).normalize();
  const v = new Vector3().crossVectors(normal, u).normalize();
  const tolerance = eps * 4, toleranceSq = tolerance * tolerance;
  const nodes = [], cells = new Map(), edges = [], edgeMap = new Map();
  const toNode = position => {
    const projected = plane.projectPoint(position, new Vector3());
    const relative = projected.clone().sub(origin), uv = new Vector2(relative.dot(u), relative.dot(v));
    const ix = Math.floor(uv.x / tolerance), iy = Math.floor(uv.y / tolerance);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const id of cells.get(`${ix + dx},${iy + dy}`) || []) if (nodes[id].uv.distanceToSquared(uv) <= toleranceSq) return id;
    }
    const id = nodes.length;
    nodes.push({ point: projected, uv, edges: [] });
    const key = `${ix},${iy}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(id);
    return id;
  };
  const index = geometry.index;
  const available = index ? index.count : count;
  const start = Math.max(0, geometry.drawRange?.start || 0);
  const end = Math.min(available, start + (geometry.drawRange?.count ?? Infinity));
  const vertices = [new Vector3(), new Vector3(), new Vector3()];
  for (let i = start; i + 2 < end; i += 3) {
    const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
    const ds = ids.map(id => distances[id] - offset);
    if (ds.every(d => d > 0) || ds.every(d => d < 0)) continue;
    let sides = 0;
    for (let j = 0; j < 3; j++) {
      vertices[j].fromArray(world, ids[j] * 3);
      if (distances[ids[j]] < -eps) sides |= 1;
      if (distances[ids[j]] > eps) sides |= 2;
    }
    const hits = [];
    for (let j = 0; j < 3; j++) {
      const k = (j + 1) % 3;
      if (ds[j] === 0) hits.push(vertices[j].clone());
      if ((ds[j] < 0 && ds[k] > 0) || (ds[j] > 0 && ds[k] < 0)) hits.push(vertices[j].clone().lerp(vertices[k], ds[j] / (ds[j] - ds[k])));
    }
    const hitIds = [...new Set(hits.map(toNode))];
    if (hitIds.length !== 2 || hitIds[0] === hitIds[1]) continue;
    const [a, b] = hitIds.sort((x, y) => x - y), key = `${a},${b}`;
    if (edgeMap.has(key)) { edges[edgeMap.get(key)].sides |= sides; continue; }
    const edgeId = edges.length;
    edgeMap.set(key, edgeId); edges.push({ a, b, sides });
    nodes[a].edges.push(edgeId); nodes[b].edges.push(edgeId);
  }
  const segmentValues = [];
  for (const edge of edges) segmentValues.push(...nodes[edge.a].point.toArray(), ...nodes[edge.b].point.toArray());
  result.segments = new Float32Array(segmentValues);

  const visited = new Set(), loops = [];
  for (let seed = 0; seed < nodes.length; seed++) {
    if (visited.has(seed) || nodes[seed].edges.length === 0) continue;
    const component = [], stack = [seed]; let sideMask = 0;
    while (stack.length) {
      const id = stack.pop();
      if (visited.has(id)) continue;
      visited.add(id); component.push(id);
      for (const edgeId of nodes[id].edges) {
        const edge = edges[edgeId]; sideMask |= edge.sides;
        const next = edge.a === id ? edge.b : edge.a;
        if (!visited.has(next)) stack.push(next);
      }
    }
    if (component.some(id => nodes[id].edges.length !== 2)) {
      result.diagnostics.openChains++;
      if (component.some(id => nodes[id].edges.length > 2)) result.diagnostics.ambiguousComponents++;
      continue;
    }
    if (sideMask !== 3) { result.diagnostics.grazingComponents++; continue; }
    const ordered = []; let current = seed, previousEdge = -1;
    do {
      ordered.push(current);
      const edgeId = nodes[current].edges.find(id => id !== previousEdge);
      const edge = edges[edgeId];
      current = edge.a === current ? edge.b : edge.a; previousEdge = edgeId;
    } while (current !== seed && ordered.length <= component.length);
    if (current !== seed || ordered.length < 3) { result.diagnostics.openChains++; continue; }
    const ids = simplify(ordered, nodes, tolerance);
    const uv = ids.map(id => nodes[id].uv.clone()), points = ids.map(id => nodes[id].point.clone());
    const area = Math.abs(ShapeUtils.area(uv));
    if (area <= toleranceSq) continue;
    loops.push({ uv, points, area, parent: -1, depth: 0 });
  }

  for (let i = 0; i < loops.length; i++) {
    let containingArea = Infinity;
    for (let j = 0; j < loops.length; j++) {
      if (i === j || loops[j].area <= loops[i].area || loops[j].area >= containingArea) continue;
      if (inside(loops[i].uv[0], loops[j].uv)) { loops[i].parent = j; containingArea = loops[j].area; }
    }
  }
  for (const loop of loops) {
    for (let parent = loop.parent; parent !== -1; parent = loops[parent].parent) loop.depth++;
    result.contours.push(loop.points);
  }
  const capValues = [];
  for (let i = 0; i < loops.length; i++) {
    const outer = loops[i];
    if (outer.depth % 2 !== 0) continue;
    const holes = loops.filter(loop => loop.parent === i);
    // Keep the world vertex order aligned with the plane-space triangulation.
    const boundary = [outer, ...holes].map((loop, j) => {
      const reverse = ShapeUtils.isClockWise(loop.uv) === (j === 0);
      return { uv: reverse ? [...loop.uv].reverse() : [...loop.uv], points: reverse ? [...loop.points].reverse() : [...loop.points] };
    });
    const triangles = ShapeUtils.triangulateShape(boundary[0].uv, boundary.slice(1).map(loop => loop.uv));
    const uv = boundary.flatMap(loop => loop.uv), points = boundary.flatMap(loop => loop.points);
    const expectedArea = outer.area - holes.reduce((sum, loop) => sum + loop.area, 0);
    let triangleArea = 0;
    for (const [a, b, c] of triangles) triangleArea += Math.abs((uv[b].x - uv[a].x) * (uv[c].y - uv[a].y) - (uv[b].y - uv[a].y) * (uv[c].x - uv[a].x)) / 2;
    if (Math.abs(triangleArea - expectedArea) > Math.max(toleranceSq * 100, expectedArea * 1e-5)) {
      result.diagnostics.triangulationFailures++; continue;
    }
    for (const triangle of triangles) for (const id of triangle) capValues.push(...points[id].toArray());
  }
  result.positions = new Float32Array(capValues);
  result.diagnostics.loops = loops.length;
  result.diagnostics.triangles = capValues.length / 9;
  return result;
}
