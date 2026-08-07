/**
 * Stone strip 3D — ported from buildStoneModel in AgileQS-Takeoff.html.
 * Signature unchanged: (instance) => THREE.Group
 */
import * as THREE from 'three';
import { makeBoxMesh, makeFrustumMesh } from './meshes';
import { materials3D } from './viewOptions';

export type StoneStripInstance = {
  shape: 'RECTANGULAR' | 'TRAPEZOIDAL' | 'STEPPED' | string;
  length: number;
  width?: number;
  height?: number;
  baseWidth?: number;
  topWidth?: number;
  baseHeight?: number;
  upperWidth?: number;
  upperHeight?: number;
  hasBlinding?: boolean;
};

function stoneBaseWidth(f: StoneStripInstance): number {
  return f.shape === 'RECTANGULAR' ? f.width || 0 : f.baseWidth || 0;
}

export function buildStoneModel(f: StoneStripInstance): THREE.Group {
  const group = new THREE.Group();
  const L = f.length;
  if (f.shape === 'RECTANGULAR') {
    group.add(makeBoxMesh(L, f.height || 0, f.width || 0, 0, 0x6b7a63, 0.6));
  } else if (f.shape === 'TRAPEZOIDAL') {
    group.add(
      makeFrustumMesh(L, f.baseWidth || 0, L, f.topWidth || 0, f.height || 0, 0, 0x6b7a63, 0.6),
    );
  } else {
    group.add(makeBoxMesh(L, f.baseHeight || 0, f.baseWidth || 0, 0, 0x6b7a63, 0.6));
    group.add(
      makeBoxMesh(
        L,
        f.upperHeight || 0,
        f.upperWidth || 0,
        f.baseHeight || 0,
        0x6b7a63,
        0.65,
      ),
    );
  }
  if (f.hasBlinding) {
    const bt = materials3D.blindingThickness || 0.05;
    group.add(makeBoxMesh(L, bt, stoneBaseWidth(f) + 0.1, -bt, 0x3a4550, 0.5));
  }
  return group;
}
