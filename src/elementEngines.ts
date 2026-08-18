import type * as THREE from 'three'
import {
  ELEMENT_SCHEMAS,
  type ElementSchema,
} from './constants/elementSchemas'
import { buildFinishModel } from './three/buildFinishModel'
import { buildEarthworkModel } from './three/buildEarthworkModel'
import { buildColumnModel } from './three/buildColumnModel'
import { buildBeamModel } from './three/buildBeamModel'
import { buildSlabModel } from './three/buildSlabModel'
import { buildStairModel } from './three/buildStairModel'
import { buildRampModel } from './three/buildRampModel'
import { buildFootingModel } from './three/buildFootingModel'
import { buildPileModel } from './three/buildPileModel'
import { buildPileCapModel } from './three/buildPileCapModel'
import { buildRaftModel } from './three/buildRaftModel'
import { buildStoneModel } from './three/buildStoneModel'
import { buildStripModel } from './three/buildStripModel'
import { buildWallModel } from './three/buildWallModel'
import {
  buildSkirtingModel,
  buildMasonryModel,
  buildDoorsWindowsModel,
  buildLintelModel,
} from './three/buildM2Models'
import {
  buildDuctModel,
  buildPipeModel,
  buildElectricalModel,
  buildDuctFittingModel,
} from './three/buildM3Models'

export type FrontendElementEngine = ElementSchema & {
  build3D: (instance: any) => THREE.Group
}

function engine(
  key: string,
  build3D: FrontendElementEngine['build3D'],
): FrontendElementEngine {
  return { ...ELEMENT_SCHEMAS[key], build3D }
}

/** Frontend registry used by schedule metadata and 3D dispatch. */
export const ELEMENT_ENGINES: Record<string, FrontendElementEngine> = {
  PAD_FOOTING: engine('PAD_FOOTING', buildFootingModel),
  STRIP_FOOTING: engine('STRIP_FOOTING', buildStripModel),
  RAFT: engine('RAFT', buildRaftModel),
  PILE_CAP: engine('PILE_CAP', buildPileCapModel),
  PILES: engine('PILES', buildPileModel),
  EARTHWORKS: engine('EARTHWORKS', buildEarthworkModel),
  COLUMNS: engine('COLUMNS', buildColumnModel),
  BEAMS: engine('BEAMS', buildBeamModel),
  SLABS: engine('SLABS', buildSlabModel),
  STAIRS: engine('STAIRS', buildStairModel),
  RAMPS: engine('RAMPS', buildRampModel),
  STONE_STRIP: engine('STONE_STRIP', buildStoneModel),
  WALLS: engine('WALLS', buildWallModel),
  MASONRY: engine('MASONRY', buildMasonryModel),
  DOORS_WINDOWS: engine('DOORS_WINDOWS', buildDoorsWindowsModel),
  LINTELS: engine('LINTELS', buildLintelModel),
  FLOOR_FINISH: engine('FLOOR_FINISH', (instance) =>
    buildFinishModel('FLOOR', instance),
  ),
  WALL_FINISH: engine('WALL_FINISH', (instance) =>
    buildFinishModel('WALL', instance),
  ),
  CEILING_FINISH: engine('CEILING_FINISH', (instance) =>
    buildFinishModel('CEILING', instance),
  ),
  SKIRTING: engine('SKIRTING', buildSkirtingModel),
  DUCTS: engine('DUCTS', buildDuctModel),
  DUCT_FITTINGS: engine('DUCT_FITTINGS', buildDuctFittingModel),
  PIPES: engine('PIPES', buildPipeModel),
  ELECTRICAL: engine('ELECTRICAL', buildElectricalModel),
}
