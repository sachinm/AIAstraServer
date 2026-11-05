/** Request-auth fakes for route tests: the routes get a RequireUser that picks the user from the request. */
import type express from 'express';
import type { OptionalUser, RequireUser } from '../../src/auth/requestAuth.js';

export function fakeRequireUser(pick: (req: express.Request) => string | null): RequireUser {
  return async (req, res) => {
    const userId = pick(req);
    if (!userId) res.status(401).json({ code: 'unauthorized', error: 'Unauthorized' });
    return userId;
  };
}

export function fakeOptionalUser(pick: (req: express.Request) => string | null): OptionalUser {
  return async (req) => pick(req);
}
