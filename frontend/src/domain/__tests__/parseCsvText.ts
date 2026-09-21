import Papa from 'papaparse'
import { parseMenuRows, type ParsedMenu } from '@/domain/menuCsv'

type Rows = Papa.ParseResult<Record<string, string>>

/** Parse CSV text the way CsvUpload does (papaparse runs synchronously on a string). */
export function parseCsvText(csv: string): ParsedMenu {
  let result: Rows | undefined
  Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    complete: (r) => (result = r as Rows),
  })
  let n = 0
  return parseMenuRows(result!.data, result!.meta.fields ?? [], () => `id-${++n}`)
}
