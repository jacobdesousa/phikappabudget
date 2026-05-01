export type ApplyResult = {
  text: string;
  selectionStart: number;
  selectionEnd: number;
};

function getLineStart(text: string, index: number) {
  return text.lastIndexOf("\n", Math.max(0, index - 1)) + 1;
}

function getLineEnd(text: string, index: number) {
  const next = text.indexOf("\n", index);
  return next === -1 ? text.length : next;
}

function getSelectedLineRange(text: string, selectionStart: number, selectionEnd: number) {
  const start = getLineStart(text, selectionStart);
  const end = getLineEnd(text, selectionEnd);
  return { start, end };
}

export function toggleBullets(text: string, selectionStart: number, selectionEnd: number): ApplyResult {
  const { start, end } = getSelectedLineRange(text, selectionStart, selectionEnd);
  const block = text.slice(start, end);
  const lines = block.split("\n");

  const allBulleted = lines.filter((l) => l.trim().length > 0).every((l) => l.startsWith("- "));
  const newLines = lines.map((l) => {
    if (l.trim().length === 0) return l;
    if (allBulleted) return l.startsWith("- ") ? l.slice(2) : l;
    return l.startsWith("- ") ? l : `- ${l}`;
  });

  const nextBlock = newLines.join("\n");
  const nextText = text.slice(0, start) + nextBlock + text.slice(end);

  const delta = nextBlock.length - block.length;
  return {
    text: nextText,
    selectionStart,
    selectionEnd: selectionEnd + delta,
  };
}

export function toggleNumbering(text: string, selectionStart: number, selectionEnd: number): ApplyResult {
  const { start, end } = getSelectedLineRange(text, selectionStart, selectionEnd);
  const block = text.slice(start, end);
  const lines = block.split("\n");

  const numberedRe = /^\d+\.\s/;
  const allNumbered = lines.filter((l) => l.trim().length > 0).every((l) => numberedRe.test(l));

  let n = 1;
  const newLines = lines.map((l) => {
    if (l.trim().length === 0) return l;
    if (allNumbered) return l.replace(numberedRe, "");
    if (numberedRe.test(l)) return l; // don't double-number
    const prefixed = `${n}. ${l}`;
    n += 1;
    return prefixed;
  });

  const nextBlock = newLines.join("\n");
  const nextText = text.slice(0, start) + nextBlock + text.slice(end);
  const delta = nextBlock.length - block.length;

  return {
    text: nextText,
    selectionStart,
    selectionEnd: selectionEnd + delta,
  };
}

export type MinutesBlock =
  | { type: "empty" }
  | { type: "ul"; items: string[] }
  | { type: "p"; text: string };

// Parses a minutes text area into blocks. Bullets are lines starting with "- ".
export function parseMinutesText(text?: string | null): MinutesBlock[] {
  const t = (text ?? "").trimEnd();
  if (!t.trim()) return [{ type: "empty" }];

  const lines = t.split("\n");
  const out: MinutesBlock[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      out.push({ type: "ul", items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && !lines[i].startsWith("- ") && lines[i].trim() !== "") {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length) {
      out.push({ type: "p", text: para.join("\n") });
      continue;
    }

    i += 1;
  }

  return out.length ? out : [{ type: "empty" }];
}


