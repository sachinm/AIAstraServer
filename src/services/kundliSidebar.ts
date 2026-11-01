/**
 * What the chat's right sidebar may receive. Everyone gets the birth details and the stored Lagna row; the other charts
 * and dashas go only to an account with `auth.research`. This passes stored values through and works out nothing.
 */
const BASIC_BIODATA = ['date', 'time', 'place_name', 'nakshatra'];

export type SidebarColumns = Record<'biodata' | 'd1' | 'd2' | 'd4' | 'd7' | 'd9' | 'd10' | 'vimsottari_dasa' | 'narayana_dasa', unknown>;

export function sidebarColumns(research: boolean, data: Partial<SidebarColumns>): SidebarColumns {
  const empty = { biodata: null, d1: null, d2: null, d4: null, d7: null, d9: null, d10: null, vimsottari_dasa: null, narayana_dasa: null };
  if (research) return { ...empty, ...data };
  const bio = data.biodata;
  const row = Array.isArray(data.d1) ? data.d1.filter((r) => (r as { body?: unknown } | null)?.body === 'Lagna') : null;
  return {
    ...empty,
    biodata: bio && typeof bio === 'object' ? Object.fromEntries(Object.entries(bio).filter(([k]) => BASIC_BIODATA.includes(k))) : null,
    d1: row,
  };
}
