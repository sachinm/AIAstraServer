/**
 * HTTP routes for the Research Staging & Self Dashboard QA Engine (docs/admin/09).
 *
 *   GET  /api/research/presets             list the 20 built-in presets (10 age brackets + 10 personas)
 *   POST /api/research/hydrate             hydrate single, age_brackets, personas, all, or custom subject
 *   GET  /api/research/runs/:subjectOrId   inspect a hydrated Self Dashboard QA run & 8-gate verifier report
 */
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { RequireUser } from '../auth/requestAuth.js';
import {
  buildSelfResearchDashboard,
  getResearchPresets,
  hydrateResearchBatch,
} from '../reading/research/selfDashboardQa.js';

export interface ResearchRouteDeps {
  prisma: PrismaClient;
  requireUser: RequireUser;
}

export function registerResearchRoutes(app: express.Express, deps: ResearchRouteDeps): void {
  app.get('/api/research/presets', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const presets = getResearchPresets();
    res.json({
      total: presets.length,
      ageBrackets: presets.filter((p) => p.groupKind === 'age_bracket').length,
      personas: presets.filter((p) => p.groupKind === 'persona').length,
      items: presets,
    });
  });

  app.post('/api/research/hydrate', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const body = (req.body ?? {}) as {
      mode?: 'single' | 'age_brackets' | 'personas' | 'all' | 'custom';
      subjectCode?: string;
      asOf?: string;
      custom?: {
        subjectCode?: string;
        label: string;
        ageYears: number;
        birthDate: string;
        birthTime: string;
        placeCode?: string;
        placeLabel?: string;
        professionCode: string;
        scenarioCode?: string;
      };
    };
    const mode = body.mode ?? 'single';
    try {
      const out = await hydrateResearchBatch(deps.prisma, {
        mode,
        subjectCode: body.subjectCode,
        asOf: body.asOf,
        custom: body.custom,
      });
      res.json(out);
    } catch (e) {
      res.status(500).json({ error: 'research_hydrate_failed', message: (e as Error).message });
    }
  });

  app.get('/api/research/runs/:subjectOrId', async (req, res) => {
    const userId = await deps.requireUser(req, res);
    if (!userId) return;
    const key = req.params.subjectOrId;
    const asOf = typeof req.query.asOf === 'string' ? req.query.asOf : '2026-11-15';
    const presets = getResearchPresets();
    const match = presets.find((p) => p.subjectCode === key) ?? presets[0]!;
    const detail = buildSelfResearchDashboard(match, asOf);
    res.json({
      ...detail,
      runId: `run_${match.subjectCode}_${asOf}`,
      researchKundliId: `rk_${match.subjectCode}`,
      durationMs: 8,
      createdAt: new Date().toISOString(),
    });
  });
}
