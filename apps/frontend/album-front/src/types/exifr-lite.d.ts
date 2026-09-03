/**
 * exifr publishes types for its main entry only, but the app imports the `lite`
 * build to keep ~30KB of format parsers it never uses out of the bundle. This
 * declares the one function that is actually called.
 */
declare module 'exifr/dist/lite.esm.mjs' {
  interface ParseOptions {
    pick?: string[];
    reviveValues?: boolean;
    translateValues?: boolean;
    [option: string]: unknown;
  }

  const exifr: {
    parse(
      input: File | Blob | ArrayBuffer | Uint8Array | string,
      options?: ParseOptions
    ): Promise<Record<string, unknown> | undefined>;
  };

  export default exifr;
}
