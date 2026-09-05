import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { buildSite, pointInPolygon } from '../src/site.js';

const parcel = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
// Concave L shape: 12 × 5 m plus 8 × 5 m. Edge 4 meets the road.
const patchPolygon = [[-6, 0], [6, 0], [6, 5], [2, 5], [2, 10], [-6, 10]];
const patchRectangles = [[-6, 0, 6, 5], [-6, 5, 2, 10]];
const baseHeight = (x, z) => 0.4 + 0.04 * x + 0.03 * z;
const close = (actual, expected, tolerance = 1e-5) => assert(Math.abs(actual - expected) < tolerance,
  `${actual} differs from ${expected} by ${Math.abs(actual - expected)}`);

function fixture({ footprint = null, walls = false } = {}) {
  return {
    parcel, footprint, contextBounds: { min: [-14, -14], max: [14, 14] },
    heightGrid: { x0: -15, z0: -15, dx: 5, dz: 5, cols: 7, rows: 7,
      heights: Array.from({ length: 49 }, (_, i) => baseHeight(-15 + i % 7 * 5, -15 + Math.floor(i / 7) * 5)) },
    terrainResolution: 0.8, gridSpacing: 2, contourResolution: 1, contourInterval: 0.25,
    earthworks: {
      surfacePatches: [{ id: 'driveway', label: 'Synthetic driveway', polygon: patchPolygon,
        plane: { x0: 0, z0: 0, y0: -2.45, dx: 0, dz: 0 },
        blendEdges: [4], blendWidth: 0.7, color: '#a18d72' }],
      retainingWalls: walls ? [{ id: 'retaining-wall', label: 'Synthetic retaining wall',
        path: [[-6, 0], [6, 0], [6, 5]], surfaceId: 'driveway',
        topHeights: [0.25, 0.75, 0.95], width: 0.22, capThickness: 0.05, color: '#88827a' }] : [],
    },
  };
}

function vertices(object) {
  const position = object.geometry.attributes.position;
  return Array.from({ length: position.count }, (_, index) => new Vector3()
    .fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld));
}

function triangles(mesh) {
  const points = vertices(mesh), index = mesh.geometry.index;
  const result = [], count = index?.count ?? points.length;
  for (let i = 0; i < count; i += 3) result.push([0, 1, 2].map(j => points[index ? index.getX(i + j) : i + j]));
  return result;
}

function polygonArea(ring) {
  return Math.abs(ring.reduce((area, point, i) => {
    const next = ring[(i + 1) % ring.length];
    return area + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
}

const xz = triangle => triangle.map(point => [point.x, point.z]);
const meshArea = mesh => triangles(mesh).reduce((sum, triangle) => sum + polygonArea(xz(triangle)), 0);

// Independent Sutherland–Hodgman clipping makes overlap checks exact in XZ,
// including narrow intersections that triangle-centroid tests would miss.
function rectangleIntersectionArea(ring, [minX, minZ, maxX, maxZ]) {
  let clipped = ring;
  for (const [axis, boundary, direction] of [[0, minX, 1], [0, maxX, -1], [1, minZ, 1], [1, maxZ, -1]]) {
    const output = [];
    for (let i = 0; i < clipped.length; i++) {
      const a = clipped[i], b = clipped[(i + 1) % clipped.length];
      const aInside = (a[axis] - boundary) * direction >= 0;
      const bInside = (b[axis] - boundary) * direction >= 0;
      if (aInside) output.push(a);
      if (aInside !== bInside) {
        const t = (boundary - a[axis]) / (b[axis] - a[axis]);
        output.push(a.map((value, coordinate) => value + t * (b[coordinate] - value)));
      }
    }
    clipped = output;
  }
  return polygonArea(clipped);
}

test('concave earthworks replace terrain exactly without overlap, gaps, or outside solid meshes', () => {
  const site = buildSite(fixture());
  assert.equal(site.earthworks.surfaces.length, 1);
  const surface = site.earthworks.surfaces[0];
  assert(surface.isMesh, 'Each surface patch must be a separate material mesh');
  assert.notEqual(surface.material, site.terrain.material);
  close(meshArea(surface), 100, 1e-3);
  close(meshArea(site.terrain), 300, 1e-3);
  close(meshArea(surface) + meshArea(site.terrain), 400, 1e-3);

  let terrainOverlap = 0;
  for (const triangle of triangles(site.terrain)) {
    for (const rectangle of patchRectangles) terrainOverlap += rectangleIntersectionArea(xz(triangle), rectangle);
  }
  close(terrainOverlap, 0, 1e-5);
  for (const triangle of triangles(surface)) {
    const containedArea = patchRectangles.reduce((sum, rectangle) => sum + rectangleIntersectionArea(xz(triangle), rectangle), 0);
    close(containedArea, polygonArea(xz(triangle)), 1e-5);
  }
  site.group.traverse(object => {
    if (!object.isMesh) return;
    for (const point of vertices(object)) assert(pointInPolygon([point.x, point.z], parcel), `Solid mesh escaped parcel at ${point.toArray()}`);
  });
  assert.equal(site.metadata.outsideSolidTerrain, false);
  assert.equal(site.metadata.neighborBuildings, false);
});

test('non-road patch edges retain a sharp height step and the original DEM remains queryable', () => {
  const site = buildSite(fixture());
  for (const [inside, outside] of [
    [[0, 0.001], [0, -0.001]],
    [[-5.999, 3], [-6.001, 3]],
    [[1.999, 7], [2.001, 7]],
  ]) {
    close(site.heightAt(...inside), -2.45);
    close(site.heightAt(...outside), baseHeight(...outside));
    assert(site.heightAt(...outside) - site.heightAt(...inside) > 2.5);
    close(site.baseHeightAt(...inside), baseHeight(...inside));
  }
  for (const point of vertices(site.terrain)) close(point.y, baseHeight(point.x, point.z));
});

test('only the selected road edge blends back to the measured surface within its requested width', () => {
  const site = buildSite(fixture());
  close(site.heightAt(-2, 9.29), -2.45);
  close(site.heightAt(-2, 9.3), -2.45);
  close(site.heightAt(-2, 10), baseHeight(-2, 10));
  const heights = [9.3, 9.475, 9.65, 9.825, 10].map(z => site.heightAt(-2, z));
  assert(heights.every((height, i) => i === 0 || height > heights[i - 1]), 'Road transition must rise continuously toward the original DEM');
  close(site.heightAt(-2, 10.001), baseHeight(-2, 10.001));
  close(site.heightAt(4, 8), baseHeight(4, 8)); // Concave notch remains untouched.
  for (const point of vertices(site.earthworks.surfaces[0])) close(point.y, site.heightAt(point.x, point.z), 2e-5);
});

test('a graded surface honors its plane origin and both fall directions', () => {
  const data = fixture();
  data.earthworks.surfacePatches[0].plane = { x0: 1, z0: 2, y0: -2.45, dx: 0.025, dz: -0.015 };
  data.earthworks.surfacePatches[0].blendEdges = [];
  const site = buildSite(data), expected = (x, z) => -2.45 + 0.025 * (x - 1) - 0.015 * (z - 2);
  for (const point of [[1, 2], [-4, 3], [4, 4], [0, 8]]) {
    close(site.heightAt(...point), expected(...point));
    close(site.baseHeightAt(...point), baseHeight(...point));
  }
  for (const point of vertices(site.earthworks.surfaces[0])) close(point.y, expected(point.x, point.z));
});

test('patch and terrain preserve the exact building hole when a patch crosses its footprint', () => {
  const footprint = [[-1, 1], [1, 1], [1, 3], [-1, 3]];
  const site = buildSite(fixture({ footprint }));
  close(meshArea(site.terrain), 300, 1e-3);
  close(meshArea(site.earthworks.surfaces[0]), 96, 1e-3);
  close(meshArea(site.terrain) + meshArea(site.earthworks.surfaces[0]), 396, 1e-3);
  let houseOverlap = 0;
  for (const mesh of [site.terrain, ...site.earthworks.surfaces]) {
    for (const triangle of triangles(mesh)) houseOverlap += rectangleIntersectionArea(xz(triangle), [-1, 1, 1, 3]);
  }
  close(houseOverlap, 0, 1e-5);
});

test('retaining walls use supplied top heights and all generated positions remain finite and inside the parcel', () => {
  const footprint = [[-1, 1], [1, 1], [1, 3], [-1, 3]];
  const data = fixture({ footprint, walls: true }), site = buildSite(data);
  assert.equal(site.earthworks.walls.length, 1);
  const wall = site.earthworks.walls[0];
  assert(wall.isGroup);
  const wallPoints = [];
  wall.traverse(object => { if (object.isMesh) wallPoints.push(...vertices(object)); });
  assert(wallPoints.length > 0, 'Retaining-wall group must contain geometry');
  for (const point of wallPoints) {
    assert(pointInPolygon([point.x, point.z], parcel), 'Wall escaped parcel');
    assert(!pointInPolygon([point.x, point.z], footprint), 'Wall entered building footprint');
  }
  const definition = data.earthworks.retainingWalls[0];
  for (let i = 0; i < definition.path.length; i++) {
    const [x, z] = definition.path[i];
    const nearAnchor = wallPoints.filter(point => Math.hypot(point.x - x, point.z - z) <= definition.width);
    assert(nearAnchor.length > 0, `No wall geometry at path anchor ${i}`);
    assert(nearAnchor.some(point => Math.abs(point.y - definition.topHeights[i]) < 1e-5), `Missing specified top height at path anchor ${i}`);
  }
  close(Math.max(...wallPoints.map(point => point.y)), Math.max(...definition.topHeights));
  site.group.traverse(object => {
    if (!object.geometry) return;
    for (const point of vertices(object)) assert(point.toArray().every(Number.isFinite), `Non-finite position in ${object.name}`);
  });
});

test('backfill replaces the original ground and joins the wall top to the DEM at the exact strip edges', () => {
  const data = fixture({ walls: true });
  const wall = data.earthworks.retainingWalls[0];
  wall.path = [[-6, 0], [6, 0]];
  wall.topHeights = [0.25, 0.75];
  wall.backfillWidth = 1;
  const site = buildSite(data);
  const backfill = site.earthworks.surfaces.find(surface => surface.userData.earthworkType === 'backfill');
  assert(backfill, 'Expected a separately clipped backfill surface');
  close(meshArea(backfill), 12, 1e-4);
  close(meshArea(site.terrain), 400 - 100 - 12 - 12 * wall.width, 1e-3);

  let originalTerrainInStrip = 0;
  for (const triangle of triangles(site.terrain)) {
    originalTerrainInStrip += rectangleIntersectionArea(xz(triangle), [-6, -1.22, 6, -0.22]);
  }
  close(originalTerrainInStrip, 0, 1e-5);
  const wallTop = x => 0.25 + (x + 6) / 12 * 0.5;
  for (const x of [-5, 0, 5]) {
    close(site.heightAt(x, -0.22), wallTop(x));
    close(site.heightAt(x, -1.22), baseHeight(x, -1.22));
    close(site.heightAt(x, -0.72), (wallTop(x) + baseHeight(x, -0.72)) / 2);
    close(site.heightAt(x, -1.221), baseHeight(x, -1.221));
    close(site.baseHeightAt(x, -0.72), baseHeight(x, -0.72));
  }
  for (const point of vertices(backfill)) {
    const weight = (-point.z - wall.width) / wall.backfillWidth;
    close(point.y, wallTop(point.x) * (1 - weight) + baseHeight(point.x, point.z) * weight);
  }
  for (const point of vertices(site.terrain)) close(point.y, baseHeight(point.x, point.z));
});

test('a bent retaining wall shares one continuous backfill cross-section across its mitered corner', () => {
  const data = fixture({ walls: true });
  const wall = data.earthworks.retainingWalls[0];
  wall.backfillWidth = 1;
  const site = buildSite(data), joint = wall.path[1];
  // For this 90-degree outward corner, both offsets meet at [6+d,-d].
  for (const blend of [0.1, 0.35, 0.5, 0.8, 1]) {
    const d = wall.width + blend, x = joint[0] + d, z = joint[1] - d;
    const expected = wall.topHeights[1] * (1 - blend) + baseHeight(x, z) * blend;
    close(site.heightAt(x, z), expected, 1e-8);
    const epsilon = 1e-6;
    close(site.heightAt(x - epsilon, z - epsilon), site.heightAt(x + epsilon, z + epsilon), 2e-6);
  }
  const backfills = site.earthworks.surfaces.filter(surface => surface.userData.earthworkType === 'backfill');
  assert.equal(backfills.length, 2);
  // The actual mesh heights on either copy of the shared edge agree as well.
  const shared = backfills.map(surface => vertices(surface).filter(p => Math.abs((p.x - joint[0]) + (p.z - joint[1])) < 1e-5));
  assert(shared.every(points => points.length >= 2));
  for (const points of shared) for (const p of points) {
    const blend = p.x - joint[0] - wall.width;
    close(p.y, wall.topHeights[1] * (1 - blend) + baseHeight(p.x, p.z) * blend, 2e-6);
  }
});
