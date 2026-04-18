export function getRedirectByRole(role: string): string {
  switch (role) {
    case 'dirigeant':   return '/pilotage';
    case 'commercial':  return '/commerce';
    case 'technicien':  return '/technicien';
    case 'chef_projet': return '/chef-projet';
    case 'rh':          return '/rh';
    default:            return '/pilotage';
  }
}
