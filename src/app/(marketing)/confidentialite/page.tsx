import { LegalLayout } from '@/components/marketing/LegalLayout';

export const metadata = {
  title: 'Politique de confidentialité — OxiFlow',
  description: 'Politique de confidentialité et protection des données personnelles (RGPD) d\'OxiFlow.',
};

export default function ConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" lastUpdated="mars 2026">

      <p>
        OxiFlow accorde une importance primordiale à la protection de vos données personnelles.
        La présente politique décrit quelles données nous collectons, pourquoi, comment nous les
        utilisons et quels sont vos droits conformément au Règlement Général sur la Protection des
        Données (RGPD — Règlement UE 2016/679) et à la loi Informatique et Libertés.
      </p>

      <h2>1. Responsable du traitement</h2>
      <ul>
        <li>Raison sociale : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>Adresse : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>SIRET : <span className="placeholder">[À COMPLÉTER]</span></li>
        <li>Email DPO : <span className="placeholder">[À COMPLÉTER]</span> — <a href="mailto:dpo@oxiflow.fr">dpo@oxiflow.fr</a></li>
      </ul>

      <h2>2. Données collectées</h2>
      <p>Nous collectons les catégories de données suivantes :</p>

      <h3>2.1 Données d&apos;identification et de contact</h3>
      <ul>
        <li>Nom et prénom</li>
        <li>Adresse email professionnelle</li>
        <li>Nom de l&apos;entreprise</li>
        <li>Numéro de téléphone (si renseigné)</li>
        <li>Adresse postale (pour la facturation)</li>
      </ul>

      <h3>2.2 Données de facturation et de paiement</h3>
      <ul>
        <li>Informations de facturation (adresse, numéro de TVA)</li>
        <li>Historique des paiements et factures</li>
        <li>Les données de carte bancaire sont traitées exclusivement par Stripe
          et ne transitent jamais par nos serveurs.</li>
      </ul>

      <h3>2.3 Données d&apos;utilisation</h3>
      <ul>
        <li>Données saisies dans l&apos;application (clients, devis, factures, stocks, etc.)</li>
        <li>Journaux de connexion (adresse IP, horodatage, navigateur)</li>
        <li>Données d&apos;utilisation agrégées (fonctionnalités utilisées, fréquence)</li>
      </ul>

      <h3>2.4 Données traitées par l&apos;assistant IA</h3>
      <p>
        Les requêtes vocales et textuelles transmises à l&apos;assistant OxiFlow sont envoyées à
        l&apos;API Anthropic pour traitement. Ces données ne sont <strong>pas conservées</strong> par
        Anthropic au-delà du traitement de la requête (politique <em>zero data retention</em>
        disponible sur demande).
      </p>

      <h2>3. Finalités et base légale</h2>
      <table>
        <thead>
          <tr>
            <th>Finalité</th>
            <th>Base légale (RGPD)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Fourniture du service SaaS OxiFlow</td>
            <td>Exécution du contrat — Art. 6.1.b</td>
          </tr>
          <tr>
            <td>Facturation et gestion des abonnements</td>
            <td>Exécution du contrat — Art. 6.1.b</td>
          </tr>
          <tr>
            <td>Support client et assistance technique</td>
            <td>Exécution du contrat — Art. 6.1.b</td>
          </tr>
          <tr>
            <td>Envoi d&apos;emails transactionnels (bienvenue, factures, rappels)</td>
            <td>Exécution du contrat — Art. 6.1.b</td>
          </tr>
          <tr>
            <td>Amélioration du service (données agrégées et anonymisées)</td>
            <td>Intérêt légitime — Art. 6.1.f</td>
          </tr>
          <tr>
            <td>Respect des obligations légales et comptables</td>
            <td>Obligation légale — Art. 6.1.c</td>
          </tr>
        </tbody>
      </table>

      <h2>4. Durée de conservation</h2>
      <table>
        <thead>
          <tr>
            <th>Catégorie</th>
            <th>Durée</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Données de compte actif</td>
            <td>Durée de l&apos;abonnement</td>
          </tr>
          <tr>
            <td>Données après résiliation du compte</td>
            <td>3 ans (prescription commerciale — art. L.110-4 Code de commerce)</td>
          </tr>
          <tr>
            <td>Données de facturation</td>
            <td>10 ans (obligation comptable — art. L.123-22 Code de commerce)</td>
          </tr>
          <tr>
            <td>Journaux de connexion</td>
            <td>12 mois (recommandation CNIL)</td>
          </tr>
          <tr>
            <td>Requêtes IA (Anthropic)</td>
            <td>Non conservées au-delà du traitement</td>
          </tr>
        </tbody>
      </table>

      <h2>5. Sous-traitants et transferts hors UE</h2>
      <p>
        Nous faisons appel aux sous-traitants suivants pour la fourniture du service.
        Chaque sous-traitant est soumis à un accord de traitement des données (DPA)
        garantissant la conformité au RGPD.
      </p>
      <table>
        <thead>
          <tr>
            <th>Sous-traitant</th>
            <th>Rôle</th>
            <th>Localisation</th>
            <th>Garantie</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Supabase</strong></td>
            <td>Base de données, authentification</td>
            <td>UE (eu-west-1)</td>
            <td>DPA, serveurs UE disponibles</td>
          </tr>
          <tr>
            <td><strong>Vercel</strong></td>
            <td>Hébergement applicatif</td>
            <td>UE (fra1 — Francfort)</td>
            <td>DPA, Data Residency EU</td>
          </tr>
          <tr>
            <td><strong>Stripe</strong></td>
            <td>Paiement et facturation</td>
            <td>UE / USA</td>
            <td>DPA, Clauses Contractuelles Types (SCC)</td>
          </tr>
          <tr>
            <td><strong>Resend</strong></td>
            <td>Envoi d&apos;emails transactionnels</td>
            <td>USA</td>
            <td>DPA, SCC</td>
          </tr>
          <tr>
            <td><strong>Anthropic</strong></td>
            <td>API IA (assistant vocal)</td>
            <td>USA</td>
            <td>DPA, zero data retention</td>
          </tr>
        </tbody>
      </table>
      <p>
        Les transferts vers les USA sont encadrés par des Clauses Contractuelles Types (CCT/SCC)
        approuvées par la Commission européenne, conformément à l&apos;article 46 du RGPD.
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Conformément au RGPD, vous disposez des droits suivants sur vos données personnelles :
      </p>
      <ul>
        <li><strong>Droit d&apos;accès</strong> (Art. 15) : obtenir une copie des données vous concernant ;</li>
        <li><strong>Droit de rectification</strong> (Art. 16) : corriger des données inexactes ou incomplètes ;</li>
        <li><strong>Droit à l&apos;effacement</strong> (Art. 17) : demander la suppression de vos données,
          sous réserve des obligations légales de conservation ;</li>
        <li><strong>Droit à la portabilité</strong> (Art. 20) : recevoir vos données dans un format structuré
          et lisible par machine ;</li>
        <li><strong>Droit d&apos;opposition</strong> (Art. 21) : vous opposer à un traitement fondé sur l&apos;intérêt légitime ;</li>
        <li><strong>Droit à la limitation</strong> (Art. 18) : demander la suspension temporaire d&apos;un traitement.</li>
      </ul>
      <p>
        Pour exercer vos droits, contactez-nous à <a href="mailto:dpo@oxiflow.fr">dpo@oxiflow.fr</a>.
        Nous répondrons dans un délai d&apos;un mois. En cas de réponse insatisfaisante, vous pouvez
        introduire une réclamation auprès de la <strong>CNIL</strong> (Commission Nationale de
        l&apos;Informatique et des Libertés) — <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>.
      </p>

      <h2>7. Cookies</h2>
      <p>
        OxiFlow n&apos;utilise <strong>aucun cookie de tracking, de publicité ou d&apos;analyse</strong>.
        Seuls des cookies strictement nécessaires au fonctionnement du service sont déposés :
      </p>
      <ul>
        <li><strong>Cookie de session Supabase</strong> : maintien de la connexion de l&apos;utilisateur
          authentifié. Ce cookie est essentiel au service et ne requiert pas votre consentement
          (Art. 82 de la loi Informatique et Libertés — exemption CNIL).</li>
        <li><strong>Cookie cookie_consent</strong> : mémorisation de la prise de connaissance
          de la bannière cookies.</li>
      </ul>
      <p>
        Aucun cookie tiers, Google Analytics, pixel Facebook ou outil de surveillance n&apos;est intégré.
      </p>

      <h2>8. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger
        vos données contre toute perte, accès non autorisé, altération ou divulgation. Ces mesures
        incluent notamment : chiffrement des communications (TLS), isolation des données par tenant
        (Row Level Security PostgreSQL), authentification sécurisée.
      </p>

      <h2>9. Modifications de la présente politique</h2>
      <p>
        La présente politique peut être mise à jour. En cas de modification substantielle,
        vous serez notifié par email au moins 15 jours avant l&apos;entrée en vigueur des changements.
        La date de dernière mise à jour est indiquée en tête de document.
      </p>

      <h2>10. Contact</h2>
      <p>
        Pour toute question relative à cette politique ou à vos données personnelles :{' '}
        <a href="mailto:dpo@oxiflow.fr">dpo@oxiflow.fr</a>
      </p>

    </LegalLayout>
  );
}
