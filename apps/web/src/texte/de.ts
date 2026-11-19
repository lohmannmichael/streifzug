/** All visible texts in one place, so English can follow later. */
export const de = {
  app: { name: "Streifzug" },
  tabs: { karte: "Karte", gebiete: "Gebiete", ich: "Ich" },
  karte: {
    gebiet: "Weiden",
    oberGebiet: "Lindenthal, Köln",
    prozentLabel: "der Straßen entdeckt",
    leer: "Noch keine Straße markiert. Jede Straße, die du gehst oder fährst, wird hier gelb.",
    losziehen: "Losziehen",
    bald: "Das Aufzeichnen kommt im nächsten Bauschritt.",
    standort: "Zu meinem Standort",
    kartenRegion: "Karte",
  },
  gebiete: {
    titel: "Gebiete",
    leer: "Hier erscheinen deine Städte, Bezirke und Stadtteile, sobald du losgezogen bist. Mit Prozent und Kilometern.",
  },
  ich: {
    titel: "Ich",
    zaehlen: "Was zählt",
    wege: "Fuß- und Radwege mitzählen",
    wegeHinweis: "Gehwege direkt neben Straßen zählen nie doppelt.",
    auto: "Autofahrten mitzählen",
    autoHinweis: "Erscheinen als eigener Wert, getrennt von Fuß und Rad.",
    daten: "Deine Daten",
    datenHinweis: "Exportieren und Löschen kommen mit der Anmeldung.",
    quelle: "Kartendaten © OpenStreetMap-Mitwirkende",
  },
} as const;

export const t = de;
