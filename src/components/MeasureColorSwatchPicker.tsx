import { LAYER_PALETTE_SWATCHES } from '../lib/layerColorPalette'

/**
 * Compact swatch strip — same palette buttons as LayerColorPickerField,
 * sized for the Measurements sidebar cards.
 */
export function MeasureColorSwatchPicker({
  value,
  onChange,
  onClose,
}: {
  value: string
  onChange: (color: string) => void
  onClose?: () => void
}) {
  return (
    <div
      className="mt-1.5 border border-steel-border/80 bg-[#1a1f26] p-1.5"
      role="group"
      aria-label="Measurement color"
    >
      <div className="flex flex-wrap gap-1">
        {LAYER_PALETTE_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Color ${swatch}`}
            aria-pressed={value.toLowerCase() === swatch.toLowerCase()}
            title={swatch}
            onClick={() => {
              onChange(swatch)
              onClose?.()
            }}
            className={`h-5 w-5 border-2 transition ${
              value.toLowerCase() === swatch.toLowerCase()
                ? 'border-white ring-1 ring-white/50'
                : 'border-steel-border/60 hover:border-white/70'
            }`}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
    </div>
  )
}
