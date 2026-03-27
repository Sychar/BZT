import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.string().optional(),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  CRON_ENABLED: z.string().optional()
});

export const env = EnvSchema.parse(process.env);
