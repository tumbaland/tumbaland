/**
 * The part of a canvas 2D context the collage drawing uses.
 *
 * Written out here rather than taken from the DOM because this library also
 * runs on the server, where the context comes from @napi-rs/canvas. A browser's
 * CanvasRenderingContext2D and the server's context both fit it as they are.
 * Styles are `unknown` because each side has its own gradient and pattern
 * types; this code only ever assigns strings to them.
 */
export interface Canvas2D {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  scale(x: number, y: number): void;

  fillStyle: unknown;
  strokeStyle: unknown;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetY: number;
  lineWidth: number;
  lineJoin: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  /** A CSS filter such as blur(8px). Optional: a browser without it draws unfiltered. */
  filter?: string;
  /** The current transform, to turn canvas units into the pixels a filter is measured in. */
  getTransform?(): { a: number; b: number };

  beginPath(): void;
  rect(x: number, y: number, width: number, height: number): void;
  clip(): void;
  roundRect?(x: number, y: number, width: number, height: number, radius: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  fill(path?: unknown): void;
  stroke(path?: unknown): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  strokeText(text: string, x: number, y: number, maxWidth?: number): void;
  measureText(text: string): { width: number };
  drawImage(
    image: unknown,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void;
}

export interface PathLike {
  addPath(path: PathLike, transform?: unknown): void;
}

export interface MatrixLike {
  translate(x: number, y: number): MatrixLike;
  scale(x: number, y: number): MatrixLike;
}

/**
 * Where Path2D and DOMMatrix come from. A browser has them as globals; on the
 * server @napi-rs/canvas exports its own, and passes them in.
 */
export interface CanvasEnv {
  Path2D: new (path?: string) => PathLike;
  DOMMatrix: new () => MatrixLike;
}

/** The browser's own, read when the drawing happens rather than when this loads. */
export const globalCanvasEnv = (): CanvasEnv => {
  const scope = globalThis as unknown as Partial<CanvasEnv>;
  if (!scope.Path2D || !scope.DOMMatrix) {
    throw new Error('No Path2D here: pass a CanvasEnv to draw shapes outside a browser');
  }
  return { Path2D: scope.Path2D, DOMMatrix: scope.DOMMatrix };
};
