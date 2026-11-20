/**
 * The natal prefix is byte-identical across the move out of `self/v2` (plan "retire the v2 Self reading", server step 1).
 * The card store keys (`pre=`) and the card Oracle's reuse key are built from `natal.core`, which is this prefix's text,
 * so any change to a byte of it re-reads every card. The literals below were recorded on the unmoved code
 * (develop 9fc0cf3, `buildOracleSlice` in `self/v2/slices.ts`) over the v2 agent fixtures.
 *
 * `slice.prefixHash` also covers the Oracle model id and the v2 Oracle prompt text (the slice's system), which move for
 * other reasons (an env model, phase D's prompt deletion); it is checked for equality, not pinned. The prefix bytes and
 * `natal.core` are pinned.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildSelfFamilyPacks } from '../../../../src/reading/self/oracle.js';
import { buildOracleSlice, toSelfClock } from '../../../../src/reading/self/v2/slices.js';
import { buildNatalContext } from '../../../../src/reading/slices/natalPrefix.js';
import { buildFamilySlices } from '../../../../src/reading/families/run.js';
import { natalCoreFromPrefix } from '../../../../src/reading/slices/prepare.js';
import { ACTIVATION, ASOF, makeBriefs, makeCtx, makeView } from '../self/v2agents/fixtures.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

const PIN = {
  prefixSha256: '11931c46e30e3d114c46e45752622e68289994bd6e4c494aa32f35359b0a9eda',
  natalCoreHash: 'd63b25b186dd1f4da5d68637',
  keys: 130,
};

describe('natal prefix pin (byte-identical across the move)', () => {
  const ctx = makeCtx();
  const packs = buildSelfFamilyPacks(makeView(), ACTIVATION, toSelfClock(ctx.sub.clock!), ASOF, null);

  it('the v2 Oracle slice still builds the pinned prefix', () => {
    const { slice } = buildOracleSlice(ctx, packs, makeBriefs());
    expect(sha(slice.prefix)).toBe(PIN.prefixSha256);
    expect(natalCoreFromPrefix(slice.prefix, 'dv-1').hash).toBe(PIN.natalCoreHash);
    expect(slice.keys.length).toBe(PIN.keys);
  });

  it('buildNatalContext gives the same prefix, hash, keys and token estimate as the v2 Oracle slice', () => {
    const { slice } = buildOracleSlice(ctx, packs, makeBriefs());
    const natal = buildNatalContext(ctx, packs, makeBriefs());
    expect(sha(natal.prefix)).toBe(PIN.prefixSha256);
    expect(natal.hash).toBe(slice.prefixHash);
    expect(natal.model).toBe(slice.model);
    expect(natal.keys).toEqual(slice.keys);
    expect(natal.estTokens).toEqual(slice.estTokens);
    expect(natal.slice).toEqual(slice);
  });

  it('the family slices built from the moved module carry the same packs', () => {
    const loaded = { view: makeView(), activation: ACTIVATION, sky: null, preferred: null } as never;
    const fam = buildFamilySlices(ctx, loaded);
    const natal = buildNatalContext(ctx, fam.packs, makeBriefs());
    expect(sha(natal.prefix)).toBe(PIN.prefixSha256);
  });
});
