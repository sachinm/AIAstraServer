import { z } from 'zod';
import { normalizeGender } from './profileValidators.js';

const MAX_USERNAME = 128;
const MAX_EMAIL = 256;
const MAX_DATE = 32;
const MAX_PLACE = 512;
const MAX_TIME = 32;
const MAX_GENDER = 32;


/**
 * Deprecated one-shot signup input. `.strict()` makes unknown keys an error, so `age` (removed everywhere)
 * is rejected; `password` is still tolerated and dropped because old clients send it.
 */
export const signUpSchema = z
  .object({
    username: z.string().min(1, 'Username is required').max(MAX_USERNAME),
    password: z.string().optional(),
    email: z.string().email('Invalid email').max(MAX_EMAIL),
    date_of_birth: z.string().min(1, 'Date of birth is required').max(MAX_DATE),
    place_of_birth: z.string().max(MAX_PLACE).optional().nullable(),
    time_of_birth: z.string().max(MAX_TIME).optional().nullable(),
    gender: z.string().max(MAX_GENDER).optional().nullable(),
  })
  .strict()
  .transform(({ password: _password, gender, ...rest }) => ({ ...rest, gender: normalizeGender(gender) }));

export function validateSignUpInput(input: unknown) {
  return signUpSchema.safeParse(input);
}
