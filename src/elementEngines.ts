import type * as THREE from 'three'
import {
  ELEMENT_SCHEMAS,
  type ElementSchema,
} from './constants/elementSchemas'
import { buildFinishModel } from './three/buildFinishModel'
import { buildEarthworkModel } from './three/buildEarthworkModel'
import { buildFootingModel } from './three/buildFootingModel'
import { buildPileModel } from './three/buildPileModel'
import { buildPileCapModel } from './three/buildPileCapModel'
import { buildRaftModel } from './three/buildRaftModel'
import { buildStoneModel } from './three/buildStoneModel'
import { buildStripModel } from './three/buildStripModel'
import { buildWallModel } from './three/buildWallModel'

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
  STONE_STRIP: engine('STONE_STRIP', buildStoneModel),
  WALLS: engine('WALLS', buildWallModel),
  FLOOR_FINISH: engine('FLOOR_FINISH', (instance) =>
    buildFinishModel('FLOOR', instance),
  ),
  WALL_FINISH: engine('WALL_FINISH', (instance) =>
    buildFinishModel('WALL', instance),
  ),
  CEILING_FINISH: engine('CEILING_FINISH', (instance) =>
    buildFinishModel('CEILING', instance),
  ),
}
