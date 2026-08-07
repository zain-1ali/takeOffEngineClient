/**
 * Finish area 3D — ported from makeFinishEngine.build3D in AgileQS-Takeoff.html.
 * Signature: (kind, instance) => THREE.Group  (kind replaces the closure).
 */
import * as THREE from 'three';
import { makeBoxMesh } from './meshes';

export type FinishKind = 'FLOOR' | 'WALL' | 'CEILING';

export type FinishInstance = {
  roomLength?: number;
  roomWidth?: number;
  wallLength?: number;
  wallHeight?: number;
};

export function buildFinishModel(kind: FinishKind, f: FinishInstance): THREE.Group {
  const group = new THREE.Group();
  if (kind === 'WALL') {
    group.add(makeBoxMesh(f.wallLength || 0, f.wallHeight || 0, 0.03, 0, 0x4a7a8c, 0.5));
  } else {
    const L = f.roomLength || 0;
    const W = f.roomWidth || 0;
    group.add(makeBoxMesh(L, 0.03, W, 0, 0x4a7a8c, 0.55));
  }
  return group;
}
