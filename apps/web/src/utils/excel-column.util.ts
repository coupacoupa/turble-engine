/** 0-based column index → Excel-style letter ("A", "B", ..., "AA"). */
export function getExcelColumnLetter(index: number): string {
  let letter = "";
  let curr = index;
  while (curr >= 0) {
    letter = String.fromCharCode((curr % 26) + 65) + letter;
    curr = Math.floor(curr / 26) - 1;
  }
  return letter;
}
