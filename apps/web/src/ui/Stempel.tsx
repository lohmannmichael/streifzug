import { t } from "../texte/de";

const datumKurz = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Milestone stamp ("Weiden 10 %"), like a rubber stamp in a passport.
 * `neu` lets it land with a short stamping motion (not with "reduce motion").
 */
export function Stempel(props: { name: string; prozent: number; datum: number; neu?: boolean; klein?: boolean }) {
  const klassen = ["stempel", props.neu ? "stempel-neu" : "", props.klein ? "stempel-klein" : ""].filter(Boolean).join(" ");
  return (
    <div className={klassen} role="img" aria-label={t.stempel.label(props.name, props.prozent)}>
      <span className="stempel-name">{props.name}</span>
      <span className="stempel-zahl">{props.prozent} %</span>
      <span className="stempel-datum">{datumKurz.format(props.datum)}</span>
    </div>
  );
}
