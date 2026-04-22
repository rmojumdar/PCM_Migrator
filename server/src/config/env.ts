import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const schema = z.object({
  SESSION_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(3001),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  SF_API_VERSION: z.string().default('59.0'),

  // Optional pre-filled credentials for dev convenience
  SOURCE_INSTANCE_URL: z.string().optional(),
  SOURCE_CLIENT_ID: z.string().optional(),
  SOURCE_CLIENT_SECRET: z.string().optional(),

  TARGET_INSTANCE_URL: z.string().optional(),
  TARGET_CLIENT_ID: z.string().optional(),
  TARGET_CLIENT_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
