/** A spreadsheet (.xlsx / .xls / .numbers) opened in the browser, one CSV per sheet. */
export interface Workbook {
  sheetNames: string[]
  toCsv(sheetName: string): string
}

const SPREADSHEET = /\.(xlsx|xls|numbers)$/i

export function isSpreadsheet(fileName: string): boolean {
  return SPREADSHEET.test(fileName)
}

function readArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

// SheetJS reads anything it can't recognise as a one-cell text sheet, so a broken or
// pre-2013 package-folder .numbers would load as junk; check the container first.
const ZIP = [0x50, 0x4b, 0x03, 0x04] // .xlsx, .numbers
const CFB = [0xd0, 0xcf, 0x11, 0xe0] // legacy .xls

function hasSignature(bytes: Uint8Array, fileName: string): boolean {
  const magic = /\.xls$/i.test(fileName) ? CFB : ZIP
  return magic.every((b, i) => bytes[i] === b)
}

/**
 * SheetJS is loaded on demand, so a CSV-only visit never downloads it. Each sheet becomes CSV
 * text from the cells' formatted values (1.0 → "1"), so it goes through the same parser as an
 * uploaded CSV. Sheets without any cell are left out.
 */
export async function readWorkbook(file: File): Promise<Workbook> {
  const bytes = new Uint8Array(await readArrayBuffer(file))
  if (!hasSignature(bytes, file.name)) throw new Error(`${file.name} is not a spreadsheet`)
  const XLSX = await import('xlsx')
  const wb = XLSX.read(bytes, { type: 'array' })
  const sheetNames = wb.SheetNames.filter((name) => wb.Sheets[name]?.['!ref'])
  return {
    sheetNames,
    toCsv: (name) => XLSX.utils.sheet_to_csv(wb.Sheets[name]!, { blankrows: false }),
  }
}
