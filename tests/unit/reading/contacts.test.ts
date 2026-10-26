import { describe, expect, it, vi } from 'vitest';
import {
  asContactsPayload,
  fetchTransitContacts,
  transitContactsParams,
  type RadhaContact,
  type TransitContactsPayload,
} from '../../../src/reading/chartData/transitContacts.js';
import { CONTACTS_CAP, renderContacts, selectContacts, withContacts, type ContactsSection } from '../../../src/reading/packs/contacts.js';
import { horizonRange } from '../../../src/reading/packs/frames.js';
import { buildEvidencePack, listEvidenceIds, resolveEvidence } from '../../../src/reading/packs/selector.js';
import { G1_AS_OF, loadG1Dossier, loadG1Transits } from '../../helpers/readingFixtures.js';

const contact = (o: Partial<RadhaContact> & Pick<RadhaContact, 'transit' | 'natal' | 'from' | 'to'>): RadhaContact => ({
  natal_house: 1,
  orb_deg: 0,
  exact: [],
  station_in_orb: false,
  stations: [],
  ...o,
});

// Shapes as Radha returns them (AIAstra_Radha src/jhora/tests/test_transit_contacts.py, G1)
const PAYLOAD: TransitContactsPayload = {
  from: '2026-10-24',
  to: '2029-10-24',
  orb: 2,
  planets: ['Ma', 'Ju', 'Sa', 'Ra', 'Ke'],
  contacts: [
    contact({ transit: 'Ma', natal: 'La', natal_house: 1, from: '2026-11-05', to: '2026-11-12', exact: ['2026-11-08'] }),
    contact({ transit: 'Sa', natal: 'Su', natal_house: 8, from: '2028-05-26', to: '2029-03-01', exact: ['2028-06-14', '2028-11-02', '2029-02-10'], station_in_orb: true, stations: [{ date: '2028-08-20', kind: 'retrograde', orb_deg: 0.6 }] }),
    contact({ transit: 'Ju', natal: 'Mo', natal_house: 2, orb_deg: 1.1, from: '2027-01-10', to: '2027-03-01' }),
    contact({ transit: 'Ra', natal: 'Ke', natal_house: 3, from: '2026-09-01', to: '2026-12-01', exact: ['2026-10-01'], starts_before_range: true }),
  ],
};

describe('selectContacts', () => {
  it('keeps the rows overlapping the horizon, in date order, keyed planet_natal_from', () => {
    const s = selectContacts({ payload: PAYLOAD, horizon: horizonRange('1y', G1_AS_OF) });
    expect(Object.keys(s.rows)).toEqual(['Ra_Ke_2026-09-01', 'Ju_Mo_2027-01-10']);
    expect(s.rows['Ra_Ke_2026-09-01']).toEqual({ planet: 'Ra', natal: 'Ke', natal_house: 3, orb_deg: 0, from: '2026-09-01', to: '2026-12-01', exact: ['2026-10-01'], station_in_orb: false, before: true });
    expect(s.rows['Ju_Mo_2027-01-10']!.exact).toEqual([]);
    expect(s.orb).toBe(2);
    expect(s.dropped).toBe(0);
  });
  it('drops Mars for horizons over three months and keeps it for short ones', () => {
    expect(Object.keys(selectContacts({ payload: PAYLOAD, horizon: horizonRange('1y', G1_AS_OF) }).rows).some((k) => k.startsWith('Ma_'))).toBe(false);
    expect(Object.keys(selectContacts({ payload: PAYLOAD, horizon: horizonRange('3m', G1_AS_OF) }).rows)).toContain('Ma_La_2026-11-05');
  });
  it('carries the first station in orb and flags a contact that runs past the horizon', () => {
    const hz = { from: '2028-01-01', to: '2028-12-31', months: 12 };
    const row = selectContacts({ payload: PAYLOAD, horizon: hz }).rows['Sa_Su_2028-05-26']!;
    expect(row).toMatchObject({ station_in_orb: true, station: { date: '2028-08-20', kind: 'retrograde', orb_deg: 0.6 }, after: true });
    expect(row.before).toBeUndefined();
  });
  it('caps at 16, keeping stations in orb and exact hits before near misses, then re-sorts by date', () => {
    const many: RadhaContact[] = Array.from({ length: 20 }, (_, i) =>
      contact({ transit: 'Ju', natal: `N${i}`, from: `2027-01-${String(i + 1).padStart(2, '0')}`, to: '2027-02-28', orb_deg: 1 })
    );
    many.push(contact({ transit: 'Sa', natal: 'Mo', from: '2027-06-01', to: '2027-07-01', exact: ['2027-06-15'], station_in_orb: true, stations: [{ date: '2027-06-10', kind: 'direct', orb_deg: 0.2 }] }));
    const s = selectContacts({ payload: { ...PAYLOAD, contacts: many }, horizon: horizonRange('1y', G1_AS_OF) });
    const keys = Object.keys(s.rows);
    expect(keys).toHaveLength(CONTACTS_CAP);
    expect(keys).toContain('Sa_Mo_2027-06-01');
    expect(keys[keys.length - 1]).toBe('Sa_Mo_2027-06-01');
    expect(s.dropped).toBe(5);
    const froms = Object.values(s.rows).map((r) => r.from);
    expect(froms).toEqual([...froms].sort());
  });
});

describe('renderContacts', () => {
  it('writes one line per contact with dates, exact hits and the station', () => {
    const s = selectContacts({ payload: PAYLOAD, horizon: { from: '2026-10-24', to: '2029-10-24', months: 36 } });
    const text = renderContacts(s);
    expect(text.split('\n')).toEqual([
      'Rahu over natal Ketu (house 3): in orb from before 2026-09-01 to 2026-12-01; exact 2026-10-01',
      'Jupiter over natal Moon (house 2): in orb 2027-01-10 to 2027-03-01; closest 1.1°',
      'Saturn over natal Sun (house 8): in orb 2028-05-26 to 2029-03-01; exact 2028-06-14, 2028-11-02, 2029-02-10; stations retrograde 2028-08-20 within 0.6° (sharpest trigger)',
    ]);
  });
  it('notes rows dropped by the cap', () => {
    const s: ContactsSection = { orb: 2, rows: {}, dropped: 1 };
    expect(renderContacts(s)).toBe('(1 more contact not shown)');
  });
});

describe('withContacts and the evidence pack', () => {
  const dossier = loadG1Dossier();
  const intent = { horizon: '1y' as const, mentionsPlanets: [], focusPoints: [] };

  it('places the contacts at transits.contacts with resolvable evidence ids', () => {
    const transits = { ...loadG1Transits(), contacts: PAYLOAD };
    const pack = buildEvidencePack({ dossier, transits, subject: 'career_work', asOf: G1_AS_OF, intent });
    expect(resolveEvidence(pack, 'transits.contacts.rows.Ra_Ke_2026-09-01.exact')).toEqual(['2026-10-01']);
    expect(listEvidenceIds(pack)).toContain('transits.contacts.rows.Ju_Mo_2027-01-10.natal_house');
    expect(pack.missing).not.toContain('transit contacts unavailable');
    // the existing transit rows are still there
    expect(resolveEvidence(pack, 'transits.rows')).toBeTruthy();
  });
  it('adds nothing and reports nothing when contacts were not requested (type not served yet)', () => {
    const pack = buildEvidencePack({ dossier, transits: loadG1Transits(), subject: 'career_work', asOf: G1_AS_OF, intent });
    expect(resolveEvidence(pack, 'transits.contacts')).toBeUndefined();
    expect(pack.missing).not.toContain('transit contacts unavailable');
  });
  it('a failed fetch never breaks the pack: no contacts, one caveat', () => {
    const pack = buildEvidencePack({ dossier, transits: { ...loadG1Transits(), contacts: null }, subject: 'career_work', asOf: G1_AS_OF, intent });
    expect(resolveEvidence(pack, 'transits.contacts')).toBeUndefined();
    expect(pack.missing).toContain('transit contacts unavailable');
    expect(resolveEvidence(pack, 'transits.rows')).toBeTruthy();
  });
  it('passes a null transit section through', () => {
    const missing: string[] = [];
    expect(withContacts(null, { contacts: PAYLOAD }, horizonRange('1y', G1_AS_OF), missing)).toBeNull();
    expect(missing).toEqual([]);
  });
});

describe('fetchTransitContacts', () => {
  const req = { params: { dob: '2002-04-27', tob: '17:05:00', place: 'Delhi,IN' }, coords: { lat: 28.9167, lon: 77.0167, tz: 5.5 } };

  it('sends one Radha call with the options under params and the stored coordinates', async () => {
    const fetcher = vi.fn(async () => PAYLOAD);
    const out = await fetchTransitContacts('k1', { from: '2026-10-24', to: '2029-10-24', planets: ['Sa', 'Ju'] }, { repo: { kundliRequest: async () => req }, fetcher });
    expect(out).toBe(PAYLOAD);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(req, 'transit_contacts', { lat: 28.9167, lon: 77.0167, tz: 5.5, params: { from: '2026-10-24', to: '2029-10-24', planets: ['Sa', 'Ju'] } });
  });
  it('rejects bad options before any round trip, and a payload that is not contacts', async () => {
    const fetcher = vi.fn(async () => ({ nope: true }));
    const repo = { kundliRequest: async () => req };
    await expect(fetchTransitContacts('k1', { from: '2027-02-01', to: '2027-01-01' }, { repo, fetcher })).rejects.toThrow(/from <= to/);
    await expect(fetchTransitContacts('k1', { from: '2027-01-01', to: '2027-02-01', orb: 9 }, { repo, fetcher })).rejects.toThrow(/orb/);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(fetchTransitContacts('k1', { from: '2027-01-01', to: '2027-02-01' }, { repo, fetcher })).rejects.toThrow(/not a transit_contacts payload/);
    await expect(fetchTransitContacts('k1', { from: '2027-01-01', to: '2027-02-01' }, { repo: { kundliRequest: async () => null }, fetcher })).rejects.toThrow(/not found/);
  });
  it('builds params with only the options given', () => {
    expect(transitContactsParams({ from: '2027-01-01', to: '2027-12-31' })).toEqual({ from: '2027-01-01', to: '2027-12-31' });
    expect(transitContactsParams({ from: '2027-01-01', to: '2027-12-31', orb: 1.5 })).toEqual({ from: '2027-01-01', to: '2027-12-31', orb: 1.5 });
  });
  it('checks the payload outline', () => {
    expect(asContactsPayload(PAYLOAD)).toBe(PAYLOAD);
    expect(asContactsPayload({ ...PAYLOAD, contacts: [{ transit: 'Sa' }] })).toBeNull();
    expect(asContactsPayload(null)).toBeNull();
  });
});
