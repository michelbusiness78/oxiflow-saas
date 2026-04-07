import { NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { getDashboardDirigeant } from '@/app/actions/dirigeant';

export async function GET() {
  try {
    const { tenant_id, user } = await getAuthContext();
    const data = await getDashboardDirigeant(tenant_id, user.id);
    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/dashboard/dirigeant]', err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
