import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sectionMesh } from '../src/section.js';
import { buildHouse } from '../src/house.js';

const plane = (normal, coordinate) => new THREE.Plane(new THREE.Vector3(...normal), -coordinate);
const mesh = geometry => new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());

function inspect(result, cut) {
  assert(result.positions instanceof Float32Array);
  assert.equal(result.positions.length % 9, 0);
  let area = 0;
  const vertices = [];
  for (let i = 0; i < result.positions.length; i += 3) {
    const p = new THREE.Vector3().fromArray(result.positions, i);
    assert(p.toArray().every(Number.isFinite));
    assert(Math.abs(cut.distanceToPoint(p)) < 2e-5, 'Cap escaped its section plane');
    vertices.push(p);
  }
  for (let i = 0; i < vertices.length; i += 3) {
    area += new THREE.Triangle(...vertices.slice(i, i + 3)).getArea();
  }
  return { area, vertices };
}

function close(actual, expected, tolerance = 2e-4) {
  assert(Math.abs(actual - expected) < tolerance, `Expected ${expected}, got ${actual}`);
}

function contains(vertices, point) {
  const p = new THREE.Vector3(...point);
  for (let i = 0; i < vertices.length; i += 3) {
    if (new THREE.Triangle(...vertices.slice(i, i + 3)).containsPoint(p)) return true;
  }
  return false;
}

function section(object, cut) {
  object.updateWorldMatrix(true, false);
  const result = sectionMesh(object, cut);
  return { ...inspect(result, cut), result };
}

test('box caps have analytical areas on each axis and both retained sides', () => {
  const object = mesh(new THREE.BoxGeometry(2, 3, 4));
  for (const [axis, area] of [[0, 12], [1, 8], [2, 6]]) {
    for (const sign of [-1, 1]) {
      const normal = [0, 0, 0]; normal[axis] = sign;
      close(section(object, plane(normal, 0)).area, area);
    }
  }
});

test('oblique and transformed solids produce world-space caps', () => {
  const object = mesh(new THREE.BoxGeometry(2, 2, 2));
  const cut = new THREE.Plane(new THREE.Vector3(1, 1, 0).normalize(), 0);
  close(section(object, cut).area, 4 * Math.SQRT2);
  object.rotation.z = Math.PI / 3;
  object.scale.set(2, 3, 1);
  object.position.set(5, 7, -2);
  close(section(object, plane([0, 0, 1], -2)).area, 24);
});

function holedSlab() {
  const shape = new THREE.Shape();
  shape.moveTo(-4, -5); shape.lineTo(4, -5); shape.lineTo(4, 5); shape.lineTo(-4, 5); shape.closePath();
  const hole = new THREE.Path();
  for (const [i, p] of [[-3, -2], [-3, 1], [2, 1], [2, 0], [-1, 0], [-1, -2]].entries()) {
    if (i === 0) hole.moveTo(...p); else hole.lineTo(...p);
  }
  hole.closePath(); shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  return mesh(geometry);
}

test('horizontal cap preserves a concave L-shaped stair opening', () => {
  const { area, vertices } = section(holedSlab(), plane([0, 1, 0], -1));
  close(area, 80 - 9);
  assert(!contains(vertices, [-2, -1, -1]));
  assert(!contains(vertices, [1, -1, 0.5]));
  assert(contains(vertices, [3, -1, 3]));
});

test('vertical cut through stair hole creates separate solid regions', () => {
  const { area, vertices } = section(holedSlab(), plane([1, 0, 0], 0));
  close(area, (10 - 1) * 2);
  assert(!contains(vertices, [0, -1, 0.5]));
  assert(contains(vertices, [0, -1, 2]));
});

test('round fittings cap their actual polygonal cylinder profile', () => {
  const n = 64, radius = 2;
  const object = mesh(new THREE.CylinderGeometry(radius, radius, 3, n));
  close(section(object, plane([0, 1, 0], 0)).area, n / 2 * radius ** 2 * Math.sin(2 * Math.PI / n));
});

test('disconnected bodies do not acquire a bridge across the gap', () => {
  const a = new THREE.BoxGeometry(2, 2, 2).translate(-3, 0, 0);
  const b = new THREE.BoxGeometry(2, 2, 2).translate(3, 0, 0);
  const { area, vertices } = section(mesh(mergeGeometries([a, b])), plane([0, 1, 0], 0));
  close(area, 8);
  assert(!contains(vertices, [0, 0, 0]));
});

test('a solid island inside a hole remains solid without closing the hole', () => {
  const slab = holedSlab().geometry;
  const island = new THREE.BoxGeometry(0.5, 2, 0.5).toNonIndexed().translate(-2, -1, -1);
  const { area, vertices } = section(mesh(mergeGeometries([slab, island])), plane([0, 1, 0], -1));
  close(area, 71.25);
  assert(contains(vertices, [-2, -1, -1]));
  assert(!contains(vertices, [-2.6, -1, -1]));
});

test('open surfaces and a plane outside the solid do not invent caps', () => {
  const open = section(mesh(new THREE.PlaneGeometry(2, 2)), plane([1, 0, 0], 0));
  close(open.area, 0);
  assert(open.result.diagnostics.openChains > 0);
  close(section(mesh(new THREE.BoxGeometry(2, 2, 2)), plane([1, 0, 0], 2)).area, 0);
});

test('a tangent face has no new cap, but a true near-boundary cut does', () => {
  const object = mesh(new THREE.BoxGeometry(2, 2, 2));
  close(section(object, plane([1, 0, 0], 1)).area, 0);
  close(section(object, plane([-1, 0, 0], -1)).area, 0);
  close(section(object, plane([1, 0, 0], 0.999)).area, 4);
});

test('the actual ground floor slab retains both arms of its stairwell', () => {
  const house = buildHouse();
  const floor = house.floors.find(f => f.id === 'ground');
  const slab = floor.group.children.find(o => o.isMesh && o.geometry.type === 'ExtrudeGeometry');
  assert(slab);
  const { area, vertices } = section(slab, plane([0, 1, 0], -0.125));
  close(area, 8.15 * 10.65 - (0.96 * 0.85 + 2.75 * 1.02));
  assert(!contains(vertices, [-3.32, -0.125, 0.65]));
  assert(!contains(vertices, [-2, -0.125, 1.61]));
  assert(contains(vertices, [2, -0.125, 2]));
});

test('the actual gable cap retains two window apertures', () => {
  const house = buildHouse();
  const gable = house.group.getObjectByName('Överplan · motsatt gavel');
  assert(gable);
  const { area, vertices } = section(gable, plane([1, 0, 0], 3.90));
  close(area, 10.65 * 5 / 2 - 2 * 1.25 * 1.3);
  assert(!contains(vertices, [3.90, 4.1, -1.21]));
  assert(!contains(vertices, [3.90, 4.1, 1.10]));
  assert(contains(vertices, [3.90, 6.4, 0]));
});

test('the actual upper partition cap retains both full-height doorways', () => {
  const house = buildHouse();
  const partition = house.group.getObjectByName('Övre rum mot hall');
  assert(partition);
  const { area, vertices } = section(partition, plane([0, 0, 1], -0.23));
  close(area, 7.55 * 2.40 - 2 * 0.80 * (2.05 - 0.001));
  assert(!contains(vertices, [-0.645, 3.65, -0.23]));
  assert(!contains(vertices, [0.415, 3.65, -0.23]));
  assert(contains(vertices, [2, 3.65, -0.23]));
});
