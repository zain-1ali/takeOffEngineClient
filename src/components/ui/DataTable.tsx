import {
  createContext,
  useContext,
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react'

type DataTableContextValue = { compact?: boolean }

const DataTableContext = createContext<DataTableContextValue>({})

function useDataTable() {
  return useContext(DataTableContext)
}

function DataTableRoot({
  children,
  className = '',
  compact = false,
  ...rest
}: HTMLAttributes<HTMLTableElement> & { children: ReactNode; compact?: boolean }) {
  return (
    <div className="w-full overflow-x-auto">
      <DataTableContext.Provider value={{ compact }}>
        <table
          className={`w-full border-collapse text-[13px] font-sans ${className}`}
          {...rest}
        >
          {children}
        </table>
      </DataTableContext.Provider>
    </div>
  )
}

function Header({ children, className = '', ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={className} {...rest}>
      {children}
    </thead>
  )
}

function Body({ children, className = '', ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...rest}>
      {children}
    </tbody>
  )
}

function Footer({ children, className = '', ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot className={className} {...rest}>
      {children}
    </tfoot>
  )
}

function Row({
  children,
  totals = false,
  className = '',
  ...rest
}: HTMLAttributes<HTMLTableRowElement> & { totals?: boolean }) {
  if (totals) {
    return (
      <tr
        className={`font-semibold border-t-2 border-ink [&>td]:border-b-0 [&>td]:pt-3 ${className}`}
        {...rest}
      >
        {children}
      </tr>
    )
  }
  return (
    <tr className={`border-b border-gridline hover:bg-panel/80 ${className}`} {...rest}>
      {children}
    </tr>
  )
}

function HeaderCell({
  children,
  align = 'left',
  className = '',
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  const { compact } = useDataTable()
  const pad = compact ? 'px-2 py-1.5' : 'px-2.5 py-2'
  return (
    <th
      className={`${pad} text-[11px] uppercase tracking-[0.06em] text-steel font-medium border-b border-ink ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
      {...rest}
    >
      {children}
    </th>
  )
}

function Cell({
  children,
  numeric = false,
  align,
  className = '',
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & {
  numeric?: boolean
  align?: 'left' | 'right' | 'center'
}) {
  const { compact } = useDataTable()
  const pad = compact ? 'px-2 py-1.5' : 'px-2.5 py-2.5'
  const resolvedAlign = align ?? (numeric ? 'right' : 'left')
  return (
    <td
      className={`${pad} ${numeric ? 'font-mono tabular-nums' : ''} ${
        resolvedAlign === 'right'
          ? 'text-right'
          : resolvedAlign === 'center'
            ? 'text-center'
            : 'text-left'
      } ${className}`}
      {...rest}
    >
      {children}
    </td>
  )
}

export const DataTable = Object.assign(DataTableRoot, {
  Header,
  Body,
  Footer,
  Row,
  HeaderCell,
  Cell,
})
