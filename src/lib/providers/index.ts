import { FakeProvider } from "./fake";
import { GooglePlacesProvider } from "./google-places";
import type { LeadProvider } from "./types";

export function getLeadProvider(): LeadProvider {
  const kind = process.env.LEAD_PROVIDER ?? "fake";
  if (kind === "google_places") return new GooglePlacesProvider(process.env.GOOGLE_PLACES_API_KEY ?? "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("O provedor de dados fictícios não pode ser usado em produção.");
  }
  return new FakeProvider();
}

export * from "./types";
