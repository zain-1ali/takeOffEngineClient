/** UniFormat II codes available for Manual BOQ → Cost Plan classification. */
export const UNIFORMAT_CODE_OPTIONS: { code: string; title: string; group: string }[] = [
  { code: 'A1010', title: 'Standard Foundations', group: 'A' },
  { code: 'A1020', title: 'Special Foundations', group: 'A' },
  { code: 'A1030', title: 'Slab on Grade', group: 'A' },
  { code: 'A20', title: 'Basement Construction', group: 'A' },
  { code: 'B10', title: 'Superstructure', group: 'B' },
  { code: 'B1010', title: 'Floor Construction', group: 'B' },
  { code: 'B1020', title: 'Roof Construction', group: 'B' },
  { code: 'B2010', title: 'Exterior Walls', group: 'B' },
  { code: 'B2020', title: 'Exterior Windows', group: 'B' },
  { code: 'B2030', title: 'Exterior Doors', group: 'B' },
  { code: 'C1010', title: 'Partitions', group: 'C' },
  { code: 'C1020', title: 'Interior Doors', group: 'C' },
  { code: 'C2010', title: 'Stair Construction', group: 'C' },
  { code: 'C3010', title: 'Wall Finishes', group: 'C' },
  { code: 'C3020', title: 'Floor Finishes', group: 'C' },
  { code: 'C3030', title: 'Ceiling Finishes', group: 'C' },
  { code: 'D20', title: 'Plumbing', group: 'D' },
  { code: 'D30', title: 'HVAC', group: 'D' },
  { code: 'D50', title: 'Electrical', group: 'D' },
  { code: 'G20', title: 'Site Improvements', group: 'G' },
  { code: 'Z9990', title: 'Unclassified', group: 'Z' },
]

export function formatUniformatOption(code: string, title: string): string {
  return `${code} — ${title}`
}
