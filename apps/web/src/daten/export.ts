import { fragen } from "./arbeiter";

/**
 * "Alles exportieren" (Bauplan 3, A3): every way as GPX plus one JSON file with settings,
 * exceptions ("Hier komme ich nicht hin") and the stamps given, with their dates. Packed in the
 * background worker; the result is a zip file to share or save.
 */
function lesen(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

export async function exportVorbereiten(): Promise<{ datei: File; wege: number }> {
  const daten = {
    app: "Unterwegs",
    exportiertAm: new Date().toISOString(),
    einstellungen: lesen("streifzug.einstellungen"),
    ausnahmen: lesen("streifzug.ausnahmen") ?? [],
    stempel: lesen("streifzug.stempel") ?? [],
  };
  const lies = [
    "Unterwegs: Export",
    "",
    "wege/  jeder Weg als GPX-Datei (lässt sich in Unterwegs unter Einstellungen wieder importieren, auch in vielen anderen Apps)",
    "unterwegs.json  Einstellungen, Ausnahmen („Hier komme ich nicht hin“) und vergebene Stempel mit Datum",
    "",
  ].join("\n");
  const a = await fragen<"exportFertig">({
    typ: "export",
    extra: [
      { name: "unterwegs.json", text: JSON.stringify(daten, null, 2) },
      { name: "LIESMICH.txt", text: lies },
    ],
  }).antwort;
  const tag = new Date().toISOString().slice(0, 10);
  return { datei: new File([a.zip as BlobPart], `unterwegs-${tag}.zip`, { type: "application/zip" }), wege: a.wege };
}

/** Opens the share sheet (iPhone: "In Dateien sichern"); without it, downloads the file. */
export async function teilenOderLaden(datei: File): Promise<void> {
  if (navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: datei.name });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement("a");
  a.href = url;
  a.download = datei.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
