/**
 * Per-element schedule field definitions — ported from AgileQS-Takeoff.html
 * (PAD_FIELDS, STRIP_FIELDS, WALL_FIELDS, STONE_FIELDS, finishFieldsFor).
 */

export const BAR_SIZES = [8, 10, 12, 16, 20, 25, 32, 40]

export type FieldDef = {
  key: string
  label: string
  type?: 'text' | 'int' | 'number' | 'select'
  min?: number
  max?: number
  step?: number
  dec?: number
  def: string | number
  options?: number[] | string[]
  /** When true, omitted from create payload; empty schedule input clears the key. */
  optional?: boolean
  /** Display/store as percent (UI shows 0–100, geometry stores 0–1 fraction). */
  uiPercent?: boolean
}

export type OutputCol = {
  key: string
  label: string
  unit: string
  dec: number
  rebar?: boolean
  /** Path into calculate result, e.g. totalVolumeM3 */
  resultKey: string
}

export type ElementSchema = {
  label: string
  markPrefix: string
  reportKind: 'structural' | 'masonry' | 'finish' | 'earthworks'
  hasGrade: boolean
  hasRebar: boolean
  shapes: Record<string, { label: string }>
  addButtons: { shape: string; label: string; primary?: boolean }[]
  geometryByShape: Record<string, FieldDef[]>
  /** Schedule-visible rebar fields (subset); full defaults applied on create */
  rebarFields: FieldDef[]
  /** Extra reinforcement defaults not shown in schedule columns */
  rebarDefaults?: Record<string, unknown>
  specList?: string[]
  /**
   * UniFormat location options (Walls / Slabs / Doors / Wall finishes).
   * When set, schedule shows a Location column.
   */
  locationOptions?: string[]
  /** Default location when creating on a non-special floor. */
  defaultLocation?: string
  outputCols: OutputCol[]
}

const STRUCTURAL_OUTPUT: OutputCol[] = [
  { key: 'vol', label: 'Vol (m³)', unit: 'm³', dec: 2, resultKey: 'totalVolumeM3' },
  { key: 'fmwk', label: 'Fmwk (m²)', unit: 'm²', dec: 2, resultKey: 'totalFormworkM2' },
  { key: 'steel', label: 'Steel (kg)', unit: 'kg', dec: 1, rebar: true, resultKey: 'totalRebarKg' },
]

export const FINISH_SPECS = {
  FLOOR: [
    'Cement screed + ceramic tiles',
    'Cement screed + porcelain tiles',
    'Granolithic screed',
    'Terrazzo',
    'Vinyl on screed',
  ],
  WALL: [
    'Cement/sand plaster + emulsion paint',
    'Gypsum plaster + emulsion',
    'Ceramic wall tiles',
    'Fair-face (paint only)',
  ],
  CEILING: [
    'Plaster + emulsion paint',
    'Suspended grid (mineral tile)',
    'Gypsum board + skim + paint',
    'PVC panel',
  ],
}

export const ELEMENT_SCHEMAS: Record<string, ElementSchema> = {
  PAD_FOOTING: {
    label: 'Pad Foundation',
    markPrefix: 'F',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    shapes: {
      RECTANGULAR: { label: 'Rectangular' },
      STEPPED: { label: 'Stepped' },
      SLOPED_PYRAMIDAL: { label: 'Sloped Pyramidal' },
    },
    addButtons: [
      { shape: 'RECTANGULAR', label: '+ Rectangular', primary: true },
      { shape: 'STEPPED', label: '+ Stepped' },
      { shape: 'SLOPED_PYRAMIDAL', label: '+ Sloped' },
    ],
    geometryByShape: {
      RECTANGULAR: [
        { key: 'length', label: 'L (m)', min: 0.3, max: 6, step: 0.05, dec: 2, def: 2.0 },
        { key: 'width', label: 'W (m)', min: 0.3, max: 6, step: 0.05, dec: 2, def: 2.0 },
        { key: 'baseThickness', label: 'Z1 (m)', min: 0.15, max: 2, step: 0.05, dec: 2, def: 0.6 },
      ],
      STEPPED: [
        { key: 'length', label: 'L (m)', min: 0.3, max: 6, step: 0.05, dec: 2, def: 2.4 },
        { key: 'width', label: 'W (m)', min: 0.3, max: 6, step: 0.05, dec: 2, def: 2.4 },
        { key: 'baseThickness', label: 'Z1 (m)', min: 0.15, max: 2, step: 0.05, dec: 2, def: 0.4 },
        { key: 'stepLength', label: 'Ls (m)', min: 0.2, max: 6, step: 0.05, dec: 2, def: 1.2 },
        { key: 'stepWidth', label: 'Ws (m)', min: 0.2, max: 6, step: 0.05, dec: 2, def: 1.2 },
        { key: 'stepHeight', label: 'Z2 (m)', min: 0.15, max: 2, step: 0.05, dec: 2, def: 0.5 },
      ],
      SLOPED_PYRAMIDAL: [
        { key: 'length', label: 'L (m)', min: 0.3, max: 6, step: 0.05, dec: 2, def: 3.0 },
        { key: 'width', label: 'W (m)', min: 0.3, max: 6, step: 0.05, dec: 2, def: 3.0 },
        { key: 'baseThickness', label: 'Z1 (m)', min: 0, max: 2, step: 0.05, dec: 2, def: 0.3 },
        { key: 'slopePeakLength', label: 'Lp (m)', min: 0.2, max: 6, step: 0.05, dec: 2, def: 1.0 },
        { key: 'slopePeakWidth', label: 'Wp (m)', min: 0.2, max: 6, step: 0.05, dec: 2, def: 1.0 },
        { key: 'slopeHeight', label: 'Z2 (m)', min: 0.15, max: 2, step: 0.05, dec: 2, def: 0.7 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 25, max: 100, step: 5, dec: 0, def: 50 },
      { key: 'bottomMainDia', label: 'Bot dia', type: 'select', options: BAR_SIZES, def: 16 },
      { key: 'bottomMainSpacing', label: 'Bot spc', min: 75, max: 300, step: 25, dec: 0, def: 150 },
    ],
    rebarDefaults: {
      topMeshEnabled: false,
      startersEnabled: true,
      starterDia: 20,
      starterCount: 4,
      starterProjection: 0.75,
      starterEmbedment: 0.4,
    },
    outputCols: STRUCTURAL_OUTPUT,
  },

  RAFT: {
    label: 'Raft Foundation',
    markPrefix: 'RF',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    shapes: {
      MONOLITHIC: { label: 'Monolithic' },
      THICKENED_EDGE: { label: 'Thickened-edge' },
    },
    addButtons: [
      { shape: 'MONOLITHIC', label: '+ Monolithic', primary: true },
      { shape: 'THICKENED_EDGE', label: '+ Thickened-edge' },
    ],
    geometryByShape: {
      MONOLITHIC: [
        { key: 'length', label: 'L (m)', min: 1, max: 100, step: 0.5, dec: 2, def: 12 },
        { key: 'width', label: 'W (m)', min: 1, max: 100, step: 0.5, dec: 2, def: 8 },
        { key: 'thickness', label: 'T (m)', min: 0.15, max: 2, step: 0.05, dec: 2, def: 0.4 },
      ],
      THICKENED_EDGE: [
        { key: 'length', label: 'L (m)', min: 1, max: 100, step: 0.5, dec: 2, def: 12 },
        { key: 'width', label: 'W (m)', min: 1, max: 100, step: 0.5, dec: 2, def: 8 },
        { key: 'thickness', label: 'T (m)', min: 0.15, max: 2, step: 0.05, dec: 2, def: 0.3 },
        { key: 'edgeWidth', label: 'Edge W (m)', min: 0.1, max: 3, step: 0.05, dec: 2, def: 0.6 },
        { key: 'edgeExtraDepth', label: 'Extra D (m)', min: 0.05, max: 2, step: 0.05, dec: 2, def: 0.3 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 25, max: 100, step: 5, dec: 0, def: 50 },
      { key: 'bottomMainDia', label: 'Mesh dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'bottomMainSpacing', label: 'Mesh spc', min: 75, max: 300, step: 25, dec: 0, def: 200 },
    ],
    outputCols: STRUCTURAL_OUTPUT,
  },

  PILE_CAP: {
    label: 'Pile Cap',
    markPrefix: 'PC',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    shapes: {
      RECTANGULAR: { label: 'Rectangular' },
      TRIANGULAR: { label: 'Triangular' },
      HEXAGONAL: { label: 'Hexagonal' },
      TRAPEZOIDAL: { label: 'Trapezoidal' },
    },
    addButtons: [
      { shape: 'RECTANGULAR', label: '+ Rectangular', primary: true },
      { shape: 'TRIANGULAR', label: '+ Triangular' },
      { shape: 'HEXAGONAL', label: '+ Hexagonal' },
      { shape: 'TRAPEZOIDAL', label: '+ Trapezoidal' },
    ],
    geometryByShape: {
      RECTANGULAR: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 12, step: 0.1, dec: 2, def: 2 },
        { key: 'width', label: 'W (m)', min: 0.5, max: 12, step: 0.1, dec: 2, def: 2 },
        { key: 'thickness', label: 'T (m)', min: 0.2, max: 3, step: 0.05, dec: 2, def: 0.5 },
        { key: 'pileCount', label: 'Piles', type: 'int', min: 1, max: 60, step: 1, dec: 0, def: 4 },
      ],
      TRIANGULAR: [
        { key: 'triangleBase', label: 'Base (m)', min: 0.5, max: 12, step: 0.1, dec: 2, def: 3 },
        { key: 'triangleHeight', label: 'Ht (m)', min: 0.5, max: 12, step: 0.1, dec: 2, def: 2.5 },
        { key: 'thickness', label: 'T (m)', min: 0.2, max: 3, step: 0.05, dec: 2, def: 0.6 },
        { key: 'pileCount', label: 'Piles', type: 'int', min: 1, max: 60, step: 1, dec: 0, def: 3 },
      ],
      HEXAGONAL: [
        { key: 'hexSide', label: 'Side (m)', min: 0.3, max: 6, step: 0.1, dec: 2, def: 1.5 },
        { key: 'thickness', label: 'T (m)', min: 0.2, max: 3, step: 0.05, dec: 2, def: 0.6 },
        { key: 'pileCount', label: 'Piles', type: 'int', min: 1, max: 60, step: 1, dec: 0, def: 6 },
      ],
      TRAPEZOIDAL: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 12, step: 0.1, dec: 2, def: 3 },
        { key: 'baseWidth', label: 'Wb (m)', min: 0.5, max: 12, step: 0.1, dec: 2, def: 3 },
        { key: 'topWidth', label: 'Wt (m)', min: 0.3, max: 12, step: 0.1, dec: 2, def: 2 },
        { key: 'thickness', label: 'T (m)', min: 0.2, max: 3, step: 0.05, dec: 2, def: 0.6 },
        { key: 'pileCount', label: 'Piles', type: 'int', min: 1, max: 60, step: 1, dec: 0, def: 4 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 25, max: 100, step: 5, dec: 0, def: 50 },
      { key: 'bottomMainDia', label: 'Mesh dia', type: 'select', options: BAR_SIZES, def: 16 },
      { key: 'bottomMainSpacing', label: 'Mesh spc', min: 75, max: 300, step: 25, dec: 0, def: 150 },
      { key: 'starterBarsPerPile', label: 'Bars/pile', type: 'int', min: 1, max: 20, step: 1, dec: 0, def: 4 },
      { key: 'starterDia', label: 'Starter dia', type: 'select', options: BAR_SIZES, def: 20 },
      { key: 'starterProjection', label: 'Proj. (m)', min: 0, max: 3, step: 0.05, dec: 2, def: 0.8 },
      { key: 'starterEmbedment', label: 'Embed. (m)', min: 0, max: 3, step: 0.05, dec: 2, def: 0.4 },
    ],
    outputCols: STRUCTURAL_OUTPUT,
  },

  PILES: {
    label: 'Piles',
    markPrefix: 'P',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    shapes: {
      CIRCULAR_BORED: { label: 'Circular-bored' },
      SQUARE_DRIVEN: { label: 'Square-driven' },
      H_SECTION: { label: 'H-section' },
    },
    addButtons: [
      { shape: 'CIRCULAR_BORED', label: '+ Circular-bored', primary: true },
      { shape: 'SQUARE_DRIVEN', label: '+ Square-driven' },
      { shape: 'H_SECTION', label: '+ H-section' },
    ],
    geometryByShape: {
      CIRCULAR_BORED: [
        { key: 'pileLength', label: 'Length (m)', min: 1, max: 80, step: 0.5, dec: 2, def: 10 },
        { key: 'diameter', label: 'Dia. (m)', min: 0.2, max: 3, step: 0.05, dec: 2, def: 0.6 },
      ],
      SQUARE_DRIVEN: [
        { key: 'pileLength', label: 'Length (m)', min: 1, max: 80, step: 0.5, dec: 2, def: 10 },
        { key: 'side', label: 'Side (m)', min: 0.2, max: 2, step: 0.05, dec: 2, def: 0.5 },
      ],
      H_SECTION: [
        { key: 'pileLength', label: 'Length (m)', min: 1, max: 80, step: 0.5, dec: 2, def: 10 },
        { key: 'sectionDepth', label: 'Depth (m)', min: 0.2, max: 2, step: 0.01, dec: 2, def: 0.5 },
        { key: 'flangeWidth', label: 'Flange W (m)', min: 0.1, max: 2, step: 0.01, dec: 2, def: 0.3 },
        { key: 'flangeThickness', label: 'Flange T (m)', min: 0.01, max: 0.5, step: 0.01, dec: 2, def: 0.05 },
        { key: 'webThickness', label: 'Web T (m)', min: 0.01, max: 0.5, step: 0.01, dec: 2, def: 0.02 },
        { key: 'sectionKgPerM', label: 'Section kg/m', min: 1, max: 500, step: 1, dec: 2, def: 82 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 20, max: 100, step: 5, dec: 0, def: 50 },
      { key: 'longBarCount', label: 'Long. bars', type: 'int', min: 2, max: 40, step: 1, dec: 0, def: 8 },
      { key: 'longBarDia', label: 'Long. dia', type: 'select', options: BAR_SIZES, def: 16 },
      { key: 'linkDia', label: 'Link dia', type: 'select', options: BAR_SIZES, def: 8 },
      { key: 'linkSpacing', label: 'Link spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
    ],
    outputCols: STRUCTURAL_OUTPUT,
  },

  EARTHWORKS: {
    label: 'Earthworks',
    markPrefix: 'EW',
    reportKind: 'earthworks',
    hasGrade: false,
    hasRebar: false,
    shapes: {
      ISOLATED_PIT: { label: 'Isolated-pit' },
      LINEAR_TRENCH: { label: 'Linear-trench' },
      BULK_BASIN: { label: 'Bulk-basin' },
    },
    addButtons: [
      { shape: 'ISOLATED_PIT', label: '+ Isolated-pit', primary: true },
      { shape: 'LINEAR_TRENCH', label: '+ Linear-trench' },
      { shape: 'BULK_BASIN', label: '+ Bulk-basin' },
    ],
    geometryByShape: {
      ISOLATED_PIT: [
        { key: 'length', label: 'L (m)', min: 0.2, max: 100, step: 0.1, dec: 2, def: 4 },
        { key: 'width', label: 'W (m)', min: 0.2, max: 100, step: 0.1, dec: 2, def: 3 },
        { key: 'depth', label: 'D (m)', min: 0.1, max: 20, step: 0.1, dec: 2, def: 2 },
      ],
      LINEAR_TRENCH: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 500, step: 0.5, dec: 2, def: 20 },
        { key: 'trenchWidth', label: 'W (m)', min: 0.2, max: 10, step: 0.05, dec: 2, def: 0.6 },
        { key: 'depth', label: 'D (m)', min: 0.1, max: 20, step: 0.1, dec: 2, def: 1.5 },
      ],
      BULK_BASIN: [
        { key: 'length', label: 'L (m)', min: 1, max: 500, step: 0.5, dec: 2, def: 20 },
        { key: 'width', label: 'W (m)', min: 1, max: 500, step: 0.5, dec: 2, def: 15 },
        { key: 'depth', label: 'D (m)', min: 0.1, max: 20, step: 0.1, dec: 2, def: 2 },
      ],
    },
    rebarFields: [],
    outputCols: [
      {
        key: 'excavation',
        label: 'Excavation (m³)',
        unit: 'm³',
        dec: 2,
        resultKey: 'totalExcavationM3',
      },
    ],
  },

  COLUMNS: {
    label: 'Columns',
    markPrefix: 'C',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    shapes: {
      RECTANGULAR: { label: 'Rectangular' },
      CIRCULAR: { label: 'Circular' },
      L_SHAPED: { label: 'L-shaped' },
      T_SHAPED: { label: 'T-shaped' },
      CRUCIFORM: { label: 'Cruciform' },
    },
    addButtons: [
      { shape: 'RECTANGULAR', label: '+ Rectangular', primary: true },
      { shape: 'CIRCULAR', label: '+ Circular' },
      { shape: 'L_SHAPED', label: '+ L-shaped' },
      { shape: 'T_SHAPED', label: '+ T-shaped' },
      { shape: 'CRUCIFORM', label: '+ Cruciform' },
    ],
    geometryByShape: {
      RECTANGULAR: [
        { key: 'width', label: 'W (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.4 },
        { key: 'depth', label: 'D (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.3 },
        { key: 'clearHeight', label: 'H (m)', min: 0.5, max: 20, step: 0.1, dec: 2, def: 3 },
      ],
      CIRCULAR: [
        { key: 'diameter', label: 'Dia. (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.4 },
        { key: 'clearHeight', label: 'H (m)', min: 0.5, max: 20, step: 0.1, dec: 2, def: 3 },
      ],
      L_SHAPED: [
        { key: 'width', label: 'Overall W (m)', min: 0.2, max: 5, step: 0.05, dec: 2, def: 0.6 },
        { key: 'depth', label: 'Overall D (m)', min: 0.2, max: 5, step: 0.05, dec: 2, def: 0.5 },
        { key: 'legThickness', label: 'Leg T (m)', min: 0.1, max: 2, step: 0.05, dec: 2, def: 0.2 },
        { key: 'clearHeight', label: 'H (m)', min: 0.5, max: 20, step: 0.1, dec: 2, def: 3 },
      ],
      T_SHAPED: [
        { key: 'flangeWidth', label: 'Flange W (m)', min: 0.2, max: 5, step: 0.05, dec: 2, def: 0.6 },
        { key: 'overallDepth', label: 'Overall D (m)', min: 0.2, max: 5, step: 0.05, dec: 2, def: 0.5 },
        { key: 'flangeThickness', label: 'Flange T (m)', min: 0.1, max: 2, step: 0.05, dec: 2, def: 0.2 },
        { key: 'webThickness', label: 'Web T (m)', min: 0.1, max: 2, step: 0.05, dec: 2, def: 0.2 },
        { key: 'clearHeight', label: 'H (m)', min: 0.5, max: 20, step: 0.1, dec: 2, def: 3 },
      ],
      CRUCIFORM: [
        { key: 'width', label: 'Overall W (m)', min: 0.2, max: 5, step: 0.05, dec: 2, def: 0.8 },
        { key: 'depth', label: 'Overall D (m)', min: 0.2, max: 5, step: 0.05, dec: 2, def: 0.6 },
        { key: 'armThickness', label: 'Arm T (m)', min: 0.1, max: 2, step: 0.05, dec: 2, def: 0.2 },
        { key: 'clearHeight', label: 'H (m)', min: 0.5, max: 20, step: 0.1, dec: 2, def: 3 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 20, max: 100, step: 5, dec: 0, def: 40 },
      { key: 'longBarCount', label: 'Long. bars', type: 'int', min: 2, max: 60, step: 1, dec: 0, def: 8 },
      { key: 'longBarDia', label: 'Long. dia', type: 'select', options: BAR_SIZES, def: 16 },
      { key: 'tieDia', label: 'Tie dia', type: 'select', options: BAR_SIZES, def: 8 },
      { key: 'tieSpacing', label: 'Tie spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
    ],
    outputCols: STRUCTURAL_OUTPUT,
  },

  BEAMS: {
    label: 'Beams',
    markPrefix: 'B',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    shapes: {
      RECTANGULAR: { label: 'Rectangular' },
      T_SECTION: { label: 'T-section' },
      L_SECTION: { label: 'L-section' },
      CANTILEVER_TAPERED: { label: 'Cantilever-tapered' },
      GROUND_TIE: { label: 'Ground-tie' },
    },
    addButtons: [
      { shape: 'RECTANGULAR', label: '+ Rectangular', primary: true },
      { shape: 'T_SECTION', label: '+ T-section' },
      { shape: 'L_SECTION', label: '+ L-section' },
      { shape: 'CANTILEVER_TAPERED', label: '+ Cantilever-tapered' },
      { shape: 'GROUND_TIE', label: '+ Ground-tie' },
    ],
    geometryByShape: {
      RECTANGULAR: [
        { key: 'spanLength', label: 'Span (m)', min: 0.5, max: 50, step: 0.1, dec: 2, def: 4 },
        { key: 'width', label: 'W (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.3 },
        { key: 'depth', label: 'D (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.5 },
      ],
      T_SECTION: [
        { key: 'spanLength', label: 'Span (m)', min: 0.5, max: 50, step: 0.1, dec: 2, def: 4 },
        { key: 'flangeWidth', label: 'Flange W (m)', min: 0.2, max: 5, step: 0.05, dec: 2, def: 0.6 },
        { key: 'flangeThickness', label: 'Flange T (m)', min: 0.05, max: 1, step: 0.05, dec: 2, def: 0.15 },
        { key: 'webWidth', label: 'Web W (m)', min: 0.1, max: 2, step: 0.05, dec: 2, def: 0.25 },
        { key: 'overallDepth', label: 'Overall D (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.5 },
      ],
      L_SECTION: [
        { key: 'spanLength', label: 'Span (m)', min: 0.5, max: 50, step: 0.1, dec: 2, def: 4 },
        { key: 'flangeWidth', label: 'Flange W (m)', min: 0.2, max: 5, step: 0.05, dec: 2, def: 0.5 },
        { key: 'flangeThickness', label: 'Flange T (m)', min: 0.05, max: 1, step: 0.05, dec: 2, def: 0.15 },
        { key: 'webWidth', label: 'Web W (m)', min: 0.1, max: 2, step: 0.05, dec: 2, def: 0.2 },
        { key: 'overallDepth', label: 'Overall D (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.45 },
      ],
      CANTILEVER_TAPERED: [
        { key: 'spanLength', label: 'Span (m)', min: 0.5, max: 30, step: 0.1, dec: 2, def: 4 },
        { key: 'width', label: 'W (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.3 },
        { key: 'supportDepth', label: 'Support D (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.6 },
        { key: 'tipDepth', label: 'Tip D (m)', min: 0.1, max: 3, step: 0.05, dec: 2, def: 0.3 },
      ],
      GROUND_TIE: [
        { key: 'spanLength', label: 'Span (m)', min: 0.5, max: 100, step: 0.1, dec: 2, def: 4 },
        { key: 'width', label: 'W (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.3 },
        { key: 'depth', label: 'D (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.5 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 20, max: 100, step: 5, dec: 0, def: 40 },
      { key: 'topBarCount', label: 'Top bars', type: 'int', min: 1, max: 30, step: 1, dec: 0, def: 2 },
      { key: 'topBarDia', label: 'Top dia', type: 'select', options: BAR_SIZES, def: 16 },
      { key: 'bottomBarCount', label: 'Bottom bars', type: 'int', min: 1, max: 30, step: 1, dec: 0, def: 3 },
      { key: 'bottomBarDia', label: 'Bottom dia', type: 'select', options: BAR_SIZES, def: 20 },
      { key: 'linkDia', label: 'Link dia', type: 'select', options: BAR_SIZES, def: 8 },
      { key: 'linkSpacing', label: 'Link spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
    ],
    outputCols: STRUCTURAL_OUTPUT,
  },

  SLABS: {
    label: 'Slabs',
    markPrefix: 'S',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    locationOptions: ['On-grade', 'Elevated floor', 'Roof'],
    defaultLocation: 'Elevated floor',
    shapes: {
      FLAT: { label: 'Flat' },
      SLOPED: { label: 'Sloped' },
      WAFFLE: { label: 'Waffle' },
      DROP_PANEL: { label: 'Drop-panel' },
    },
    addButtons: [
      { shape: 'FLAT', label: '+ Flat', primary: true },
      { shape: 'SLOPED', label: '+ Sloped' },
      { shape: 'WAFFLE', label: '+ Waffle' },
      { shape: 'DROP_PANEL', label: '+ Drop-panel' },
    ],
    geometryByShape: {
      FLAT: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 100, step: 0.1, dec: 2, def: 6 },
        { key: 'width', label: 'W (m)', min: 0.5, max: 100, step: 0.1, dec: 2, def: 4 },
        { key: 'thickness', label: 'T (m)', min: 0.08, max: 1, step: 0.01, dec: 2, def: 0.2 },
      ],
      SLOPED: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 100, step: 0.1, dec: 2, def: 6 },
        { key: 'width', label: 'W (m)', min: 0.5, max: 100, step: 0.1, dec: 2, def: 4 },
        { key: 'startThickness', label: 'Start T (m)', min: 0.08, max: 2, step: 0.01, dec: 2, def: 0.2 },
        { key: 'endThickness', label: 'End T (m)', min: 0.08, max: 2, step: 0.01, dec: 2, def: 0.3 },
      ],
      WAFFLE: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 100, step: 0.1, dec: 2, def: 6 },
        { key: 'width', label: 'W (m)', min: 0.5, max: 100, step: 0.1, dec: 2, def: 4 },
        { key: 'flangeThickness', label: 'Flange T (m)', min: 0.05, max: 0.5, step: 0.01, dec: 2, def: 0.1 },
        { key: 'ribSpacing', label: 'Rib spc (m)', min: 0.3, max: 3, step: 0.05, dec: 2, def: 1 },
        { key: 'ribWidth', label: 'Rib W (m)', min: 0.05, max: 0.8, step: 0.01, dec: 2, def: 0.15 },
        { key: 'ribDepth', label: 'Rib D below flange (m)', min: 0.05, max: 2, step: 0.01, dec: 2, def: 0.3 },
      ],
      DROP_PANEL: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 100, step: 0.1, dec: 2, def: 6 },
        { key: 'width', label: 'W (m)', min: 0.5, max: 100, step: 0.1, dec: 2, def: 4 },
        { key: 'thickness', label: 'T (m)', min: 0.08, max: 1, step: 0.01, dec: 2, def: 0.2 },
        { key: 'dropLength', label: 'Drop L (m)', min: 0.2, max: 20, step: 0.1, dec: 2, def: 2 },
        { key: 'dropWidth', label: 'Drop W (m)', min: 0.2, max: 20, step: 0.1, dec: 2, def: 2 },
        { key: 'extraDropDepth', label: 'Extra D (m)', min: 0.05, max: 2, step: 0.01, dec: 2, def: 0.15 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 20, max: 100, step: 5, dec: 0, def: 50 },
      { key: 'bottomMainDia', label: 'Main dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'bottomMainSpacing', label: 'Main spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
      { key: 'bottomDistDia', label: 'Dist. dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'bottomDistSpacing', label: 'Dist. spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
      { key: 'ribBarsPerRib', label: 'Bars/rib', type: 'int', min: 1, max: 12, step: 1, dec: 0, def: 2 },
    ],
    outputCols: STRUCTURAL_OUTPUT,
  },

  STAIRS: {
    label: 'Stairs',
    markPrefix: 'ST',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    shapes: {
      STRAIGHT: { label: 'Straight' },
      WINDER: { label: 'Winder' },
      SPIRAL: { label: 'Spiral' },
    },
    addButtons: [
      { shape: 'STRAIGHT', label: '+ Straight', primary: true },
      { shape: 'WINDER', label: '+ Winder' },
      { shape: 'SPIRAL', label: '+ Spiral' },
    ],
    geometryByShape: {
      STRAIGHT: [
        { key: 'run', label: 'Run (m)', min: 0.5, max: 30, step: 0.1, dec: 2, def: 4 },
        { key: 'rise', label: 'Rise (m)', min: 0.2, max: 12, step: 0.1, dec: 2, def: 3 },
        { key: 'width', label: 'W (m)', min: 0.5, max: 6, step: 0.1, dec: 2, def: 1.2 },
        { key: 'stepCount', label: 'Steps', type: 'int', min: 1, max: 100, step: 1, dec: 0, def: 12 },
        { key: 'waistThickness', label: 'Waist T (m)', min: 0.08, max: 0.8, step: 0.01, dec: 2, def: 0.15 },
      ],
      WINDER: [
        { key: 'flight1Run', label: 'Flight 1 (m)', min: 0, max: 30, step: 0.1, dec: 2, def: 2 },
        { key: 'flight2Run', label: 'Flight 2 (m)', min: 0, max: 30, step: 0.1, dec: 2, def: 2 },
        { key: 'innerRadius', label: 'Inner R (m)', min: 0.1, max: 20, step: 0.1, dec: 2, def: 1 },
        { key: 'turnAngleDeg', label: 'Turn (°)', min: 15, max: 360, step: 5, dec: 0, def: 90 },
        { key: 'rise', label: 'Rise (m)', min: 0.2, max: 12, step: 0.1, dec: 2, def: 3 },
        { key: 'width', label: 'W (m)', min: 0.5, max: 6, step: 0.1, dec: 2, def: 1.2 },
        { key: 'stepCount', label: 'Steps', type: 'int', min: 1, max: 100, step: 1, dec: 0, def: 12 },
        { key: 'waistThickness', label: 'Waist T (m)', min: 0.08, max: 0.8, step: 0.01, dec: 2, def: 0.15 },
      ],
      SPIRAL: [
        { key: 'innerRadius', label: 'Inner R (m)', min: 0.1, max: 20, step: 0.1, dec: 2, def: 2 },
        { key: 'turnAngleDeg', label: 'Turn (°)', min: 30, max: 1080, step: 15, dec: 0, def: 180 },
        { key: 'rise', label: 'Rise (m)', min: 0.2, max: 20, step: 0.1, dec: 2, def: 3 },
        { key: 'width', label: 'W (m)', min: 0.5, max: 6, step: 0.1, dec: 2, def: 1 },
        { key: 'stepCount', label: 'Steps', type: 'int', min: 1, max: 200, step: 1, dec: 0, def: 16 },
        { key: 'waistThickness', label: 'Waist T (m)', min: 0.08, max: 0.8, step: 0.01, dec: 2, def: 0.15 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 20, max: 100, step: 5, dec: 0, def: 50 },
      { key: 'mainDia', label: 'Main dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'mainSpacing', label: 'Main spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
      { key: 'distDia', label: 'Dist. dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'distSpacing', label: 'Dist. spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
      { key: 'stringBeamCount', label: 'String beams', type: 'int', min: 0, max: 10, step: 1, dec: 0, def: 2 },
      { key: 'stringBeamWidth', label: 'Str. W (m)', min: 0.1, max: 1, step: 0.05, dec: 2, def: 0.2 },
      { key: 'stringBeamDepth', label: 'Str. D (m)', min: 0.1, max: 1, step: 0.05, dec: 2, def: 0.3 },
      { key: 'stringTopBarCount', label: 'Str. top n', type: 'int', min: 1, max: 20, step: 1, dec: 0, def: 2 },
      { key: 'stringTopBarDia', label: 'Str. top dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'stringBottomBarCount', label: 'Str. bot n', type: 'int', min: 1, max: 20, step: 1, dec: 0, def: 2 },
      { key: 'stringBottomBarDia', label: 'Str. bot dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'stringLinkDia', label: 'Str. link dia', type: 'select', options: BAR_SIZES, def: 8 },
      { key: 'stringLinkSpacing', label: 'Str. link spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
    ],
    outputCols: STRUCTURAL_OUTPUT,
  },

  RAMPS: {
    label: 'Ramps',
    markPrefix: 'R',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    shapes: {
      RECTANGULAR_INCLINE: { label: 'Rectangular-incline' },
      HELICAL: { label: 'Helical' },
    },
    addButtons: [
      { shape: 'RECTANGULAR_INCLINE', label: '+ Rectangular-incline', primary: true },
      { shape: 'HELICAL', label: '+ Helical' },
    ],
    geometryByShape: {
      RECTANGULAR_INCLINE: [
        { key: 'horizontalRun', label: 'Run (m)', min: 0.5, max: 100, step: 0.1, dec: 2, def: 4 },
        { key: 'rise', label: 'Rise (m)', min: 0.1, max: 20, step: 0.1, dec: 2, def: 3 },
        { key: 'width', label: 'W (m)', min: 0.5, max: 20, step: 0.1, dec: 2, def: 1.2 },
        { key: 'thickness', label: 'T (m)', min: 0.08, max: 1, step: 0.01, dec: 2, def: 0.15 },
      ],
      HELICAL: [
        { key: 'innerRadius', label: 'Inner R (m)', min: 0.1, max: 50, step: 0.1, dec: 2, def: 2 },
        { key: 'turnAngleDeg', label: 'Turn (°)', min: 30, max: 1080, step: 15, dec: 0, def: 180 },
        { key: 'rise', label: 'Rise (m)', min: 0.1, max: 30, step: 0.1, dec: 2, def: 3 },
        { key: 'width', label: 'W (m)', min: 0.5, max: 20, step: 0.1, dec: 2, def: 1 },
        { key: 'thickness', label: 'T (m)', min: 0.08, max: 1, step: 0.01, dec: 2, def: 0.15 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 20, max: 100, step: 5, dec: 0, def: 50 },
      { key: 'mainDia', label: 'Main dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'mainSpacing', label: 'Main spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
      { key: 'distDia', label: 'Dist. dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'distSpacing', label: 'Dist. spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
      { key: 'stringBeamCount', label: 'String beams', type: 'int', min: 0, max: 10, step: 1, dec: 0, def: 2 },
      { key: 'stringBeamWidth', label: 'Str. W (m)', min: 0.1, max: 1, step: 0.05, dec: 2, def: 0.2 },
      { key: 'stringBeamDepth', label: 'Str. D (m)', min: 0.1, max: 1, step: 0.05, dec: 2, def: 0.3 },
      { key: 'stringTopBarCount', label: 'Str. top n', type: 'int', min: 1, max: 20, step: 1, dec: 0, def: 2 },
      { key: 'stringTopBarDia', label: 'Str. top dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'stringBottomBarCount', label: 'Str. bot n', type: 'int', min: 1, max: 20, step: 1, dec: 0, def: 2 },
      { key: 'stringBottomBarDia', label: 'Str. bot dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'stringLinkDia', label: 'Str. link dia', type: 'select', options: BAR_SIZES, def: 8 },
      { key: 'stringLinkSpacing', label: 'Str. link spc', min: 75, max: 400, step: 25, dec: 0, def: 200 },
    ],
    outputCols: STRUCTURAL_OUTPUT,
  },

  STRIP_FOOTING: {
    label: 'Strip Foundation',
    markPrefix: 'SF',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    shapes: {
      FLAT: { label: 'Flat Rectangular' },
      TAPERED: { label: 'Tapered' },
      STEPPED: { label: 'Stepped' },
    },
    addButtons: [
      { shape: 'FLAT', label: '+ Flat', primary: true },
      { shape: 'TAPERED', label: '+ Tapered' },
      { shape: 'STEPPED', label: '+ Stepped' },
    ],
    geometryByShape: {
      FLAT: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 100, step: 0.5, dec: 2, def: 10 },
        { key: 'width', label: 'W (m)', min: 0.3, max: 3, step: 0.05, dec: 2, def: 0.6 },
        { key: 'height', label: 'H (m)', min: 0.15, max: 1.5, step: 0.05, dec: 2, def: 0.3 },
      ],
      TAPERED: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 100, step: 0.5, dec: 2, def: 10 },
        { key: 'baseWidth', label: 'Wb (m)', min: 0.3, max: 3, step: 0.05, dec: 2, def: 0.8 },
        { key: 'topWidth', label: 'Wt (m)', min: 0.15, max: 3, step: 0.05, dec: 2, def: 0.4 },
        { key: 'height', label: 'H (m)', min: 0.15, max: 1.5, step: 0.05, dec: 2, def: 0.4 },
      ],
      STEPPED: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 100, step: 0.5, dec: 2, def: 8 },
        { key: 'baseWidth', label: 'W1 (m)', min: 0.3, max: 3, step: 0.05, dec: 2, def: 0.9 },
        { key: 'baseHeight', label: 'H1 (m)', min: 0.15, max: 1, step: 0.05, dec: 2, def: 0.3 },
        { key: 'upperWidth', label: 'W2 (m)', min: 0.2, max: 3, step: 0.05, dec: 2, def: 0.45 },
        { key: 'upperHeight', label: 'H2 (m)', min: 0.15, max: 1, step: 0.05, dec: 2, def: 0.3 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 25, max: 100, step: 5, dec: 0, def: 50 },
      { key: 'mainDia', label: 'Main dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'mainSpacing', label: 'Main spc', min: 75, max: 300, step: 25, dec: 0, def: 150 },
    ],
    rebarDefaults: {
      distSpacing: 250,
      topMeshEnabled: false,
      startersEnabled: false,
      starterDia: 12,
      starterCount: 10,
      starterProjection: 0.5,
      starterEmbedment: 0.3,
    },
    outputCols: STRUCTURAL_OUTPUT,
  },

  WALLS: {
    label: 'Walls',
    markPrefix: 'W',
    reportKind: 'structural',
    hasGrade: true,
    hasRebar: true,
    locationOptions: ['Below-grade', 'Exterior', 'Interior'],
    defaultLocation: 'Interior',
    shapes: {
      LINEAR: { label: 'Linear Shell' },
      CURVED: { label: 'Curved Core' },
    },
    addButtons: [
      { shape: 'LINEAR', label: '+ Linear', primary: true },
      { shape: 'CURVED', label: '+ Curved' },
    ],
    geometryByShape: {
      LINEAR: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 100, step: 0.5, dec: 2, def: 6 },
        { key: 'thickness', label: 'T (m)', min: 0.1, max: 0.6, step: 0.025, dec: 3, def: 0.25 },
        { key: 'height', label: 'H (m)', min: 0.5, max: 12, step: 0.1, dec: 2, def: 3 },
      ],
      CURVED: [
        { key: 'radius', label: 'R (m)', min: 1, max: 30, step: 0.5, dec: 2, def: 6 },
        { key: 'arcAngleDeg', label: 'Arc (°)', min: 10, max: 360, step: 5, dec: 0, def: 90 },
        { key: 'thickness', label: 'T (m)', min: 0.1, max: 0.6, step: 0.025, dec: 3, def: 0.3 },
        { key: 'height', label: 'H (m)', min: 0.5, max: 12, step: 0.1, dec: 2, def: 3 },
      ],
    },
    rebarFields: [
      { key: 'cover', label: 'Cover (mm)', min: 20, max: 75, step: 5, dec: 0, def: 40 },
      { key: 'vertDia', label: 'Vert dia', type: 'select', options: BAR_SIZES, def: 12 },
      { key: 'vertSpacing', label: 'Vert spc', min: 75, max: 300, step: 25, dec: 0, def: 200 },
    ],
    rebarDefaults: {
      horizSpacing: 250,
      bothFaces: true,
      startersEnabled: false,
      starterDia: 12,
      starterCount: 20,
      starterProjection: 0.5,
      starterEmbedment: 0.4,
    },
    outputCols: STRUCTURAL_OUTPUT,
  },

  STONE_STRIP: {
    label: 'Stone Strip Foundation',
    markPrefix: 'STF',
    reportKind: 'masonry',
    hasGrade: false,
    hasRebar: false,
    shapes: {
      RECTANGULAR: { label: 'Rectangular' },
      TRAPEZOIDAL: { label: 'Trapezoidal' },
      STEPPED: { label: 'Stepped' },
    },
    addButtons: [
      { shape: 'RECTANGULAR', label: '+ Rectangular', primary: true },
      { shape: 'TRAPEZOIDAL', label: '+ Trapezoidal' },
      { shape: 'STEPPED', label: '+ Stepped' },
    ],
    geometryByShape: {
      RECTANGULAR: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 200, step: 0.5, dec: 2, def: 20 },
        { key: 'width', label: 'W (m)', min: 0.3, max: 2, step: 0.05, dec: 2, def: 0.6 },
        { key: 'height', label: 'H (m)', min: 0.3, max: 2, step: 0.05, dec: 2, def: 0.6 },
      ],
      TRAPEZOIDAL: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 200, step: 0.5, dec: 2, def: 20 },
        { key: 'baseWidth', label: 'Wb (m)', min: 0.4, max: 2, step: 0.05, dec: 2, def: 0.8 },
        { key: 'topWidth', label: 'Wt (m)', min: 0.2, max: 2, step: 0.05, dec: 2, def: 0.4 },
        { key: 'height', label: 'H (m)', min: 0.3, max: 2, step: 0.05, dec: 2, def: 0.6 },
      ],
      STEPPED: [
        { key: 'length', label: 'L (m)', min: 0.5, max: 200, step: 0.5, dec: 2, def: 16 },
        { key: 'baseWidth', label: 'W1 (m)', min: 0.4, max: 2, step: 0.05, dec: 2, def: 0.9 },
        { key: 'baseHeight', label: 'H1 (m)', min: 0.2, max: 1, step: 0.05, dec: 2, def: 0.3 },
        { key: 'upperWidth', label: 'W2 (m)', min: 0.3, max: 2, step: 0.05, dec: 2, def: 0.6 },
        { key: 'upperHeight', label: 'H2 (m)', min: 0.2, max: 1, step: 0.05, dec: 2, def: 0.3 },
      ],
    },
    rebarFields: [],
    rebarDefaults: { hasBlinding: true },
    outputCols: [
      { key: 'masonry', label: 'Masonry (m³)', unit: 'm³', dec: 2, resultKey: 'totalMasonryM3' },
      { key: 'mortar', label: 'Mortar (m³)', unit: 'm³', dec: 2, resultKey: 'totalMortarM3' },
      { key: 'blinding', label: 'Blinding (m³)', unit: 'm³', dec: 2, resultKey: 'totalBlindingM3' },
    ],
  },

  FLOOR_FINISH: {
    label: 'Floor Finish',
    markPrefix: 'FF',
    reportKind: 'finish',
    hasGrade: false,
    hasRebar: false,
    shapes: { AREA: { label: 'Area' } },
    addButtons: [{ shape: 'AREA', label: '+ Add area', primary: true }],
    geometryByShape: {
      AREA: [
        {
          key: 'roomLabel',
          label: 'Room',
          type: 'text',
          def: '',
          optional: true,
        },
        { key: 'roomLength', label: 'L (m)', min: 0.5, max: 60, step: 0.1, dec: 2, def: 5 },
        { key: 'roomWidth', label: 'W (m)', min: 0.5, max: 60, step: 0.1, dec: 2, def: 4 },
        { key: 'openingArea', label: 'Opng (m²)', min: 0, max: 500, step: 0.1, dec: 2, def: 0 },
        {
          key: 'areaOverride',
          label: 'Override (m²)',
          min: 0,
          max: 5000,
          step: 0.1,
          dec: 2,
          def: '',
          optional: true,
        },
        {
          key: 'tileWastage',
          label: 'Waste %',
          min: 0,
          max: 100,
          step: 1,
          dec: 0,
          def: '',
          optional: true,
          uiPercent: true,
        },
      ],
    },
    rebarFields: [],
    specList: FINISH_SPECS.FLOOR,
    outputCols: [
      { key: 'area', label: 'Area (m²)', unit: 'm²', dec: 2, resultKey: 'totalAreaM2' },
      { key: 'screed', label: 'Screed (m³)', unit: 'm³', dec: 2, resultKey: 'totalScreedM3' },
      { key: 'tiles', label: 'Tiles (m²)', unit: 'm²', dec: 2, resultKey: 'totalTilesM2' },
    ],
  },

  WALL_FINISH: {
    label: 'Wall Finish',
    markPrefix: 'WF',
    reportKind: 'finish',
    hasGrade: false,
    hasRebar: false,
    locationOptions: ['Exterior', 'Interior'],
    defaultLocation: 'Interior',
    shapes: { AREA: { label: 'Area' } },
    addButtons: [{ shape: 'AREA', label: '+ Add area', primary: true }],
    geometryByShape: {
      AREA: [
        {
          key: 'roomLabel',
          label: 'Room',
          type: 'text',
          def: '',
          optional: true,
        },
        { key: 'wallLength', label: 'Len (m)', min: 0.5, max: 200, step: 0.1, dec: 2, def: 12 },
        { key: 'wallHeight', label: 'Ht (m)', min: 0.5, max: 12, step: 0.1, dec: 2, def: 3 },
        { key: 'openingArea', label: 'Opng (m²)', min: 0, max: 100, step: 0.1, dec: 2, def: 2.5 },
        {
          key: 'areaOverride',
          label: 'Override (m²)',
          min: 0,
          max: 5000,
          step: 0.1,
          dec: 2,
          def: '',
          optional: true,
        },
        {
          key: 'tileWastage',
          label: 'Waste %',
          min: 0,
          max: 100,
          step: 1,
          dec: 0,
          def: '',
          optional: true,
          uiPercent: true,
        },
      ],
    },
    rebarFields: [],
    specList: FINISH_SPECS.WALL,
    outputCols: [
      { key: 'area', label: 'Area (m²)', unit: 'm²', dec: 2, resultKey: 'totalAreaM2' },
    ],
  },

  CEILING_FINISH: {
    label: 'Ceiling Finish',
    markPrefix: 'CF',
    reportKind: 'finish',
    hasGrade: false,
    hasRebar: false,
    shapes: { AREA: { label: 'Area' } },
    addButtons: [{ shape: 'AREA', label: '+ Add area', primary: true }],
    geometryByShape: {
      AREA: [
        {
          key: 'roomLabel',
          label: 'Room',
          type: 'text',
          def: '',
          optional: true,
        },
        { key: 'roomLength', label: 'L (m)', min: 0.5, max: 60, step: 0.1, dec: 2, def: 5 },
        { key: 'roomWidth', label: 'W (m)', min: 0.5, max: 60, step: 0.1, dec: 2, def: 4 },
        { key: 'openingArea', label: 'Opng (m²)', min: 0, max: 500, step: 0.1, dec: 2, def: 0 },
        {
          key: 'areaOverride',
          label: 'Override (m²)',
          min: 0,
          max: 5000,
          step: 0.1,
          dec: 2,
          def: '',
          optional: true,
        },
        {
          key: 'tileWastage',
          label: 'Waste %',
          min: 0,
          max: 100,
          step: 1,
          dec: 0,
          def: '',
          optional: true,
          uiPercent: true,
        },
      ],
    },
    rebarFields: [],
    specList: FINISH_SPECS.CEILING,
    outputCols: [
      { key: 'area', label: 'Area (m²)', unit: 'm²', dec: 2, resultKey: 'totalAreaM2' },
    ],
  },
}

/** Build API create payload for a new instance of the given element/shape. */
export function buildDefaultInstancePayload(
  elementKey: string,
  shape: string,
  markSeed: string | number,
  defaultConcreteGrade = 'C25/30',
  floorId = 'GF',
) {
  const schema = ELEMENT_SCHEMAS[elementKey]
  if (!schema) throw new Error(`No schema for ${elementKey}`)

  const geoFields = schema.geometryByShape[shape] || []
  const geometry: Record<string, unknown> = {}
  geoFields.forEach((f) => {
    if (f.optional) return
    geometry[f.key] = Number(f.def)
  })

  const reinforcement: Record<string, unknown> = { ...(schema.rebarDefaults || {}) }
  schema.rebarFields.forEach((f) => {
    reinforcement[f.key] = f.def
  })

  // Mirror prototype: sync dist dia/spacing from main where applicable
  if (elementKey === 'PAD_FOOTING') {
    reinforcement.bottomDistDia = reinforcement.bottomMainDia
    reinforcement.bottomDistSpacing = reinforcement.bottomMainSpacing
  }
  if (elementKey === 'RAFT' || elementKey === 'PILE_CAP') {
    reinforcement.bottomDistDia = reinforcement.bottomMainDia
    reinforcement.bottomDistSpacing = reinforcement.bottomMainSpacing
  }
  if (elementKey === 'STRIP_FOOTING') {
    reinforcement.distDia = reinforcement.mainDia
  }
  if (elementKey === 'WALLS') {
    reinforcement.horizDia = reinforcement.vertDia
  }

  if (elementKey === 'STONE_STRIP') {
    delete reinforcement.hasBlinding
    geometry.hasBlinding = true
  }

  let location: string | null = null
  if (schema.locationOptions?.length) {
    const id = floorId.trim().toUpperCase()
    if (elementKey === 'SLABS') {
      if (id === 'RF' || id === 'ROOF' || id.includes('ROOF')) location = 'Roof'
      else if (
        id === 'FDN' ||
        id === 'GF' ||
        id === 'G' ||
        id === 'L00' ||
        id === '00' ||
        id.startsWith('FOUND') ||
        id.includes('GROUND')
      ) {
        location = 'On-grade'
      } else {
        location = schema.defaultLocation || 'Elevated floor'
      }
    } else {
      location = schema.defaultLocation || schema.locationOptions[0]
    }
  }

  return {
    elementKey,
    shape,
    mark: `${schema.markPrefix}${markSeed}`,
    count: 1,
    geometry,
    reinforcement: Object.keys(reinforcement).length ? reinforcement : null,
    concreteGrade: schema.hasGrade ? defaultConcreteGrade : null,
    spec: schema.specList ? schema.specList[0] : null,
    location,
  }
}

/** Union of geometry column keys across shapes (for mixed-shape schedule header). */
export function allGeoCols(schema: ElementSchema): { key: string; label: string }[] {
  const seen = new Map<string, string>()
  Object.values(schema.geometryByShape).forEach((fields) => {
    fields.forEach((f) => {
      if (!seen.has(f.key)) {
        seen.set(f.key, f.label.replace(/\s*\(.*\)$/, ''))
      }
    })
  })
  return [...seen.entries()].map(([key, label]) => ({ key, label }))
}
