/**
 * Wall 3D — ported from buildWallModel in AgileQS-Takeoff.html.
 * Signature unchanged: (instance) => THREE.Group
 */
import * as THREE from 'three';
import { COLORS3D } from './colors';
import { barCountForSpan } from './math';
import { addHeightDim, addLengthDim } from './dimensions';
import { makeBoxMesh, makeRebarBar } from './meshes';
import { modelViewOptions } from './viewOptions';

export type MeshBarGroup = {
  diameterMm: number;
  spacingMm: number;
};

export type WallInstance = {
  shape: 'LINEAR' | 'CURVED' | string;
  length?: number;
  radius?: number;
  arcAngleDeg?: number;
  thickness: number;
  height: number;
  cover: number;
  vertBars?: MeshBarGroup[];
  horizBars?: MeshBarGroup[];
  vertDia?: number;
  vertSpacing?: number;
  horizDia?: number;
  horizSpacing?: number;
  bothFaces?: boolean;
};

function resolveGroups(
  groups: MeshBarGroup[] | undefined,
  legacyDia: number | undefined,
  legacySpc: number | undefined,
  fallbackDia: number,
  fallbackSpc: number,
): MeshBarGroup[] {
  if (Array.isArray(groups) && groups.length > 0) {
    return groups.filter((g) => g.diameterMm > 0 && g.spacingMm > 0);
  }
  const dia = legacyDia || fallbackDia;
  const spc = legacySpc || fallbackSpc;
  return [{ diameterMm: dia, spacingMm: spc }];
}

export function buildWallModel(f: WallInstance): THREE.Group {
  const group = new THREE.Group();
  const T = f.thickness;
  const H = f.height;
  const vertGroups = resolveGroups(f.vertBars, f.vertDia, f.vertSpacing, 12, 200);
  const horizGroups = resolveGroups(
    f.horizBars,
    f.horizDia,
    f.horizSpacing,
    12,
    250,
  );

  if (f.shape === 'LINEAR') {
    const L = f.length || 0;
    group.add(makeBoxMesh(L, H, T, 0, COLORS3D.concrete, 0.45));
    if (modelViewOptions.showRebar) {
      const c = f.cover / 1000;
      const halfL = L / 2 - c;
      for (const g of vertGroups) {
        const nVert = barCountForSpan(L - 2 * c, g.spacingMm);
        const stepV = Math.max(1, Math.ceil(nVert / 50));
        for (let i = 0; i < nVert; i += stepV) {
          const x = -halfL + (i * (2 * halfL)) / (nVert - 1 || 1);
          const bar = makeRebarBar(x, c, 0, x, H - c, 0, g.diameterMm);
          if (bar) group.add(bar);
        }
      }
      for (const g of horizGroups) {
        const nHoriz = barCountForSpan(H - 2 * c, g.spacingMm);
        const stepH = Math.max(1, Math.ceil(nHoriz / 40));
        for (let i = 0; i < nHoriz; i += stepH) {
          const y = c + (i * (H - 2 * c)) / (nHoriz - 1 || 1);
          const bar = makeRebarBar(-halfL, y, 0, halfL, y, 0, g.diameterMm);
          if (bar) group.add(bar);
        }
      }
    }
    addLengthDim(group, L, T / 2, { offset: 0.2 });
    addHeightDim(group, H, { x: L / 2, z: T / 2 });
  } else {
    // CURVED — build from short box segments following the arc
    const R = f.radius || 0;
    const arc = ((f.arcAngleDeg || 0) * Math.PI) / 180;
    const segs = Math.max(6, Math.ceil((f.arcAngleDeg || 0) / 7.5));
    for (let i = 0; i < segs; i++) {
      const a0 = -arc / 2 + (i * arc) / segs;
      const a1 = -arc / 2 + ((i + 1) * arc) / segs;
      const am = (a0 + a1) / 2;
      const segLen = R * (arc / segs) * 1.02; // slight overlap to avoid gaps
      const seg = makeBoxMesh(segLen, H, T, 0, COLORS3D.concrete, 0.5);
      seg.position.x = R * Math.cos(am);
      seg.position.z = R * Math.sin(am);
      seg.rotation.y = -am + Math.PI / 2;
      group.add(seg);
    }
    if (modelViewOptions.showRebar) {
      const c = f.cover / 1000;
      for (const g of vertGroups) {
        const nVert = Math.max(2, Math.ceil((R * arc) / (g.spacingMm / 1000)));
        const stepV = Math.max(1, Math.ceil(nVert / 50));
        for (let i = 0; i < nVert; i += stepV) {
          const a = -arc / 2 + (i * arc) / (nVert - 1 || 1);
          const x = R * Math.cos(a);
          const z = R * Math.sin(a);
          const bar = makeRebarBar(x, c, z, x, H - c, z, g.diameterMm);
          if (bar) group.add(bar);
        }
      }
    }
    addHeightDim(group, H, { x: R, z: 0 });
  }
  return group;
}
