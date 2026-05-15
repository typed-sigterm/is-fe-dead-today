import process from 'node:process';
import { z } from 'zod';

const envSchema = z.looseObject({
  APP_PRIVATE_KEY: z.string().min(1, 'APP_PRIVATE_KEY is required'),
  APP_CLIENT_ID: z.string().min(1, 'APP_CLIENT_ID is required'),
  GITHUB_REPOSITORY: z.string().min(1, 'GITHUB_REPOSITORY is required'),
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  COMMIT_AUTHOR_NAME: z.string().optional(),
  COMMIT_AUTHOR_EMAIL: z.string().optional(),
  PR_NUMBER: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  return envSchema.parse(process.env);
}
