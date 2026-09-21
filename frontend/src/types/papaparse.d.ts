declare module 'papaparse' {
  interface ParseConfig<T> {
    header?: boolean
    skipEmptyLines?: boolean
    complete?: (results: { data: T[] }) => void
  }

  function parse<T>(input: string | File, config?: ParseConfig<T>): void

  function unparse(data: { fields: string[]; data: string[][] }): string

  const Papa: {
    parse: typeof parse
    unparse: typeof unparse
  }

  export default Papa
}
