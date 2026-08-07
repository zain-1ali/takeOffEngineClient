/**
 * Mesh builders — ported unchanged from AgileQS-Takeoff.html
 * (makeBoxMesh, makeFrustumMesh, makeRebarBar).
 */
import * as THREE from 'three';
import { COLORS3D } from './colors';

export function makeBoxMesh(
  L: number,
  H: number,
  W: number,
  yBase: number,
  color: number,
  opacity: number,
): THREE.Group {
  const geo = new THREE.BoxGeometry(L, H, W);
  const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = yBase + H / 2;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: COLORS3D.wire }),
  );
  edges.position.copy(mesh.position);
  const g = new THREE.Group();
  g.add(mesh);
  g.add(edges);
  return g;
}

export function makeFrustumMesh(
  L: number,
  W: number,
  Lp: number,
  Wp: number,
  H: number,
  yBase: number,
  color: number,
  opacity: number,
): THREE.Group {
  // Build a frustum via BufferGeometry (8 vertices: bottom LxW, top LpxWp)
  const hl = L / 2;
  const hw = W / 2;
  const hlp = Lp / 2;
  const hwp = Wp / 2;
  const y0 = yBase;
  const y1 = yBase + H;
  const verts = [
    -hl, y0, -hw, hl, y0, -hw, hl, y0, hw, -hl, y0, hw, // bottom 0-3
    -hlp, y1, -hwp, hlp, y1, -hwp, hlp, y1, hwp, -hlp, y1, hwp, // top 4-7
  ];
  const faces = [
    0, 1, 2, 0, 2, 3, // bottom
    4, 6, 5, 4, 7, 6, // top
    0, 4, 5, 0, 5, 1, // side -w
    1, 5, 6, 1, 6, 2, // side +l
    2, 6, 7, 2, 7, 3, // side +w
    3, 7, 4, 3, 4, 0, // side -l
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(faces);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: COLORS3D.wire }),
  );
  const g = new THREE.Group();
  g.add(mesh);
  g.add(edges);
  return g;
}

/** Extrude a convex X/Z plan polygon vertically. */
export function makePrismMesh(
  points: [number, number][],
  height: number,
  yBase: number,
  color: number,
  opacity: number,
): THREE.Group {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => {
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, yBase, 0);
  const mat = new THREE.MeshLambertMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: COLORS3D.wire }),
  );
  const group = new THREE.Group();
  group.add(mesh);
  group.add(edges);
  return group;
}

export function makeRebarBar(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  dia: number,
): THREE.Mesh | null {
  const start = new THREE.Vector3(x1, y1, z1);
  const end = new THREE.Vector3(x2, y2, z2);
  const dirV = new THREE.Vector3().subVectors(end, start);
  const len = dirV.length();
  if (len < 1e-6) return null;
  const radius = Math.max(0.008, ((dia / 1000) / 2) * 3); // exaggerate slightly for visibility
  const geo = new THREE.CylinderGeometry(radius, radius, len, 8);
  const mat = new THREE.MeshLambertMaterial({ color: COLORS3D.rebar });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirV.clone().normalize());
  return mesh;
}
