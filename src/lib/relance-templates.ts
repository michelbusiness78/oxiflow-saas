import { fmtEur, fmtDate } from '@/lib/format';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RelanceNiveau = 1 | 2 | 3;

export interface TemplateData {
  numero_facture: string;
  date_facture:   string;
  date_echeance:  string;
  montant_ttc:    number;
  nom_client:     string;
  nom_societe:    string;
  tel_societe:    string;
}

// ─── Templates email 3 niveaux ────────────────────────────────────────────────

export function getEmailTemplate(
  niveau: RelanceNiveau,
  data: TemplateData,
): { objet: string; corps: string } {
  const { numero_facture, date_facture, date_echeance, montant_ttc, nom_client, nom_societe, tel_societe } = data;
  const montantStr  = fmtEur(montant_ttc);
  const dateFactStr = fmtDate(date_facture);
  const dateEchStr  = fmtDate(date_echeance);

  if (niveau === 1) {
    return {
      objet: `Rappel — Facture ${numero_facture} en attente de règlement`,
      corps: `Bonjour,

Nous vous contactons concernant la facture ${numero_facture} du ${dateFactStr} d'un montant de ${montantStr}, dont l'échéance était fixée au ${dateEchStr}.

À ce jour, nous n'avons pas encore reçu votre règlement. Il s'agit peut-être d'un simple oubli, aussi nous nous permettons de vous adresser ce rappel amiable.

Merci de bien vouloir procéder au règlement dans les meilleurs délais ou de nous contacter si vous avez des questions.

Cordialement,
${nom_societe}
${tel_societe}`,
    };
  }

  if (niveau === 2) {
    return {
      objet: `2e relance — Facture ${numero_facture} impayée`,
      corps: `Bonjour,

Malgré notre premier rappel, nous constatons que la facture ${numero_facture} du ${dateFactStr}, d'un montant de ${montantStr} (échéance : ${dateEchStr}), reste à ce jour impayée.

Nous vous prions de bien vouloir régulariser cette situation dans un délai de 8 jours. Sans retour de votre part, nous nous verrions dans l'obligation d'engager une procédure de recouvrement.

Pour tout arrangement ou renseignement, notre équipe reste à votre disposition.

Cordialement,
${nom_societe}
${tel_societe}`,
    };
  }

  // niveau 3
  return {
    objet: `URGENT — Mise en demeure — Facture ${numero_facture}`,
    corps: `Bonjour ${nom_client},

Par la présente, nous vous mettons en demeure de régler sous 48 heures la somme de ${montantStr} correspondant à la facture ${numero_facture} du ${dateFactStr} (échéance : ${dateEchStr}), demeurée impayée malgré nos relances.

À défaut de règlement dans ce délai, nous engagerons sans autre avertissement les voies de recouvrement appropriées, dont les frais resteront à votre charge.

Cordialement,
${nom_societe}
${tel_societe}`,
  };
}
