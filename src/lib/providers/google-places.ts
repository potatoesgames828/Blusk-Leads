import { classifyWebsite, type BusinessData } from "../business";
import { normalizeBrPhone } from "../phone";
import { ProviderError, type LeadProvider, type ProviderPage, type ProviderQuery } from "./types";

const ENDPOINT = "https://places.googleapis.com/v1";

// Pedimos só os campos que usamos: o preço da Places API depende dos campos pedidos.
const PLACE_FIELDS = [
  "id", "displayName", "formattedAddress", "addressComponents", "nationalPhoneNumber",
  "internationalPhoneNumber", "websiteUri", "rating", "userRatingCount",
  "regularOpeningHours.weekdayDescriptions", "location", "googleMapsUri",
  "primaryTypeDisplayName", "types", "businessStatus",
];

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  businessStatus?: BusinessData["statusFuncionamento"];
}

export function mapGooglePlace(p: GooglePlace): BusinessData {
  const comp = (type: string) => p.addressComponents?.find((c) => c.types.includes(type));
  const phone = normalizeBrPhone(p.internationalPhoneNumber ?? p.nationalPhoneNumber);
  const { site, redeSocial } = classifyWebsite(p.websiteUri);
  return {
    provider: "google_places",
    providerId: p.id,
    nome: p.displayName?.text ?? "(sem nome)",
    categoria: p.primaryTypeDisplayName?.text ?? null,
    tipos: p.types ?? [],
    endereco: p.formattedAddress ?? null,
    cidade: (comp("locality") ?? comp("administrative_area_level_2"))?.longText ?? null,
    uf: comp("administrative_area_level_1")?.shortText ?? null,
    pais: comp("country")?.shortText ?? "BR",
    telefoneE164: phone?.e164 ?? null,
    whatsappProvavel: phone?.celular ?? false,
    site,
    redeSocial,
    nota: typeof p.rating === "number" ? Math.round(p.rating * 10) / 10 : null,
    avaliacoes: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    horario: p.regularOpeningHours?.weekdayDescriptions ?? null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    mapsUrl: p.googleMapsUri ?? null,
    emailPublico: null, // O Google não fornece e-mail. Nunca inventamos.
    statusFuncionamento: p.businessStatus ?? null,
  };
}

async function call<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    throw new ProviderError("network", `Falha de rede ao consultar o Google: ${(err as Error).message}`);
  }
  if (res.ok) return (await res.json()) as T;
  const body = await res.text().catch(() => "");
  if (res.status === 429) throw new ProviderError("quota", "Limite de consultas do Google atingido");
  if (res.status === 401 || res.status === 403) throw new ProviderError("auth", "Chave do Google inválida ou sem permissão");
  if (res.status === 400) throw new ProviderError("invalid", `Consulta inválida: ${body.slice(0, 200)}`);
  throw new ProviderError("unknown", `Erro ${res.status} do Google`);
}

export class GooglePlacesProvider implements LeadProvider {
  readonly id = "google_places" as const;
  constructor(private apiKey: string) {
    if (!apiKey) throw new ProviderError("auth", "GOOGLE_PLACES_API_KEY não configurada");
  }

  async searchPage(query: ProviderQuery, pageToken?: string | null): Promise<ProviderPage> {
    const where = query.cidade ? `em ${query.cidade}${query.uf ? ` - ${query.uf}` : ""}` : "no Brasil";
    const body: Record<string, unknown> = {
      textQuery: `${query.nicho} ${where}`,
      languageCode: "pt-BR",
      regionCode: "BR",
      pageSize: 20,
    };
    if (pageToken) body.pageToken = pageToken;
    const data = await call<{ places?: GooglePlace[]; nextPageToken?: string }>(`${ENDPOINT}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": [...PLACE_FIELDS.map((f) => `places.${f}`), "nextPageToken"].join(","),
      },
      body: JSON.stringify(body),
    });
    return { businesses: (data.places ?? []).map(mapGooglePlace), nextPageToken: data.nextPageToken ?? null };
  }

  async getDetails(providerId: string): Promise<BusinessData | null> {
    try {
      const p = await call<GooglePlace>(`${ENDPOINT}/places/${encodeURIComponent(providerId)}?languageCode=pt-BR`, {
        headers: { "X-Goog-Api-Key": this.apiKey, "X-Goog-FieldMask": PLACE_FIELDS.join(",") },
      });
      return mapGooglePlace(p);
    } catch (err) {
      if (err instanceof ProviderError && err.code === "invalid") return null;
      throw err;
    }
  }
}
