/**
 * View toggles read by build*Model — mirrors prototype `modelView`
 * (showRebar / showDims). Mutate from React; unitSystem drives dim labels.
 */
export const modelViewOptions = {
  showRebar: true,
  showDims: true,
  /** Project display units — engines stay metric; labels convert at draw time. */
  unitSystem: 'metric' as 'metric' | 'imperial',
};

/** Materials knobs read by stone 3D — mirrors `state.materials` defaults. */
export const materials3D = {
  blindingThickness: 0.05,
};
