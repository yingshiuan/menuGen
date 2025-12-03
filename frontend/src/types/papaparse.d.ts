declare module "papaparse" {
  interface ParseConfig<T> {
    header?: boolean;
    skipEmptyLines?: boolean;
    complete?: (results: { data: T[] }) => void;
  }

  function parse<T>(input: string | File, config?: ParseConfig<T>): void;

  const Papa: {
    parse: typeof parse;
  };

  export default Papa;
}
