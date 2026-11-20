/** "12:05" while running (uhr), otherwise "1 Std. 5 Min." / "12 Min.". */
export function dauerText(sekunden: number, uhr = false): string {
  const h = Math.floor(sekunden / 3600);
  const m = Math.floor((sekunden % 3600) / 60);
  const s = sekunden % 60;
  if (uhr) return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  return h ? `${h} Std. ${m} Min.` : `${Math.max(1, m)} Min.`;
}
