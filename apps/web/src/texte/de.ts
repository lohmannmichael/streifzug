/** All visible texts in one place, so English can follow later. */
export const de = {
  app: { name: "Streifzug" },
  tabs: { karte: "Karte", gebiete: "Gebiete", streifzuege: "Streifzüge" },
  karte: {
    prozentLabel: "der Straßen entdeckt",
    kmZeile: (gesehen: string, gesamt: string) => `${gesehen} von ${gesamt} entdeckt`,
    kmLaedt: "Straßen werden gezählt …",
    leer: "Noch keine Straße markiert. Jede Straße, die du gehst oder fährst, wird hier gelb.",
    losziehen: "Losziehen",
    bald: "Das Aufzeichnen kommt im nächsten Bauschritt.",
    profil: "Profil und Einstellungen",
    kartenRegion: (gebiet: string) => `Karte, ausgewählt: ${gebiet}. Noch keine Straße entdeckt. Stadtteile lassen sich durch Antippen wählen.`,
  },
  gebiete: {
    titel: "Gebiete",
    stadtZeile: (gesamt: string, anzahl: number) => `${gesamt} Straßen in ${anzahl} Gebieten`,
    zeile: (gesamt: string) => `0 % von ${gesamt}`,
    stand: (datum: string) => `Straßendaten: OpenStreetMap, Stand ${datum}`,
    leer: "Hier sammelst du deine Stadtteile, Bezirke und Städte. Jeder bekommt eine Karte mit Prozent und Kilometern, sobald du losgezogen bist.",
  },
  streifzuege: {
    titel: "Streifzüge",
    leer: "Jede Runde landet hier, mit Kartenausschnitt, Kilometern und neuen Straßen. Meilensteine kannst du teilen.",
  },
  ich: {
    titel: "Profil",
    zurueck: "Zurück zur Karte",
    zaehlen: "Was zählt",
    wege: "Fuß- und Radwege mitzählen",
    wegeHinweis: "Gehwege direkt neben Straßen zählen nie doppelt.",
    auto: "Autofahrten mitzählen",
    autoHinweis: "Erscheinen als eigener Wert, getrennt von Fuß und Rad.",
    konto: "Konto",
    kontoAnonym: "Du nutzt Streifzug ohne Konto. Deine Einstellungen werden schon gesichert. Ein Konto, mit dem du alles auf andere Geräte mitnimmst, kommt bald.",
    kontoOffline: "Gerade offline. Alles wird gespeichert und später abgeglichen.",
    kontoLaedt: "Verbinde …",
    daten: "Deine Daten",
    datenHinweis: "Exportieren und Löschen kommen mit dem Konto.",
    quelle: "Kartendaten © OpenStreetMap-Mitwirkende. Gebietsgrenzen: Overture Maps (OpenStreetMap, ODbL).",
  },
} as const;

export const t = de;
