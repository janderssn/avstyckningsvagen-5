import * as THREE from 'three';
import { createEarthworks } from './earthworks.js';

const EPS = 1e-8;
const DEFAULT_FOOTPRINT = [[-4.075, -5.325], [4.075, -5.325], [4.075, 5.325], [-4.075, 5.325]];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const minus = (a, b) => [a[0] - b[0], a[1] - b[1]];

function polygon(input, label) {
  if (!Array.isArray(input) || input.length < 3) throw new Error(`${label} requires at least three [x,z] vertices`);
  const points = input.map(point => {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) throw new Error(`${label} has invalid coordinates`);
    return [...point];
  });
  if (Math.hypot(...minus(points[0], points.at(-1))) < EPS) points.pop();
  if (points.length < 3) throw new Error(`${label} is degenerate`);
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    if (Math.hypot(...minus(a, b)) < EPS) throw new Error(`${label} has duplicate adjacent vertices`);
    area += cross(a, b);
    for (let j = i + 2; j < points.length; j++) {
      if ((j + 1) % points.length === i) continue;
      const c = points[j], d = points[(j + 1) % points.length], r = minus(b, a), s = minus(d, c), den = cross(r, s);
      if (Math.abs(den) < EPS) continue;
      const delta = minus(c, a), t = cross(delta, s) / den, u = cross(delta, r) / den;
      if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) throw new Error(`${label} self-intersects`);
    }
  }
  if (Math.abs(area) < EPS) throw new Error(`${label} has zero area`);
  return points;
}

/** Boundary counts as inside, useful for clipping and parcel membership checks. */
export function pointInPolygon(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i], edge = minus(b, a), delta = minus(point, a);
    if (Math.abs(cross(edge, delta)) < EPS && point[0] >= Math.min(a[0], b[0]) - EPS && point[0] <= Math.max(a[0], b[0]) + EPS
      && point[1] >= Math.min(a[1], b[1]) - EPS && point[1] <= Math.max(a[1], b[1]) + EPS) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Split at polygon crossings and retain only exterior subsegments. */
export function outsideSegments(a, b, ring) {
  const direction = minus(b, a), cuts = [0, 1];
  if (Math.hypot(...direction) < EPS) return [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], edge = minus(q, p), denominator = cross(direction, edge);
    if (Math.abs(denominator) < EPS) {
      if (Math.abs(cross(minus(p, a), direction)) < EPS) {
        const squared = direction[0] ** 2 + direction[1] ** 2;
        for (const endpoint of [p, q]) {
          const delta = minus(endpoint, a), t = (delta[0] * direction[0] + delta[1] * direction[1]) / squared;
          if (t > EPS && t < 1 - EPS) cuts.push(t);
        }
      }
      continue;
    }
    const delta = minus(p, a), t = cross(delta, edge) / denominator, u = cross(delta, direction) / denominator;
    if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) cuts.push(t);
  }
  cuts.sort((x, y) => x - y);
  const unique = cuts.filter((value, index) => index === 0 || value - cuts[index - 1] > EPS);
  const at = t => [a[0] + direction[0] * t, a[1] + direction[1] * t];
  const result = [];
  for (let i = 1; i < unique.length; i++) {
    if (!pointInPolygon(at((unique[i - 1] + unique[i]) / 2), ring)) result.push([at(unique[i - 1]), at(unique[i])]);
  }
  return result;
}

function interpolator(data) {
  const grid = data.heightGrid;
  if (grid) {
    const { x0, z0, dx, dz, cols, rows } = grid;
    const heights = Array.isArray(grid.heights?.[0]) ? grid.heights.flat() : grid.heights;
    if (![x0, z0, dx, dz].every(Number.isFinite) || dx <= 0 || dz <= 0 || !Number.isInteger(cols) || !Number.isInteger(rows)
      || cols < 2 || rows < 2 || heights?.length !== cols * rows || !Array.from(heights).every(Number.isFinite)) throw new Error('Invalid regular heightGrid');
    return {
      method: 'bilinear_regular_grid; clamped_at_grid_edges',
      heightAt(x, z) {
        const gx = THREE.MathUtils.clamp((x - x0) / dx, 0, cols - 1), gz = THREE.MathUtils.clamp((z - z0) / dz, 0, rows - 1);
        const ix = Math.min(Math.floor(gx), cols - 2), iz = Math.min(Math.floor(gz), rows - 2), tx = gx - ix, tz = gz - iz;
        const h = (cx, cz) => heights[cz * cols + cx];
        return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(ix, iz), h(ix + 1, iz), tx), THREE.MathUtils.lerp(h(ix, iz + 1), h(ix + 1, iz + 1), tx), tz);
      },
    };
  }
  const points = data.elevations;
  if (!Array.isArray(points) || points.length === 0 || points.some(p => !Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite))) {
    throw new Error('Site requires supplied elevations [x,y,z] or a regular heightGrid; no default height data is invented');
  }
  return {
    method: 'inverse_distance_squared_from_supplied_samples; extrapolated_outside_samples',
    heightAt(x, z) {
      let sum = 0, weights = 0;
      for (const point of points) {
        const distanceSquared = (point[0] - x) ** 2 + (point[2] - z) ** 2;
        if (distanceSquared < EPS ** 2) return point[1];
        const weight = 1 / distanceSquared;
        sum += point[1] * weight; weights += weight;
      }
      return sum / weights;
    },
  };
}

function lineObject(points, color, opacity, name) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const object = new THREE.LineSegments(geometry, material);
  object.name = name;
  object.userData = { label: name, units: 'm' };
  return object;
}

/**
 * Build terrain from supplied parcel/height data in house-local metres, Y up.
 * No neighbor buildings or solid outside terrain are created.
 */
export function buildSite(data) {
  const parcel = polygon(data.parcel, 'parcel');
  const footprint = data.footprint === null ? null : polygon(data.footprint || DEFAULT_FOOTPRINT, 'footprint');
  if (footprint && (footprint.some(point => !pointInPolygon(point, parcel))
    || footprint.some((point, i) => outsideSegments(point, footprint[(i + 1) % footprint.length], parcel).length))) throw new Error('Building footprint must lie fully inside parcel');
  const interpolation = interpolator(data);
  const baseHeightAt = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('heightAt requires finite x,z');
    return interpolation.heightAt(x, z);
  };
  const minX = Math.min(...parcel.map(p => p[0])), maxX = Math.max(...parcel.map(p => p[0]));
  const minZ = Math.min(...parcel.map(p => p[1])), maxZ = Math.max(...parcel.map(p => p[1]));
  const context = data.contextBounds || { min: [minX - 10, minZ - 10], max: [maxX + 10, maxZ + 10] };
  if (context.min?.length !== 2 || context.max?.length !== 2 || ![...context.min, ...context.max].every(Number.isFinite)
    || context.min[0] > minX || context.min[1] > minZ || context.max[0] < maxX || context.max[1] < maxZ) throw new Error('contextBounds must contain the parcel');
  const resolution = data.terrainResolution ?? 1.5;
  const gridSpacing = data.gridSpacing ?? 2;
  const contourResolution = data.contourResolution ?? 1.5;
  const contourInterval = data.contourInterval ?? 1;
  const contourOffset = data.contourOffset ?? 0;
  if (![resolution, gridSpacing, contourResolution, contourInterval].every(value => Number.isFinite(value) && value > 0)) throw new Error('Site spacings must be positive');
  if (!Number.isFinite(contourOffset)) throw new Error('Contour offset must be finite');
  const group = new THREE.Group(); group.name = 'Tomt och omgivande höjdkurvor';
  const metadata = { ...data.metadata, units: 'm', upAxis: 'Y', interpolation: interpolation.method,
    materialInterpretation: 'Illustrative green/earth material; not a classified surface survey',
    parcelAreaM2: Math.abs(parcel.reduce((sum, p, i) => sum + cross(p, parcel[(i + 1) % parcel.length]), 0) / 2),
    outsideSolidTerrain: false, neighborBuildings: false };
  group.userData = metadata;

  // Triangulate the exact boundary and footprint hole, then uniformly subdivide.
  // Uniform subdivision gives matching edge vertices on neighboring triangles.
  const vectors = parcel.map(p => new THREE.Vector2(...p));
  const hole = footprint?.map(p => new THREE.Vector2(...p));
  const triangles = THREE.ShapeUtils.triangulateShape(vectors, hole ? [hole] : []);
  const flat = [...parcel, ...(footprint || [])];
  const earthworks = createEarthworks(data.earthworks, { parcel, footprint, baseHeightAt, pointInPolygon, validatePolygon: polygon,
    domainTriangles: triangles.map(face => face.map(index => flat[index])) });
  const heightAt = (x, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error('heightAt requires finite x,z');
    return earthworks.heightAt(x, z);
  };
  metadata.earthworks = earthworks.metadata;
  const longest = Math.max(...triangles.flatMap(t => t.map((index, i) => Math.hypot(...minus(flat[index], flat[t[(i + 1) % 3]])))));
  const depth = Math.min(7, Math.max(0, Math.ceil(Math.log2(longest / resolution))));
  if (triangles.length * 4 ** depth > 250000) throw new Error('Terrain input is too complex at this resolution');
  const positions = [], indices = [], vertices = new Map();
  const vertex = point => {
    const key = point.map(value => value.toFixed(9)).join(',');
    if (!vertices.has(key)) {
      vertices.set(key, positions.length / 3);
      positions.push(point[0], baseHeightAt(...point), point[1]);
    }
    return vertices.get(key);
  };
  const subdivide = (a, b, c, level) => {
    if (level > 0) {
      const ab = a.map((v, i) => (v + b[i]) / 2), bc = b.map((v, i) => (v + c[i]) / 2), ca = c.map((v, i) => (v + a[i]) / 2);
      subdivide(a, ab, ca, level - 1); subdivide(ab, b, bc, level - 1); subdivide(ca, bc, c, level - 1); subdivide(ab, bc, ca, level - 1);
    } else {
      for (const piece of earthworks.clipTerrainTriangle([a, b, c])) {
        for (let i = 1; i < piece.length - 1; i++) {
          const [p, q, r] = [piece[0], piece[i], piece[i + 1]];
          // Positive XZ winding points down in Three.js; reverse it for Y-up normals.
          if (cross(minus(q, p), minus(r, p)) > 0) indices.push(vertex(p), vertex(r), vertex(q));
          else indices.push(vertex(p), vertex(q), vertex(r));
        }
      }
    }
  };
  for (const face of triangles) subdivide(...face.map(index => flat[index]), depth);
  const terrainGeometry = new THREE.BufferGeometry();
  terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  terrainGeometry.setIndex(indices); terrainGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeometry, new THREE.MeshStandardMaterial({ color: data.terrainColor || '#777c58', roughness: 0.96, side: THREE.DoubleSide }));
  terrain.name = 'Markyta inom tomtgränsen'; terrain.receiveShadow = true;
  terrain.userData = { label: terrain.name, evidence: data.metadata?.elevationSource || 'Interpolerade angivna höjder', parcelOnly: true, buildingFootprintHole: !!footprint };
  earthworks.closeSurfaceSeams(terrain);
  group.add(terrain, earthworks.group);

  const outsideGrid = [], contourPoints = [], boundaryPoints = [];
  const appendOutside = (target, a, b, constantHeight = null) => {
    for (const [p, q] of outsideSegments(a, b, parcel)) {
      target.push(p[0], (constantHeight ?? baseHeightAt(...p)) + 0.015, p[1], q[0], (constantHeight ?? baseHeightAt(...q)) + 0.015, q[1]);
    }
  };
  const sampleLine = (a, b) => {
    const count = Math.max(1, Math.ceil(Math.hypot(...minus(b, a)) / resolution));
    for (let i = 0; i < count; i++) appendOutside(outsideGrid, a.map((v, k) => THREE.MathUtils.lerp(v, b[k], i / count)), a.map((v, k) => THREE.MathUtils.lerp(v, b[k], (i + 1) / count)));
  };
  for (let x = Math.ceil(context.min[0] / gridSpacing) * gridSpacing; x <= context.max[0] + EPS; x += gridSpacing) sampleLine([x, context.min[1]], [x, context.max[1]]);
  for (let z = Math.ceil(context.min[1] / gridSpacing) * gridSpacing; z <= context.max[1] + EPS; z += gridSpacing) sampleLine([context.min[0], z], [context.max[0], z]);

  // Marching squares over the supplied/interpolated heights; no synthetic relief.
  const cols = Math.ceil((context.max[0] - context.min[0]) / contourResolution), rows = Math.ceil((context.max[1] - context.min[1]) / contourResolution);
  if (cols * rows > 150000) throw new Error('Contour context is too large at this resolution');
  const lattice = Array.from({ length: rows + 1 }, (_, iz) => Array.from({ length: cols + 1 }, (_, ix) => {
    const x = THREE.MathUtils.lerp(context.min[0], context.max[0], ix / cols), z = THREE.MathUtils.lerp(context.min[1], context.max[1], iz / rows);
    return [x, z, baseHeightAt(x, z)];
  }));
  for (let iz = 0; iz < rows; iz++) for (let ix = 0; ix < cols; ix++) {
    const corners = [lattice[iz][ix], lattice[iz][ix + 1], lattice[iz + 1][ix + 1], lattice[iz + 1][ix]];
    const lo = Math.min(...corners.map(p => p[2])), hi = Math.max(...corners.map(p => p[2]));
    for (let level = Math.ceil((lo - contourOffset) / contourInterval) * contourInterval + contourOffset; level < hi; level += contourInterval) {
      const cuts = [];
      for (let edge = 0; edge < 4; edge++) {
        const a = corners[edge], b = corners[(edge + 1) % 4];
        if ((a[2] < level) !== (b[2] < level)) {
          const t = (level - a[2]) / (b[2] - a[2]); cuts.push([THREE.MathUtils.lerp(a[0], b[0], t), THREE.MathUtils.lerp(a[1], b[1], t)]);
        }
      }
      if (cuts.length === 2) appendOutside(contourPoints, cuts[0], cuts[1], level);
      else if (cuts.length === 4) {
        const same = (corners.reduce((sum, p) => sum + p[2], 0) / 4 >= level) === (corners[0][2] >= level);
        for (const [a, b] of same ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]]) appendOutside(contourPoints, cuts[a], cuts[b], level);
      }
    }
  }
  for (let i = 0; i < parcel.length; i++) {
    const a = parcel[i], b = parcel[(i + 1) % parcel.length], count = Math.max(1, Math.ceil(Math.hypot(...minus(b, a)) / resolution));
    for (let step = 0; step < count; step++) {
      for (const t of [step / count, (step + 1) / count]) {
        const p = a.map((v, k) => THREE.MathUtils.lerp(v, b[k], t)); boundaryPoints.push(p[0], heightAt(...p) + 0.04, p[1]);
      }
    }
  }
  const grid = lineObject(outsideGrid, '#777464', 0.38, 'Omgivning · höjdföljande rutnät');
  const contours = lineObject(contourPoints, '#8c8979', 0.62, 'Omgivning · höjdkurvor');
  const boundary = lineObject(boundaryPoints, '#d7ad69', 0.95, 'Tomtgräns');
  grid.userData.outsideParcelOnly = true; contours.userData.outsideParcelOnly = true;
  group.add(grid, contours, boundary); group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(terrain).union(new THREE.Box3().setFromObject(boundary));
  if (earthworks.surfaces.length || earthworks.walls.length) bounds.union(new THREE.Box3().setFromObject(earthworks.group));
  const setOutsideStyle = style => {
    if (!['grid', 'contours', 'both', 'none'].includes(style)) throw new Error(`Unknown outside style: ${style}`);
    grid.visible = style === 'grid' || style === 'both'; contours.visible = style === 'contours' || style === 'both';
  };
  setOutsideStyle(data.outsideStyle || 'grid');
  return { group, terrain, earthworks, surroundings: { grid, contours }, boundary, bounds, heightAt, baseHeightAt, metadata, setOutsideStyle };
}
