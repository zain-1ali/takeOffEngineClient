/**
 * Pad footing 3D — ported from buildFootingModel in AgileQS-Takeoff.html.
 * Signature unchanged: (instance) => THREE.Group
 */
import * as THREE from 'three';
import { COLORS3D } from './colors';
import { barCountForSpan } from './math';
import { makeBoxMesh, makeFrustumMesh, makeRebarBar } from './meshes';
import { modelViewOptions } from './viewOptions';

export type PadFootingInstance = {
  shape: 'RECTANGULAR' | 'STEPPED' | 'SLOPED_PYRAMIDAL' | string;
  length: number;
  width: number;
  baseThickness: number;
  stepLength?: number;
  stepWidth?: number;
  stepHeight?: number;
  slopePeakLength?: number;
  slopePeakWidth?: number;
  slopeHeight?: number;
  cover: number;
  bottomMainDia: number;
  bottomMainSpacing: number;
  bottomDistDia: number;
  bottomDistSpacing: number;
  startersEnabled?: boolean;
  starterCount?: number;
  starterDia?: number;
  starterProjection?: number;
};

function padTotalHeight(f: PadFootingInstance): number {
  if (f.shape === 'RECTANGULAR') return f.baseThickness;
  if (f.shape === 'STEPPED') return f.baseThickness + (f.stepHeight || 0);
  return f.baseThickness + (f.slopeHeight || 0);
}

export function buildFootingModel(f: PadFootingInstance): THREE.Group {
  const group = new THREE.Group();
  const L = f.length;
  const W = f.width;

  // Concrete
  if (f.shape === 'RECTANGULAR') {
    group.add(makeBoxMesh(L, f.baseThickness, W, 0, COLORS3D.concrete, 0.45));
  } else if (f.shape === 'STEPPED') {
    group.add(makeBoxMesh(L, f.baseThickness, W, 0, COLORS3D.concrete, 0.45));
    group.add(
      makeBoxMesh(
        f.stepLength || 0,
        f.stepHeight || 0,
        f.stepWidth || 0,
        f.baseThickness,
        COLORS3D.concrete,
        0.5,
      ),
    );
  } else {
    if (f.baseThickness > 0) group.add(makeBoxMesh(L, f.baseThickness, W, 0, COLORS3D.concrete, 0.45));
    group.add(
      makeFrustumMesh(
        L,
        W,
        f.slopePeakLength || 0,
        f.slopePeakWidth || 0,
        f.slopeHeight || 0,
        f.baseThickness,
        COLORS3D.concrete,
        0.5,
      ),
    );
  }

  // Rebar (bottom mesh + starters)
  if (modelViewOptions.showRebar) {
    const c = f.cover / 1000;
    const yBar = c;
    const halfL = L / 2 - c;
    const halfW = W / 2 - c;
    // main bars run along L, spaced across W
    const nMain = barCountForSpan(W - 2 * c, f.bottomMainSpacing);
    for (let i = 0; i < nMain; i++) {
      const z = -halfW + (i * (2 * halfW)) / (nMain - 1 || 1);
      const bar = makeRebarBar(-halfL, yBar, z, halfL, yBar, z, f.bottomMainDia);
      if (bar) group.add(bar);
    }
    // dist bars run along W, spaced across L
    const nDist = barCountForSpan(L - 2 * c, f.bottomDistSpacing);
    for (let i = 0; i < nDist; i++) {
      const x = -halfL + (i * (2 * halfL)) / (nDist - 1 || 1);
      const bar = makeRebarBar(x, yBar + 0.02, -halfW, x, yBar + 0.02, halfW, f.bottomDistDia);
      if (bar) group.add(bar);
    }
    // starter bars (vertical, at corners of a small cage)
    if (f.startersEnabled) {
      const totalH = padTotalHeight(f);
      const off = Math.min(0.15, L / 4);
      const corners: [number, number][] = [
        [-off, -off],
        [off, -off],
        [off, off],
        [-off, off],
      ];
      for (let i = 0; i < Math.min(f.starterCount || 0, 4); i++) {
        const [dx, dz] = corners[i % 4];
        const bar = makeRebarBar(
          dx,
          totalH - 0.05,
          dz,
          dx,
          totalH + (f.starterProjection || 0),
          dz,
          f.starterDia || 0,
        );
        if (bar) group.add(bar);
      }
    }
  }

  // Dimension annotations (simple lines) along base
  if (modelViewOptions.showDims) {
    const y = -0.05;
    const dimMat = new THREE.LineBasicMaterial({ color: 0xc9d3dc });
    const addLine = (a: THREE.Vector3, b: THREE.Vector3) => {
      const g = new THREE.BufferGeometry().setFromPoints([a, b]);
      group.add(new THREE.Line(g, dimMat));
    };
    addLine(new THREE.Vector3(-L / 2, y, W / 2 + 0.15), new THREE.Vector3(L / 2, y, W / 2 + 0.15)); // L
    addLine(new THREE.Vector3(L / 2 + 0.15, y, -W / 2), new THREE.Vector3(L / 2 + 0.15, y, W / 2)); // W
  }

  return group;
}
