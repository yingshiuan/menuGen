import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { isSpreadsheet, readWorkbook } from '@/domain/menuSheet'

function workbookFile(sheets: Record<string, unknown[][]>, name = 'menu.xlsx') {
  const wb = XLSX.utils.book_new()
  for (const [sheet, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheet)
  }
  return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], name)
}

describe('isSpreadsheet', () => {
  it('recognises Excel and Numbers files in any case, but not CSV', () => {
    expect(['a.xlsx', 'a.XLS', 'afatt menu.numbers'].every(isSpreadsheet)).toBe(true)
    expect(['a.csv', 'a.numbers.csv', 'a.png'].some(isSpreadsheet)).toBe(false)
  })
})

describe('readWorkbook', () => {
  it('lists the filled sheets in workbook order', async () => {
    const wb = await readWorkbook(workbookFile({ menu: [['No.']], empty: [], drinks: [['No.']] }))

    expect(wb.sheetNames).toEqual(['menu', 'drinks'])
  })

  it('turns a sheet into CSV with plain numbers and without blank rows', async () => {
    const wb = await readWorkbook(
      workbookFile({
        menu: [
          ['No.', 'Price', 'Name (EN)', 'Description (DE)'],
          [null, null, 'SOUP / SALAD', null],
          [],
          [1, 8.5, 'Szechuan Soup', 'Gemüse, Tofu'],
        ],
      }),
    )

    expect(wb.toCsv('menu').split('\n')).toEqual([
      'No.,Price,Name (EN),Description (DE)',
      ',,SOUP / SALAD,',
      '1,8.5,Szechuan Soup,"Gemüse, Tofu"',
    ])
  })

  it('rejects a file that is not really a spreadsheet', async () => {
    await expect(readWorkbook(new File(['No.,Price'], 'menu.numbers'))).rejects.toThrow()
    await expect(readWorkbook(new File(['PK\x03\x04'], 'menu.xls'))).rejects.toThrow()
  })
})
