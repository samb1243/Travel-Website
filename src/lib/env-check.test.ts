import { describe, expect, it } from "vitest";
import { checkProductionSettings } from "./env-check";

const good = {
  DATABASE_URL: "postgresql://u:p@ep-x-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require",
  BETTER_AUTH_SECRET: "q9Zt3vYp1sLk8Nf2Wm5Rb7Xc4Hd6Jg0A",
  BETTER_AUTH_URL: "https://tripster.example.com",
  RESEND_API_KEY: "re_123",
  EMAIL_FROM: "Tripster <hello@tripster.example.com>",
  NEXT_PUBLIC_MAPTILER_KEY: "abcdefgh1234",
  NOMINATIM_USER_AGENT: "Tripster (https://tripster.example.com)",
};

describe("checkProductionSettings", () => {
  it("passes a complete setup", () => {
    expect(checkProductionSettings(good)).toEqual({ errors: [], warnings: [] });
  });

  it("stops on missing essentials", () => {
    const { errors } = checkProductionSettings({
      ...good,
      DATABASE_URL: "",
      BETTER_AUTH_SECRET: "replace-me-with-a-long-random-string",
      BETTER_AUTH_URL: "http://localhost:3000",
    });
    expect(errors).toHaveLength(3);
  });

  it("rejects a site address with a path or without https", () => {
    expect(checkProductionSettings({ ...good, BETTER_AUTH_URL: "https://tripster.example.com/" }).errors).toHaveLength(1);
    expect(checkProductionSettings({ ...good, BETTER_AUTH_URL: "tripster.example.com" }).errors).toHaveLength(1);
  });

  it("only warns about optional services", () => {
    const { errors, warnings } = checkProductionSettings({ ...good, RESEND_API_KEY: "", NEXT_PUBLIC_MAPTILER_KEY: undefined, GOOGLE_CLIENT_ID: "x" });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(3);
  });
});
