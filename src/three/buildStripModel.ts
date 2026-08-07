/**
 * Strip footing 3D — ported from buildStripModel in AgileQS-Takeoff.html.
 * Signature unchanged: (instance) => THREE.Group
 */
import * as THREE from 'three';
import { COLORS3D } from './colors';
import { barCountForSpan } from './math';
import { makeBoxMesh, makeFrustumMesh, makeRebarBar } from './meshes';
import { modelViewOptions } from './viewOptions';

export type StripFootingInstance = {
  shape: 'FLAT' | 'TAPERED' | 'STEPPED' | string;
  length: number;
  width?: number;
  height?: number;
  baseWidth?: number;
  topWidth?: number;
  baseHeight?: number;
  upperWidth?: number;
  upperHeight?: number;
  cover: number;
  mainDia: number;
  mainSpacing: number;
  distDia: number;
  distSpacing: number;
};

function stripBaseWidth(f: StripFootingInstance): number {
  if (f.shape === 'FLAT') return f.width || 0;
  if (f.shape === 'TAPERED') return f.baseWidth || 0;
  return f.baseWidth || 0; // STEPPED
}

export function buildStripModel(f: StripFootingInstance): THREE.Group {
  const group = new THREE.Group();
  const L = f.length;

  if (f.shape === 'FLAT') {
    group.add(makeBoxMesh(L, f.height || 0, f.width || 0, 0, COLORS3D.concrete, 0.45));
  } else if (f.shape === 'TAPERED') {
    // width-only taper: reuse frustum builder with top length == bottom length
    group.add(
      makeFrustumMesh(
        L,
        f.baseWidth || 0,
        L,
        f.topWidth || 0,
        f.height || 0,
        0,
        COLORS3D.concrete,
        0.5,
      ),
    );
  } else {
    // STEPPED
    group.add(makeBoxMesh(L, f.baseHeight || 0, f.baseWidth || 0, 0, COLORS3D.concrete, 0.45));
    group.add(
      makeBoxMesh(
        L,
        f.upperHeight || 0,
        f.upperWidth || 0,
        f.baseHeight || 0,
        COLORS3D.concrete,
        0.5,
      ),
    );
  }

  if (modelViewOptions.showRebar) {
    const c = f.cover / 1000;
    const W = stripBaseWidth(f);
    const halfL = L / 2 - c;
    const halfW = W / 2 - c;
    const yBar = c;
    // Transverse bars across width, spaced along length (cap render count on long runs)
    const nTrans = barCountForSpan(L - 2 * c, f.mainSpacing);
    const stepT = Math.max(1, Math.ceil(nTrans / 60));
    for (let i = 0; i < nTrans; i += stepT) {
      const x = -halfL + (i * (2 * halfL)) / (nTrans - 1 || 1);
      const bar = makeRebarBar(x, yBar, -halfW, x, yBar, halfW, f.mainDia);
      if (bar) group.add(bar);
    }
    // Longitudinal bars along length, spaced across width
    const nLong = barCountForSpan(W - 2 * c, f.distSpacing);
    for (let i = 0; i < nLong; i++) {
      const z = -halfW + (i * (2 * halfW)) / (nLong - 1 || 1);
      const bar = makeRebarBar(-halfL, yBar + 0.02, z, halfL, yBar + 0.02, z, f.distDia);
      if (bar) group.add(bar);
    }
  }

  if (modelViewOptions.showDims) {
    const W = stripBaseWidth(f);
    const y = -0.05;
    const dimMat = new THREE.LineBasicMaterial({ color: 0xc9d3dc });
    const addLine = (a: THREE.Vector3, b: THREE.Vector3) => {
      const g = new THREE.BufferGeometry().setFromPoints([a, b]);
      group.add(new THREE.Line(g, dimMat));
    };
    addLine(new THREE.Vector3(-L / 2, y, W / 2 + 0.15), new THREE.Vector3(L / 2, y, W / 2 + 0.15));
    addLine(new THREE.Vector3(L / 2 + 0.15, y, -W / 2), new THREE.Vector3(L / 2 + 0.15, y, W / 2));
  }
  return group;
}
