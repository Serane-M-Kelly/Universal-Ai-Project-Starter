/**
 * Removes only comments that occupy whole lines, in a deliberately small set of languages whose
 * comments never execute: JavaScript/TypeScript without JSX, Python and POSIX shells. Code before or
 * after a comment on the same line is always kept. Any doubt keeps the text: a kept comment can only
 * cause a cautious refusal, a removed line of code could hide a dependency on a document. Doubt covers
 * other languages (Go `//go:embed`, PHP annotations, Ruby `#{}`, make `$(shell)`, JSX/Vue/Svelte/Astro
 * markup), unusual line terminators, heredocs, unterminated constructs and directive-like comments.
 */
const SLASH = new Set(["js", "mjs", "cjs", "ts", "mts", "cts"]);
const HASH = new Set(["py", "sh", "bash", "zsh"]);
// Comments carrying these markers may be read by a tool (bundler magic comments, annotations, directives).
const DIRECTIVE = /@|webpack|vite|turbopack|rollup|parcel|esbuild|import|require|include|embed|glob|<reference|sourcemap|#|go:|%|\$\{|\$\(|`/i;
// Lone carriage returns and Unicode line separators end comments for engines but not for this scanner.
const UNUSUAL_LINE_ENDS = /\r(?!\n)|[\u2028\u2029\u0085]/;
// JSX text treats "//" literally; markup files mix languages.
const JSX = /<\/[A-Za-z]|\/>|<>|<[A-Z][\w.]*[\s>]/;
// A slash after one of these characters (or at the start) begins a regular expression literal.
const REGEX_PRECEDES = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);

type Range = { start: number; end: number };

/** Comment ranges of C-like source; quotes, templates and regex literals are skipped. */
function slashComments(text: string): Range[] | null {
  const out: Range[] = [];
  const stack: ("tpl" | "brace")[] = [];
  let i = 0, previous = "";
  const word = () => /(?:^|[^\w$])(return|typeof|case|do|else|in|of|void|yield|await|delete|throw|new)$/.test(text.slice(Math.max(0, i - 12), i).trimEnd());
  while (i < text.length) {
    const c = text[i]!, n = text[i + 1];
    if (stack.at(-1) === "tpl") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { stack.pop(); i++; previous = "`"; continue; }
      if (c === "$" && n === "{") { stack.push("brace"); i += 2; previous = "{"; continue; }
      i++; continue;
    }
    if (c === "/" && n === "/") {
      const end = text.indexOf("\n", i);
      out.push({ start: i, end: end < 0 ? text.length : end });
      i = end < 0 ? text.length : end; continue;
    }
    if (c === "/" && n === "*") {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) return null;
      out.push({ start: i, end: end + 2 });
      i = end + 2; continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== c && text[j] !== "\n") j += text[j] === "\\" ? 2 : 1;
      if (text[j] !== c) return null;
      i = j + 1; previous = c; continue;
    }
    if (c === "`") { stack.push("tpl"); i++; continue; }
    if (c === "{" ) { if (stack.length) stack.push("brace"); i++; previous = c; continue; }
    if (c === "}") { if (stack.at(-1) === "brace") { stack.pop(); i++; previous = "}"; continue; } i++; previous = c; continue; }
    if (c === "/" && (REGEX_PRECEDES.has(previous) || word())) {
      let j = i + 1, inClass = false;
      while (j < text.length && text[j] !== "\n" && (inClass || text[j] !== "/")) {
        if (text[j] === "\\") j++;
        else if (text[j] === "[") inClass = true;
        else if (text[j] === "]") inClass = false;
        j++;
      }
      if (text[j] !== "/") return null;
      i = j + 1; previous = "/regex"; continue;
    }
    if (c === "\\") { i += 2; previous = "\\"; continue; }
    if (!/\s/.test(c)) previous = c;
    i++;
  }
  return stack.length ? null : out;
}

/** Comment ranges of hash-comment languages; quotes and Python triple quotes are skipped. Heredocs: doubt. */
function hashComments(text: string, python: boolean): Range[] | null {
  if (!python && /<<[-~]?\s*\\?['"]?\w+/.test(text)) return null;
  const out: Range[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === "#") {
      const end = text.indexOf("\n", i);
      out.push({ start: i, end: end < 0 ? text.length : end });
      i = end < 0 ? text.length : end; continue;
    }
    if (c === "'" || c === '"') {
      const triple = python && text.startsWith(c.repeat(3), i);
      const close = triple ? c.repeat(3) : c;
      let j = i + close.length;
      while (j < text.length && !text.startsWith(close, j)) {
        if (text[j] === "\\") j++;
        else if (!triple && python && text[j] === "\n") return null;
        j++;
      }
      if (j >= text.length) return null;
      i = j + close.length; continue;
    }
    if (c === "\\") { i += 2; continue; }
    i++;
  }
  return out;
}

export function withoutWholeLineComments(path: string, text: string): string {
  const name = path.split("/").at(-1)!, ext = name.includes(".") ? name.split(".").at(-1)!.toLowerCase() : "";
  if (UNUSUAL_LINE_ENDS.test(text)) return text;
  // TypeScript forbids JSX outside .tsx; plain JavaScript files may contain it.
  if (["js", "mjs", "cjs"].includes(ext) && JSX.test(text)) return text;
  const ranges = SLASH.has(ext) ? slashComments(text) : HASH.has(ext) ? hashComments(text, ext === "py") : null;
  if (!ranges?.length) return text;
  const lines = text.split("\n"), drop = new Set<number>();
  const starts = [0];
  for (let k = text.indexOf("\n"); k >= 0; k = text.indexOf("\n", k + 1)) starts.push(k + 1);
  const lineAt = (offset: number) => {
    let low = 0, high = starts.length - 1;
    while (low < high) { const mid = (low + high + 1) >> 1; if (starts[mid]! <= offset) low = mid; else high = mid - 1; }
    return low;
  };
  for (const { start, end } of ranges) {
    const first = lineAt(start), last = lineAt(Math.max(start, end - 1));
    const before = text.slice(text.lastIndexOf("\n", start - 1) + 1, start);
    const lineEnd = text.indexOf("\n", end);
    const after = text.slice(end, lineEnd < 0 ? text.length : lineEnd);
    // Shebangs and directive-like comments stay; any code sharing a line with the comment keeps it.
    const body = text.slice(start, end).replace(/^(\/\/|\/\*+|#)/, "").replace(/\*\/$/, "");
    if (before.trim() || after.trim() || text.startsWith("#!", start) || DIRECTIVE.test(body)) continue;
    for (let line = first; line <= last; line++) drop.add(line);
  }
  return lines.filter((_, index) => !drop.has(index)).join("\n");
}
