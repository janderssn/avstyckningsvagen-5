import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSite, outsideSegments, pointInPolygon } from '../src/site.js';

const parcel = [[-12, -13], [11, -13], [11, -7], [15, -7], [13, 15], [-12, 15]];
const footprint = [[-4.075, -5.325], [4.075, -5.325], [4.075, 5.325], [-4.075, 5.325]];
const fixture = () => ({ parcel, contextBounds: { min: [-20, -20], max: [20, 20] },
  heightGrid: { x0: -20, z0: -20, dx: 10, dz: 10, cols: 5, rows: 5,
    heights: Array.from({ length: 25 }, (_, i) => (-20 + (i % 5) * 10) * 0.05 + (-20 + Math.floor(i / 5) * 10) * 0.1) },
  terrainResolution: 2, gridSpacing: 2, contourResolution: 2, contourInterval: 0.5,
  metadata: { elevationSource: 'Synthetic sloped plane for geometry tests only' } });
const close = (a, b, tolerance = 1e-5) => assert(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test('filled triangle area covers exactly parcel minus house footprint', () => {
  const site = buildSite(fixture()), geometry = site.terrain.geometry;
  const position = geometry.attributes.position, index = geometry.index;
  let area = 0;
  for (let i = 0; i < index.count; i += 3) {
    const triangle = [0, 1, 2].map(j => { const n = index.getX(i + j); return [position.getX(n), position.getZ(n)]; });
    const center = [0, 1].map(k => triangle.reduce((sum, p) => sum + p[k], 0) / 3);
    assert(pointInPolygon(center, parcel), 'Triangle escaped parcel');
    assert(!pointInPolygon(center, footprint), 'Terrain filled house interior');
    const [a, b, c] = triangle;
    area += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
  }
  close(area, site.metadata.parcelAreaM2 - 8.15 * 10.65, 1e-3);
  assert.equal(site.metadata.neighborBuildings, false);
  assert.equal(site.metadata.outsideSolidTerrain, false);
});

test('outside grid and contours never cross parcel interiors', () => {
  const site = buildSite(fixture());
  for (const object of Object.values(site.surroundings)) {
    const positions = object.geometry.attributes.position;
    assert(positions.count > 0, 'Expected nonempty lines on sloped fixture');
    for (let i = 0; i < positions.count; i += 2) {
      for (const t of [0.01, 0.25, 0.5, 0.75, 0.99]) {
        const point = [(1 - t) * positions.getX(i) + t * positions.getX(i + 1), (1 - t) * positions.getZ(i) + t * positions.getZ(i + 1)];
        assert(!pointInPolygon(point, parcel), `Outside segment crossed parcel at ${point}`);
      }
    }
  }
});

test('bilinear heights and contour levels follow supplied plane with finite values', () => {
  const site = buildSite(fixture());
  close(site.heightAt(3, 7), 0.85);
  site.group.traverse(object => {
    if (object.geometry) assert(Array.from(object.geometry.attributes.position.array).every(Number.isFinite));
  });
  const p = site.surroundings.contours.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    close(p.getY(i) - 0.015, p.getX(i) * 0.05 + p.getZ(i) * 0.1);
    close((p.getY(i) - 0.015) / 0.5, Math.round((p.getY(i) - 0.015) / 0.5));
  }
});

test('parcel bounds exclude outside context and display modes remain independently controllable', () => {
  const site = buildSite(fixture());
  close(site.bounds.min.x, -12); close(site.bounds.max.x, 15);
  close(site.bounds.min.z, -13); close(site.bounds.max.z, 15);
  site.setOutsideStyle('contours'); assert.equal(site.surroundings.grid.visible, false); assert.equal(site.surroundings.contours.visible, true);
  site.setOutsideStyle('grid'); assert.equal(site.surroundings.grid.visible, true); assert.equal(site.surroundings.contours.visible, false);
  site.setOutsideStyle('none'); assert.equal(site.surroundings.grid.visible, false); assert.equal(site.surroundings.contours.visible, false);
});

test('contour datum follows absolute whole-metre heights after shifting model zero', () => {
  const site = buildSite({ ...fixture(), contourInterval: 1, contourOffset: -20.10 });
  const p = site.surroundings.contours.geometry.attributes.position;
  assert(p.count > 0);
  for (let i = 0; i < p.count; i++) {
    const localHeight = p.getY(i) - 0.015;
    close(localHeight + 20.10, Math.round(localHeight + 20.10));
    close(localHeight, p.getX(i) * 0.05 + p.getZ(i) * 0.1);
  }
  assert.throws(() => buildSite({ ...fixture(), contourOffset: NaN }), /offset must be finite/);
});

test('collinear boundary clipping keeps outside tails and removes the boundary overlap', () => {
  const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  assert.deepEqual(outsideSegments([-1, -3], [-1, 3], ring), [[[-1, -3], [-1, -1]], [[-1, 1], [-1, 3]]]);
});

test('unprovided or invalid measurements are rejected rather than replaced with default relief', () => {
  assert.throws(() => buildSite({ parcel }), /requires supplied elevations/);
  assert.throws(() => buildSite({ ...fixture(), elevations: [], heightGrid: { ...fixture().heightGrid, heights: [NaN] } }), /Invalid regular heightGrid/);
  assert.throws(() => buildSite({ ...fixture(), parcel: [[-2, -2], [2, -2], [2, 2], [-2, 2]] }), /footprint must lie fully inside/);
  const site = buildSite({ ...fixture(), heightGrid: undefined, elevations: [[-10, 2, -10], [10, 4, 10]] });
  close(site.heightAt(-10, -10), 2); close(site.heightAt(10, 10), 4); close(site.heightAt(0, 0), 3);
});
