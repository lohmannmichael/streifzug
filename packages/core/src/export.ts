/**
 * Export (Bauplan 3, A3): every way as a GPX file, all packed into one zip. No library: GPX is
 * plain text, and the zip format is small enough to write here (compression by the browser).
 */
import type { Fix } from "./track";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * One way as GPX 1.1. Accuracy, motion and speed are kept in an extension, so that importing the
 * file again gives the same legs (on foot, bike, driven) as before.
 */
export function gpxAus(fixes: readonly Fix[], name: string): string {
  const punkte = fixes.map((f) => {
    const ext = [`<u:hAcc>${f.acc}</u:hAcc>`, f.motion?.length ? `<u:motion>${xml(f.motion.join(","))}</u:motion>` : "", f.speed !== undefined ? `<u:speed>${f.speed}</u:speed>` : ""].join("");
    return `<trkpt lat="${f.lat.toFixed(7)}" lon="${f.lon.toFixed(7)}"><time>${new Date(f.t).toISOString()}</time><extensions>${ext}</extensions></trkpt>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Unterwegs" xmlns="http://www.topografix.com/GPX/1/1" xmlns:u="https://streifzug.pages.dev/gpx">',
    `<trk><name>${xml(name)}</name><trkseg>`,
    ...punkte,
    "</trkseg></trk>",
    "</gpx>",
    "",
  ].join("\n");
}

const TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(daten: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < daten.length; i++) c = TABELLE[(c ^ daten[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipDatei {
  name: string;
  daten: Uint8Array;
}

/** Deflates with the browser's (or Node's) CompressionStream; null where it is missing. */
async function deflate(daten: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const strom = new Blob([daten as never]).stream().pipeThrough(new CompressionStream("deflate-raw" as never));
    return new Uint8Array(await new Response(strom).arrayBuffer());
  } catch {
    return null;
  }
}

/** Builds a zip file (deflated where possible, otherwise stored). `fortschritt` gets 0–1. */
export async function zipErstellen(dateien: readonly ZipDatei[], fortschritt?: (anteil: number) => void): Promise<Uint8Array> {
  const teile: Uint8Array[] = [];
  const verzeichnis: Uint8Array[] = [];
  let versatz = 0;
  const enc = new TextEncoder();
  const jetzt = new Date();
  const dosZeit = ((jetzt.getHours() << 11) | (jetzt.getMinutes() << 5) | (jetzt.getSeconds() >> 1)) & 0xffff;
  const dosDatum = (((jetzt.getFullYear() - 1980) << 9) | ((jetzt.getMonth() + 1) << 5) | jetzt.getDate()) & 0xffff;
  for (let i = 0; i < dateien.length; i++) {
    const d = dateien[i]!;
    const name = enc.encode(d.name);
    const crc = crc32(d.daten);
    const gepackt = await deflate(d.daten);
    const methode = gepackt && gepackt.length < d.daten.length ? 8 : 0;
    const inhalt = methode === 8 ? gepackt! : d.daten;
    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034b50, true);
    kopf.setUint16(4, 20, true);
    kopf.setUint16(6, 0x0800, true); // names in UTF-8
    kopf.setUint16(8, methode, true);
    kopf.setUint16(10, dosZeit, true);
    kopf.setUint16(12, dosDatum, true);
    kopf.setUint32(14, crc, true);
    kopf.setUint32(18, inhalt.length, true);
    kopf.setUint32(22, d.daten.length, true);
    kopf.setUint16(26, name.length, true);
    kopf.setUint16(28, 0, true);
    teile.push(new Uint8Array(kopf.buffer), name, inhalt);
    const z = new DataView(new ArrayBuffer(46));
    z.setUint32(0, 0x02014b50, true);
    z.setUint16(4, 20, true);
    z.setUint16(6, 20, true);
    z.setUint16(8, 0x0800, true);
    z.setUint16(10, methode, true);
    z.setUint16(12, dosZeit, true);
    z.setUint16(14, dosDatum, true);
    z.setUint32(16, crc, true);
    z.setUint32(20, inhalt.length, true);
    z.setUint32(24, d.daten.length, true);
    z.setUint16(28, name.length, true);
    z.setUint32(42, versatz, true);
    verzeichnis.push(new Uint8Array(z.buffer), name);
    versatz += 30 + name.length + inhalt.length;
    fortschritt?.((i + 1) / dateien.length);
  }
  const groesse = verzeichnis.reduce((s, x) => s + x.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true);
  ende.setUint16(8, dateien.length, true);
  ende.setUint16(10, dateien.length, true);
  ende.setUint32(12, groesse, true);
  ende.setUint32(16, versatz, true);
  const alle = [...teile, ...verzeichnis, new Uint8Array(ende.buffer)];
  const out = new Uint8Array(alle.reduce((s, x) => s + x.length, 0));
  let p = 0;
  for (const x of alle) {
    out.set(x, p);
    p += x.length;
  }
  return out;
}
