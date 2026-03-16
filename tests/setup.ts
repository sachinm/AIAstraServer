import dotenv from 'dotenv';
dotenv.config();
// Allow Prisma client to load when DATABASE_URL is not set (e.g. CI); DB-dependent tests skip.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://placeholder:placeholder@localhost:5432/placeholder';
  process.env.DATABASE_URL_IS_PLACEHOLDER = '1';
}
