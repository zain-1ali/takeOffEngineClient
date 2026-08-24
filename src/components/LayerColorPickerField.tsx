import { useState } from 'react'
import {
  isValidHexColor,
  LAYER_PALETTE_SWATCHES,
} from '../lib/layerColorPalette'

interface LayerColorPickerFieldProps {
  value: string | null
  onChange: (color: string) => void
}

export function LayerColorPickerField({
  value,
  onChange,
}: LayerColorPickerFieldProps) {
  const [customHex, setCustomHex] = useState(value ?? '#2563eb')
  const customValid = isValidHexColor(customHex)

  return (
    <fieldset>
      <legend className="text-[0.65rem] font-medium tracking-wide text-steel uppercase">
        Color
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {LAYER_PALETTE_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Layer color ${swatch}`}
            aria-pressed={value === swatch}
            onClick={() => onChange(swatch)}
            className={`h-7 w-7 border-2 transition ${
              value === swatch
                ? 'border-signal ring-2 ring-signal/40'
                : 'border-steel-border hover:border-signal/60'
            }`}
            style={{ backgroundColor: swatch }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={customValid ? customHex : '#2563eb'}
          onChange={(event) => {
            const next = event.target.value
            setCustomHex(next)
            if (isValidHexColor(next)) {
              onChange(next)
            }
          }}
          className="h-9 w-12 cursor-pointer border border-steel-border bg-transparent"
          aria-label="Custom color"
        />
        <span className="text-[0.65rem] text-steel">Or pick a custom color</span>
      </div>
    </fieldset>
  )
}
