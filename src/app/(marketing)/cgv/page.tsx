import { LegalLayout } from '@/components/marketing/LegalLayout';

export const metadata = {
  title: 'Conditions Générales de Vente',
  description: 'Conditions générales de vente du logiciel SaaS OxiFlow.',
  openGraph: {
    title:       'Conditions Générales de Vente — OxiFlow',
    description: 'Conditions générales de vente du logiciel SaaS OxiFlow.',
    type:        'website' as const,
    locale:      'fr_FR',
    images:      [{ url: '/og-image.svg', width: 1200, height: 630 }],
  },
  twitter: {
    card:   'summary_large_image' as const,
    images: ['/og-image.svg'],
  },
};

export default function CgvPage() {
  return (
    <LegalLayout title="Conditions Générales de Vente" lastUpdated="mars 2026">

      <h2>Article 1 — Objet</h2>
      <p>
        Les présentes Conditions Générales de Vente (ci-après «&nbsp;CGV&nbsp;») régissent les relations contractuelles
        entre la société <span className="placeholder">[À COMPLÉTER — raison sociale]</span>, éditrice du logiciel
        OxiFlow (ci-après «&nbsp;le Prestataire&nbsp;»), et toute personne physique ou morale souscrivant
        un abonnement à l&apos;application en ligne OxiFlow (ci-après «&nbsp;le Client&nbsp;»).
      </p>
      <p>
        OxiFlow est un logiciel de gestion PME en mode SaaS (Software as a Service) accessible depuis
        l&apos;URL <strong>app.oxiflow.fr</strong>, permettant notamment la gestion commerciale (devis, factures),
        le pilotage d&apos;activité, la gestion d&apos;équipe et l&apos;assistance vocale par intelligence artificielle.
      </p>

      <h2>Article 2 — Éditeur du service</h2>
      <ul>
        <li>Raison sociale : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>Forme juridique : <span className="placeholder">[À COMPLÉTER — ex. SAS, SARL]</span></li>
        <li>Capital social : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>SIRET : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>RCS : <span className="placeholder">[À COMPLÉTER — ville d&apos;immatriculation]</span></li>
        <li>Numéro TVA intracommunautaire : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>Siège social : <span className="placeholder">[À COMPLÉTER — adresse complète]</span></li>
        <li>Contact : <a href="mailto:support@oxiflow.fr">support@oxiflow.fr</a></li>
      </ul>

      <h2>Article 3 — Plans et tarifs</h2>
      <p>OxiFlow est proposé en trois formules d&apos;abonnement mensuel :</p>
      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Tarif HT / mois</th>
            <th>Utilisateurs</th>
            <th>Principaux accès</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Solo</strong></td>
            <td>29 €</td>
            <td>1</td>
            <td>Commerce, pilotage, 50 requêtes vocales/mois</td>
          </tr>
          <tr>
            <td><strong>Team</strong></td>
            <td>59 €</td>
            <td>5</td>
            <td>Tous les modules, gestion terrain, 200 requêtes vocales/mois</td>
          </tr>
          <tr>
            <td><strong>Pro</strong></td>
            <td>99 €</td>
            <td>15</td>
            <td>Tous les modules, multi-sites, 500 requêtes vocales/mois</td>
          </tr>
        </tbody>
      </table>
      <p>
        Les tarifs sont exprimés hors taxes (HT). La TVA applicable est celle en vigueur au jour de la facturation
        (20 % pour les clients français assujettis à la TVA).
        Le Prestataire se réserve le droit de modifier ses tarifs avec un préavis de 30 jours par email.
      </p>

      <h2>Article 4 — Inscription et essai gratuit</h2>
      <p>
        Toute personne souhaitant utiliser OxiFlow doit créer un compte en renseignant une adresse email valide,
        un nom et le nom de son entreprise. L&apos;inscription est gratuite.
      </p>
      <p>
        À l&apos;issue de l&apos;inscription, le Client bénéficie d&apos;un <strong>essai gratuit de 14 jours</strong>,
        sans obligation de renseigner un moyen de paiement, donnant accès à l&apos;ensemble des fonctionnalités
        du plan souscrit. À l&apos;expiration de l&apos;essai, l&apos;accès aux fonctionnalités est suspendu
        jusqu&apos;à la souscription d&apos;un abonnement payant.
      </p>

      <h2>Article 5 — Conditions de paiement</h2>
      <p>
        Les paiements sont effectués par prélèvement automatique mensuel via la plateforme <strong>Stripe</strong>
        (carte bancaire). Le premier prélèvement intervient à l&apos;issue de la période d&apos;essai gratuit.
        Les factures sont émises mensuellement et disponibles dans l&apos;espace «&nbsp;Abonnement&nbsp;» du tableau de bord.
      </p>
      <p>
        En cas d&apos;échec de paiement, le Prestataire notifie le Client par email. Sans régularisation sous
        7 jours, l&apos;accès au service peut être suspendu. Les sommes dues restent exigibles.
      </p>

      <h2>Article 6 — Droit de rétractation</h2>
      <p>
        Conformément aux articles L.221-18 et suivants du Code de la consommation (loi Hamon),
        le Client consommateur (personne physique agissant à titre non professionnel) dispose d&apos;un délai
        de <strong>14 jours calendaires</strong> à compter de la souscription pour exercer son droit de rétractation,
        sans avoir à motiver sa décision.
      </p>
      <p>
        Pour exercer ce droit, le Client doit notifier sa décision par email à{' '}
        <a href="mailto:support@oxiflow.fr">support@oxiflow.fr</a> avant l&apos;expiration du délai.
        En cas d&apos;accès au service avant l&apos;expiration du délai de rétractation et conformément
        à l&apos;article L.221-28 12° du Code de la consommation, le Client reconnaît expressément renoncer
        à son droit de rétractation dès lors qu&apos;il a pleinement utilisé le service.
      </p>
      <p>
        <strong>Note :</strong> le droit de rétractation ne s&apos;applique pas aux clients professionnels (B2B).
      </p>

      <h2>Article 7 — Durée et résiliation</h2>
      <p>
        Les abonnements sont souscrits <strong>sans engagement de durée</strong>, sur une base mensuelle.
        Le Client peut résilier son abonnement à tout moment depuis son espace «&nbsp;Abonnement&nbsp;»
        (portail de facturation Stripe). La résiliation prend effet à la fin de la période mensuelle en cours,
        sans remboursement au prorata.
      </p>
      <p>
        Le Prestataire se réserve le droit de résilier tout abonnement en cas de manquement grave aux
        présentes CGV, avec un préavis de 8 jours par email, sauf en cas de fraude ou d&apos;utilisation illicite
        où la résiliation est immédiate.
      </p>

      <h2>Article 8 — Obligations et responsabilités du Client</h2>
      <p>Le Client s&apos;engage à :</p>
      <ul>
        <li>Fournir des informations exactes lors de l&apos;inscription et les maintenir à jour ;</li>
        <li>Maintenir la confidentialité de ses identifiants de connexion ;</li>
        <li>Ne pas utiliser le service à des fins illicites ou contraires aux présentes CGV ;</li>
        <li>Ne pas tenter de contourner les mesures de sécurité ou d&apos;accéder aux données d&apos;autres clients ;</li>
        <li>Respecter les droits de propriété intellectuelle du Prestataire.</li>
      </ul>

      <h2>Article 9 — Responsabilité et garanties du Prestataire</h2>
      <p>
        Le Prestataire s&apos;engage à mettre en œuvre tous les moyens raisonnables pour assurer
        la disponibilité et la sécurité du service. OxiFlow est fourni «&nbsp;en l&apos;état&nbsp;»
        (<em>as is</em>) sans garantie d&apos;aucune sorte, dans les limites autorisées par la loi applicable.
      </p>
      <p>
        La responsabilité du Prestataire ne saurait être engagée pour : (i) les interruptions de service
        dues à des opérations de maintenance planifiées ou à des incidents hors de son contrôle ;
        (ii) la perte de données résultant d&apos;une faute du Client ; (iii) les dommages indirects,
        pertes de profits ou d&apos;exploitation. En tout état de cause, la responsabilité totale du
        Prestataire est limitée aux sommes payées par le Client au cours des 12 derniers mois.
      </p>

      <h2>Article 10 — Propriété intellectuelle</h2>
      <p>
        OxiFlow et l&apos;ensemble de ses composants (code, interfaces, marques, logos, contenus)
        sont la propriété exclusive du Prestataire et protégés par le droit de la propriété intellectuelle.
        La souscription d&apos;un abonnement confère au Client un droit d&apos;utilisation personnel,
        non exclusif et non transférable du service, pour la durée de l&apos;abonnement.
      </p>
      <p>
        Le Client conserve la pleine propriété des données qu&apos;il saisit dans le service
        (données clients, devis, factures, etc.) et peut en demander l&apos;export à tout moment
        via <a href="mailto:support@oxiflow.fr">support@oxiflow.fr</a>.
      </p>

      <h2>Article 11 — Sous-traitants techniques</h2>
      <p>Pour la fourniture du service, le Prestataire fait appel aux sous-traitants suivants :</p>
      <table>
        <thead>
          <tr>
            <th>Sous-traitant</th>
            <th>Rôle</th>
            <th>Localisation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Supabase</strong></td>
            <td>Base de données et authentification</td>
            <td>UE (région eu-west possible)</td>
          </tr>
          <tr>
            <td><strong>Vercel</strong></td>
            <td>Hébergement de l&apos;application</td>
            <td>UE (fra1 — Francfort)</td>
          </tr>
          <tr>
            <td><strong>Stripe</strong></td>
            <td>Paiement et facturation</td>
            <td>UE / USA (certifié SCC)</td>
          </tr>
          <tr>
            <td><strong>Anthropic</strong></td>
            <td>API d&apos;intelligence artificielle (assistant vocal)</td>
            <td>USA (données sans rétention)</td>
          </tr>
        </tbody>
      </table>
      <p>
        Ces sous-traitants traitent les données uniquement pour les besoins du service et sont soumis
        à des obligations de confidentialité. Le Prestataire s&apos;assure que tout transfert hors UE
        est encadré par des garanties appropriées (clauses contractuelles types, décision d&apos;adéquation).
      </p>

      <h2>Article 12 — Protection des données personnelles</h2>
      <p>
        Le traitement des données personnelles des Clients est régi par la{' '}
        <a href="/confidentialite">Politique de confidentialité</a> d&apos;OxiFlow,
        disponible sur le site et conforme au RGPD (Règlement UE 2016/679).
      </p>

      <h2>Article 13 — Force majeure</h2>
      <p>
        Ni le Prestataire ni le Client ne saurait être tenu responsable d&apos;un retard ou d&apos;une
        défaillance dans l&apos;exécution de ses obligations résultant d&apos;un cas de force majeure
        au sens de l&apos;article 1218 du Code civil français.
      </p>

      <h2>Article 14 — Loi applicable et juridiction</h2>
      <p>
        Les présentes CGV sont soumises au <strong>droit français</strong>. En cas de litige,
        les parties s&apos;engagent à rechercher une solution amiable avant toute action judiciaire.
        À défaut, le litige sera soumis aux tribunaux compétents de{' '}
        <span className="placeholder">[À COMPLÉTER — ville du siège social]</span>,
        sauf dispositions impératives contraires applicables au Client consommateur.
      </p>
      <p>
        Conformément à l&apos;article L.616-1 du Code de la consommation, le Client consommateur
        peut recourir gratuitement au médiateur de la consommation compétent.
      </p>

      <h2>Article 15 — Contact</h2>
      <p>
        Pour toute question relative aux présentes CGV :{' '}
        <a href="mailto:support@oxiflow.fr">support@oxiflow.fr</a>
      </p>

    </LegalLayout>
  );
}
