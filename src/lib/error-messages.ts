/**
 * Traduit les messages d'erreur Supabase/PostgREST en français lisibles.
 * À utiliser dans tous les server actions avant de retourner { error }.
 */
export function translateSupabaseError(message: string): string {
  if (!message) return 'Une erreur est survenue. Veuillez réessayer.';

  if (message.includes('value too long for type character varying')) {
    return 'La valeur saisie est trop longue pour ce champ.';
  }
  if (message.includes('duplicate key value violates unique constraint')) {
    return 'Cette valeur existe déjà.';
  }
  if (message.includes('null value in column')) {
    return 'Ce champ est obligatoire.';
  }
  if (
    message.includes('foreign key constraint') ||
    message.includes('violates foreign key')
  ) {
    return 'Cet élément est lié à d\'autres données et ne peut pas être supprimé.';
  }
  if (message.includes('invalid input value for enum')) {
    return 'Valeur non valide pour ce champ.';
  }
  if (message.includes('permission denied') || message.includes('row-level security')) {
    return 'Vous n\'avez pas les droits nécessaires pour cette action.';
  }
  if (message.includes('JWT') || message.includes('not authenticated')) {
    return 'Session expirée. Veuillez vous reconnecter.';
  }
  if (message.includes('column') && message.includes('does not exist')) {
    return `Colonne manquante — exécuter la migration SQL (${message.slice(0, 80)})`;
  }

  // Retourner le message brut tronqué pour faciliter le debug
  return `Erreur : ${message.slice(0, 120)}`;
}
