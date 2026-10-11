import { Canvas2D, CanvasEnv, MatrixLike, PathLike } from './canvas';

/** One call made on the fake context, with the styles in force when it was made. */
export interface Call {
  name: string;
  args: unknown[];
  fillStyle: unknown;
  font: string;
}

/**
 * A context that draws nothing and remembers everything. Text is measured at
 * 10 units a character, so wrapping is predictable.
 */
export const recordingContext = (): Canvas2D & { calls: Call[] } => {
  const calls: Call[] = [];
  const ctx = {
    calls,
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    lineWidth: 1,
    lineJoin: 'miter',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    measureText: (text: string) => ({ width: text.length * 10 })
  } as Canvas2D & { calls: Call[] };

  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args, fillStyle: ctx.fillStyle, font: ctx.font });
    };
  for (const name of [
    'save',
    'restore',
    'translate',
    'rotate',
    'scale',
    'beginPath',
    'rect',
    'roundRect',
    'fillRect',
    'strokeRect',
    'fill',
    'stroke',
    'fillText',
    'strokeText',
    'drawImage'
  ]) {
    (ctx as unknown as Record<string, unknown>)[name] = record(name);
  }
  return ctx;
};

/** Path2D and DOMMatrix that keep what they were made from. */
export const fakeEnv = (): CanvasEnv => {
  class FakeMatrix implements MatrixLike {
    steps: string[] = [];
    translate(x: number, y: number) {
      this.steps.push(`translate(${x},${y})`);
      return this;
    }
    scale(x: number, y: number) {
      this.steps.push(`scale(${x},${y})`);
      return this;
    }
  }
  class FakePath implements PathLike {
    parts: Array<{ path: PathLike; transform?: unknown }> = [];
    constructor(readonly d?: string) {}
    addPath(path: PathLike, transform?: unknown) {
      this.parts.push({ path, transform });
    }
  }
  return { Path2D: FakePath, DOMMatrix: FakeMatrix };
};

export const named = (calls: Call[], name: string) => calls.filter((call) => call.name === name);
