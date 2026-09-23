/**
 * Whether a regex repeats a group that itself repeats without bound, like
 * `(a+)+` or `(.*,){20}`.
 *
 * That shape is what makes a backtracking engine take exponential (or very
 * high polynomial) time on a row that almost matches, and a JavaScript regex
 * cannot be interrupted once it starts. It is a heuristic: overlapping
 * alternation such as `(a|a)*` can also backtrack badly and is not caught.
 */
export function hasNestedRepetition(pattern: string): boolean {
  // One entry per open group: whether anything inside it repeats without bound.
  const groups: boolean[] = [false];
  let i = 0;

  /** Reads a quantifier at `i`, if any, and says whether it repeats many times. */
  const readQuantifier = (): { repeats: boolean; unbounded: boolean } | null => {
    const c = pattern[i];
    let result: { repeats: boolean; unbounded: boolean } | null = null;
    if (c === '*' || c === '+') {
      i++;
      result = { repeats: true, unbounded: true };
    } else if (c === '?') {
      i++;
      result = { repeats: false, unbounded: false };
    } else if (c === '{') {
      const match = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(i));
      if (!match) return null;
      i += match[0].length;
      const max = match[2] === undefined ? Number(match[1]) : match[3] === '' ? Infinity : Number(match[3]);
      // A small fixed count only multiplies the work; `{10,}` and up compounds it.
      result = { repeats: max >= 10, unbounded: max === Infinity };
    }
    if (result && pattern[i] === '?') i++; // lazy: same backtracking, other order
    return result;
  };

  while (i < pattern.length) {
    const c = pattern[i];

    if (c === '\\') {
      i += 2;
    } else if (c === '[') {
      i++;
      if (pattern[i] === ']') i++; // a leading ] is literal in some flavours; harmless here
      while (i < pattern.length && pattern[i] !== ']') i += pattern[i] === '\\' ? 2 : 1;
      i++;
    } else if (c === '(') {
      groups.push(false);
      i++;
      continue;
    } else if (c === ')') {
      i++;
      const innerRepeats = groups.length > 1 ? groups.pop()! : false;
      const quantifier = readQuantifier();
      if (innerRepeats && quantifier?.repeats) return true;
      // A group's unbounded contents make its parent's contents unbounded too.
      if (innerRepeats || quantifier?.unbounded) groups[groups.length - 1] = true;
      continue;
    } else {
      i++;
    }

    const quantifier = readQuantifier();
    if (quantifier?.unbounded) groups[groups.length - 1] = true;
  }

  return false;
}
