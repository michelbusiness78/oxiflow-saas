import { LegalLayout } from '@/components/marketing/LegalLayout';

export const metadata = {
  title: 'Mentions légales',
  description: 'Mentions légales du site OxiFlow.',
  openGraph: {
    title:       'Mentions légales — OxiFlow',
    description: 'Mentions légales du site OxiFlow.',
    type:        'website' as const,
    locale:      'fr_FR',
    images:      [{ url: '/og-image.svg', width: 1200, height: 630 }],
  },
  twitter: {
    card:   'summary_large_image' as const,
    images: ['/og-image.svg'],
  },
};

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales" lastUpdated="mars 2026">

      <p>
        Conformément aux dispositions de la loi n°&nbsp;2004-575 du 21 juin 2004 pour la Confiance
        dans l&apos;Économie Numérique (LCEN), les informations suivantes sont mises à disposition
        des utilisateurs du site <strong>oxiflow.fr</strong> et de l&apos;application <strong>oxiflow.fr</strong>.
      </p>

      <h2>1. Éditeur du site</h2>
      <ul>
        <li>Raison sociale : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>Forme juridique : <span className="placeholder">[À COMPLÉTER — ex. SAS, SARL]</span></li>
        <li>Capital social : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>Siège social : <span className="placeholder">[À COMPLÉTER — adresse complète]</span></li>
        <li>SIRET : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>RCS : <span className="placeholder">[À COMPLÉTER — ville d&apos;immatriculation + numéro]</span></li>
        <li>Numéro TVA intracommunautaire : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>Email : <a href="mailto:contact@oxilabs.fr">contact@oxilabs.fr</a></li>
      </ul>

      <h2>2. Directeur de la publication</h2>
      <ul>
        <li>Nom : <span className="placeholder">[À COMPLÉTER — nom et prénom du dirigeant]</span></li>
        <li>Qualité : <span className="placeholder">[À COMPLÉTER — ex. Président, Gérant]</span></li>
        <li>Contact : <a href="mailto:contact@oxilabs.fr">contact@oxilabs.fr</a></li>
      </ul>

      <h2>3. Hébergeur</h2>
      <ul>
        <li>Société : <strong>Vercel Inc.</strong></li>
        <li>Adresse : 440 N Barranca Ave #4133, Covina, CA 91723, USA</li>
        <li>Site web : <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a></li>
      </ul>
      <p>
        Les serveurs applicatifs sont localisés dans la région <strong>fra1 (Francfort, Allemagne)</strong>.
        La base de données est hébergée par <strong>Supabase</strong> dans la région européenne.
      </p>

      <h2>4. Propriété intellectuelle</h2>
      <p>
        Le site <strong>oxiflow.fr</strong>, l&apos;application <strong>oxiflow.fr</strong>,
        leur contenu (textes, graphismes, logo, icônes, code source) et la marque «&nbsp;OxiFlow&nbsp;»
        sont la propriété exclusive de <span className="placeholder">[À COMPLÉTER — raison sociale]</span>
        et protégés par le droit d&apos;auteur (Code de la propriété intellectuelle).
        Toute reproduction, représentation ou utilisation sans autorisation préalable écrite est
        strictement interdite.
      </p>

      <h2>5. Données personnelles</h2>
      <p>
        La collecte et le traitement des données personnelles des utilisateurs sont régis par
        la <a href="/confidentialite">Politique de confidentialité</a> d&apos;OxiFlow,
        conforme au RGPD (Règlement UE 2016/679) et à la loi Informatique et Libertés.
        Pour exercer vos droits ou pour toute question : <a href="mailto:contact@oxilabs.fr">contact@oxilabs.fr</a>.
      </p>

      <h2>6. Cookies</h2>
      <p>
        OxiFlow utilise uniquement des cookies strictement nécessaires au fonctionnement du service
        (session d&apos;authentification). Aucun cookie de tracking ou publicitaire n&apos;est déposé.
        Pour en savoir plus, consultez notre <a href="/confidentialite#cookies">Politique de confidentialité</a>.
      </p>

      <h2>7. Liens hypertextes</h2>
      <p>
        Le site peut contenir des liens vers des sites tiers. OxiFlow ne peut être tenu responsable
        du contenu de ces sites externes. La création de liens hypertextes vers le site oxiflow.fr
        est soumise à autorisation préalable écrite de l&apos;éditeur.
      </p>

      <h2>8. Loi applicable</h2>
      <p>
        Les présentes mentions légales sont soumises au droit français.
        Tout litige relatif au site sera soumis à la compétence exclusive des tribunaux français.
      </p>

      <h2>9. Contact</h2>
      <p>
        Pour toute question, signalement ou demande :{' '}
        <a href="mailto:contact@oxilabs.fr">contact@oxilabs.fr</a>
      </p>

    </LegalLayout>
  );
}
