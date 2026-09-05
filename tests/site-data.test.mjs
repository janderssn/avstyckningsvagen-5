import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSite, pointInPolygon } from '../src/site.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/data/site.json', import.meta.url)));
const source = JSON.parse(fs.readFileSync(new URL('../research/site/parcel.json', import.meta.url)));
const site = buildSite(data);
const nearBoundary = (point, ring) => ring.some((a, i) => {
  const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz) < 2e-6;
});
assert.ok(Math.abs(site.metadata.parcelAreaM2 - 578) < 0.1, 'Actual property is 578 m²');
if (data.metadata.heightSource === 'lantmateriet-dem') {
  const manifest = JSON.parse(fs.readFileSync(new URL('../research/site/lantmateriet/source.json', import.meta.url)));
  const raster = fs.readFileSync(new URL('../research/site/lantmateriet/dem.tif', import.meta.url));
  assert.equal(createHash('sha256').update(raster).digest('hex'), manifest.sha256);
  assert.equal(data.metadata.dem.crs, manifest.crs);
  assert.equal(data.metadata.dem.horizontalCrs, 'EPSG:3006');
  assert.equal(data.metadata.dem.nodataSamples, 0, 'No contributing nodata was filled');
  assert.equal(data.metadata.dem.outsideRasterSamples, 0, 'Entire local context is inside native pixel-center support');
  assert.equal(data.metadata.dem.sampleCount, data.heightGrid.cols * data.heightGrid.rows);
  assert.deepEqual(data.metadata.elevationAcquisition, manifest.acquisition);
  assert.equal(data.metadata.elevationLicense, manifest.license);
  assert.equal(data.metadata.georeferencing.groundFloorHeightRH2000, 20.10);
  assert.equal(data.metadata.georeferencing.groundFloorHeightStatus, 'estimated');
  const tie = data.metadata.georeferencing.registrationTiePoint;
  assert.deepEqual(tie.localXZ, [2.7, 5.6]);
  assert.ok(Math.abs(tie.sourceHeightRH2000 + 2.45 - 20.10) < 0.005, 'FFL estimate follows documented DEM driveway tie point');
  assert.ok(data.metadata.sources.every(source => !source.url.includes('api.lantmateriet.se') && !source.url.includes('dl1.lantmateriet.se')), 'Public source cards must avoid authenticated assets');
} else {
  assert.equal(data.metadata.outsideSourceHullCells, 0, 'Whole context is supported by surrounding map observations');
  assert.equal(data.metadata.heightSourceContourCount, 72);
  assert.equal(data.metadata.heightSourceSpotCount, 9);
  assert.equal(data.metadata.georeferencing.groundFloorHeightRH2000, 20.55);
  assert.ok(Math.abs(site.baseHeightAt(2.7, 5.6) + 2.45) < 0.06, 'Archived contour datum and driveway interpolation stay reproducible');
}
assert.ok(site.baseHeightAt(0, -5.6) > site.baseHeightAt(0, 5.6) + 1, 'Map terrain rises toward the garden');
const original = buildSite({ ...data, earthworks: undefined });
for (const [x, z] of [[2.7, 5.6], [0, -5.6], [-4.3, 0], [9.2, 5.55]]) {
  assert.equal(site.baseHeightAt(x, z), original.heightAt(x, z), 'Interpreted excavation leaves source DEM interpolation unchanged');
}
if (data.earthworks) {
  assert.ok(site.heightAt(2.7, 5.45) < -2.49, 'Garage apron stays below the garage threshold');
  assert.equal(site.earthworks.walls.length, 2, 'Both documented driveway retaining walls are present');
  assert.ok(site.earthworks.walls[1].children.some(mesh => mesh.userData.earthworkType === 'wallBoard'), 'Right retaining wall has white boards');
}

const geo = data.metadata.georeferencing;
for (let i = 0; i < data.parcel.length; i++) {
  const [x, z] = data.parcel[i], [e, n] = source.geometry.coordinates[0][i];
  assert.ok(Math.abs(geo.originEN[0] + x * geo.localXUnitEN[0] + z * geo.localZUnitEN[0] - e) < 0.001);
  assert.ok(Math.abs(geo.originEN[1] + x * geo.localXUnitEN[1] + z * geo.localZUnitEN[1] - n) < 0.001);
}

let projectedArea = 0;
for (const object of [site.terrain, ...site.earthworks.groundSurfaces]) {
const geometry = object.geometry, position = geometry.attributes.position, indices = geometry.index;
for (let i = 0; i < (indices?.count ?? position.count); i += 3) {
  const p = [0, 1, 2].map(offset => {
    const index = indices ? indices.getX(i + offset) : i + offset;
    return [position.getX(index), position.getZ(index)];
  });
  const center = [0, 1].map(axis => p.reduce((sum, point) => sum + point[axis], 0) / 3);
  const area = Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0])) / 2;
  if (area < 1e-10) continue; // Float32 can collapse sub-micrometre boundary slivers.
  assert.ok(pointInPolygon(center, data.parcel) || nearBoundary(center, data.parcel), 'No filled triangle outside real parcel beyond Float32 rounding');
  assert.ok(!pointInPolygon(center, data.footprint), 'House footprint stays open');
  projectedArea += area;
}
}
assert.ok(Math.abs(projectedArea - (site.metadata.parcelAreaM2 - 8.15 * 10.65)) < 0.001, 'All of the real parcel outside house is filled exactly once');
console.log(`${data.metadata.heightSource || 'municipal-contours'}: source provenance, supported elevations, estimated datum, parcel registration, exact terrain coverage and house hole pass.`);
