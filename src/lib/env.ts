import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  LEAD_PROVIDER: z.enum(["google_places", "fake"]).default("fake"),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  PROVIDER_DAILY_CALL_LIMIT: z.coerce.number().int().positive().default(500),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-opus-5-5"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Blusk Leads <nao-responda@blusk.com.br>"),
  CRON_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  NODE_ENV: z.string().default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function env(): Env {
  if (!cached) {
    cached = schema.parse(process.env);
    if (cached.NODE_ENV === "production" && cached.LEAD_PROVIDER === "fake") {
      throw new Error("LEAD_PROVIDER=fake não é permitido em produção (gera dados fictícios).");
    }
  }
  return cached;
}
