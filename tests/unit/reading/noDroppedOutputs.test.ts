/**
 * AGENTS.md "Reading depth is a release gate", rule 2 (docs/techniques/09 §5): nothing is dropped upward. Every model
 * agent of the board build (registered in `src/agents/registry.ts` under a build sub-module) has a row in
 * `PIPELINE_CONSUMERS` naming who reads its output; an agent whose output no one reads fails here. The list of agents
 * comes from the registry, so a new agent without a consumer fails without anyone editing this test.
 */
import { describe, expect, it } from 'vitest';
import { AGENTS, agentById } from '../../../src/agents/registry.js';
import { BOARD_BUILD_SUBMODULES, PIPELINE_CONSUMERS } from '../../../src/reading/cards/pipeline.js';

const buildAgents = AGENTS.filter((a) => a.kind === 'llm' && a.subModule && BOARD_BUILD_SUBMODULES.includes(a.subModule)).map((a) => a.id);

describe('no dropped outputs', () => {
  it('finds the board-build agents in the registry', () => {
    expect(buildAgents).toEqual(expect.arrayContaining(['family.rasi', 'reading.clock', 'self.card.oracle', 'self.card.personalizer', 'lineman.self']));
  });

  it.each(buildAgents)('%s has a consumer', (id) => {
    const row = PIPELINE_CONSUMERS[id];
    expect(row, `${id} is a board-build agent with no row in PIPELINE_CONSUMERS: who reads its output?`).toBeTruthy();
    expect(row!.consumers.length).toBeGreaterThan(0);
  });

  it('every consumer is a registered agent or a served field, and never the agent itself', () => {
    for (const [id, row] of Object.entries(PIPELINE_CONSUMERS)) {
      expect(agentById(id), `${id} is in the table but not registered`).toBeTruthy();
      for (const c of row.consumers) {
        if (c.startsWith('served:')) continue;
        expect(agentById(c), `${id} → ${c}: not a registered agent`).toBeTruthy();
        expect(c).not.toBe(id);
      }
    }
  });

  it('a legacy agent says what retires it', () => {
    for (const row of Object.values(PIPELINE_CONSUMERS)) if (row.legacy) expect(row.legacy.retireWhen.length).toBeGreaterThan(10);
  });

  it('the card Oracle story and the plain story are served', () => {
    expect(PIPELINE_CONSUMERS['self.card.oracle']!.consumers).toContain('served:v3.story');
    expect(PIPELINE_CONSUMERS['self.card.personalizer']!.consumers).toContain('served:v3.plain.story');
  });
});
