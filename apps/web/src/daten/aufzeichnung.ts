import { acceptFix, summarize, type Fix } from "@streifzug/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { hochladen } from "./hochladen";
import { alleLaden, melden, speichern, type Streifzug } from "./speicher";

export type GpsZustand = "suche" | "gut" | "schwach" | "verweigert" | "fehler";

export interface Aufzeichnung {
  aktiv: boolean;
  fixes: Fix[];
  distanzM: number;
  startedAt: number | null;
  gps: GpsZustand;
  letzter: Streifzug | null;
  starten: () => void;
  beenden: () => void;
}

const SICHERN_ALLE_MS = 10_000;

/**
 * Records an outing in the browser: GPS while the app is open, screen kept on (Wake Lock),
 * saved on the device every few seconds, uploaded when finished.
 */
export function useAufzeichnung(): Aufzeichnung {
  const [aktiv, setAktiv] = useState(false);
  const [fixes, setFixes] = useState<Fix[]>([]);
  const [gps, setGps] = useState<GpsZustand>("suche");
  const [letzter, setLetzter] = useState<Streifzug | null>(null);
  const laufend = useRef<Streifzug | null>(null);
  const watch = useRef<number | null>(null);
  const sperre = useRef<WakeLockSentinel | null>(null);
  const gesichert = useRef(0);

  const bildschirmAn = useCallback(async () => {
    try {
      sperre.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      sperre.current = null;
    }
  }, []);

  // An outing left running (app closed or crashed) is finished at its last position.
  useEffect(() => {
    void alleLaden().then(async (liste) => {
      for (const s of liste.filter((x) => x.status === "aktiv")) {
        const sum = summarize(s.fixes);
        await speichern({ ...s, status: "lokal", endedAt: s.fixes.at(-1)?.t ?? s.startedAt, distanceM: sum.distanceM, mode: sum.mode });
      }
      melden();
      void hochladen();
    });
  }, []);

  // The screen lock is released when the page is hidden; take it again when coming back.
  useEffect(() => {
    const zurueck = () => {
      if (document.visibilityState === "visible" && laufend.current) void bildschirmAn();
    };
    document.addEventListener("visibilitychange", zurueck);
    return () => document.removeEventListener("visibilitychange", zurueck);
  }, [bildschirmAn]);

  const starten = useCallback(() => {
    if (laufend.current) return;
    const s: Streifzug = { id: crypto.randomUUID(), startedAt: Date.now(), endedAt: null, fixes: [], distanceM: 0, mode: "foot", status: "aktiv" };
    laufend.current = s;
    gesichert.current = Date.now();
    setFixes([]);
    setGps("suche");
    setAktiv(true);
    setLetzter(null);
    void speichern(s);
    void bildschirmAn();
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        const s = laufend.current;
        if (!s) return;
        const fix: Fix = { t: p.timestamp, lon: p.coords.longitude, lat: p.coords.latitude, acc: p.coords.accuracy };
        setGps(fix.acc <= 25 ? "gut" : "schwach");
        if (!acceptFix(s.fixes.at(-1) ?? null, fix)) return;
        s.fixes.push(fix);
        setFixes([...s.fixes]);
        if (Date.now() - gesichert.current > SICHERN_ALLE_MS) {
          gesichert.current = Date.now();
          void speichern({ ...s, fixes: [...s.fixes] });
        }
      },
      (e) => setGps(e.code === e.PERMISSION_DENIED ? "verweigert" : "fehler"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 },
    );
  }, [bildschirmAn]);

  const beenden = useCallback(() => {
    const s = laufend.current;
    if (!s) return;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    void sperre.current?.release().catch(() => undefined);
    sperre.current = null;
    laufend.current = null;
    setAktiv(false);
    const sum = summarize(s.fixes);
    const fertig: Streifzug = { ...s, fixes: [...s.fixes], endedAt: Date.now(), distanceM: sum.distanceM, mode: sum.mode, status: "lokal" };
    setLetzter(fertig);
    void speichern(fertig).then(() => {
      melden();
      return hochladen();
    });
  }, []);

  const distanzM = summarize(fixes).distanceM;
  return { aktiv, fixes, distanzM, startedAt: laufend.current?.startedAt ?? null, gps, letzter, starten, beenden };
}

/** All outings on this device, newest first, updated live. */
export function useStreifzuege(): Streifzug[] {
  const [liste, setListe] = useState<Streifzug[]>([]);
  useEffect(() => {
    const laden = () => void alleLaden().then((l) => setListe(l.filter((s) => s.status !== "aktiv").sort((a, b) => b.startedAt - a.startedAt)));
    laden();
    window.addEventListener("streifzug-aenderung", laden);
    return () => window.removeEventListener("streifzug-aenderung", laden);
  }, []);
  return liste;
}
