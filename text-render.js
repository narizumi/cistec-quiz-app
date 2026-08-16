(function (global) {
  "use strict";

  /**
   * text を underlineRanges([[start,end], ...])に基づいてセグメントに分割する。
   * 戻り値は { text: string, underline: boolean } の配列。
   * range は文字インデックス(endはexclusive)。範囲外・不正な値は無視する。
   */
  function splitTextByRanges(text, underlineRanges) {
    if (!text) return [];
    const ranges = (underlineRanges || [])
      .filter((r) => Array.isArray(r) && r.length === 2 && r[0] >= 0 && r[1] > r[0] && r[1] <= text.length)
      .slice()
      .sort((a, b) => a[0] - b[0]);

    const segments = [];
    let pos = 0;
    for (const [start, end] of ranges) {
      if (start > pos) segments.push({ text: text.slice(pos, start), underline: false });
      if (start >= pos) {
        segments.push({ text: text.slice(Math.max(start, pos), end), underline: true });
        pos = end;
      }
      // start < pos の場合(範囲が重なっている)は、既にposまで処理済みなのでスキップする。
    }
    if (pos < text.length) segments.push({ text: text.slice(pos), underline: false });
    return segments;
  }

  const TextRender = { splitTextByRanges };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = TextRender;
  } else {
    global.TextRender = TextRender;
  }
})(typeof window !== "undefined" ? window : globalThis);
