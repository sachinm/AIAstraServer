import { z } from 'zod';

const MAX_USERNAME = 128;
const MAX_EMAIL = 256;
const MAX_DATE = 32;
const MAX_PLACE = 512;
const MAX_TIME = 32;
const MAX_GENDER = 32;


export const signUpSchema = z.object({
  username: z.string().min(1, 'Username is required').max(MAX_USERNAME),
  email: z.string().email('Invalid email').max(MAX_EMAIL),
  date_of_birth: z.string().min(1, 'Date of birth is required').max(MAX_DATE),
  place_of_birth: z.string().max(MAX_PLACE).optional().nullable(),
  time_of_birth: z.string().max(MAX_TIME).optional().nullable(),
  gender: z.string().max(MAX_GENDER).optional().nullable(),
});

export function validateSignUpInput(input: unknown): z.SafeParseReturnType<z.infer<typeof signUpSchema>, z.infer<typeof signUpSchema>> {
  return signUpSchema.safeParse(input);
}
