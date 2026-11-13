/** Dados de um negócio como vieram do provedor (já normalizados). Nada aqui é inventado. */
export interface BusinessData {
  provider: "google_places" | "fake" | "csv" | "manual";
  providerId: string;
  nome: string;
  categoria: string | null;
  tipos: string[];
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  pais: string;
  telefoneE164: string | null;
  whatsappProvavel: boolean;
  site: string | null; // domínio próprio (nunca uma rede social)
  redeSocial: string | null; // perfil divulgado no lugar do site, quando for o caso
  nota: number | null;
  avaliacoes: number | null;
  horario: string[] | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  emailPublico: string | null;
  statusFuncionamento: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | null;
}

const SOCIAL_HOSTS = [
  "instagram.com", "facebook.com", "fb.com", "fb.me", "wa.me", "api.whatsapp.com", "whatsapp.com",
  "linktr.ee", "tiktok.com", "linkedin.com", "youtube.com", "twitter.com", "x.com", "beacons.ai", "bio.link",
];

/** Separa "site" de verdade de um perfil de rede social cadastrado como site no Google. */
export function classifyWebsite(url: string | null | undefined): { site: string | null; redeSocial: string | null } {
  if (!url) return { site: null, redeSocial: null };
  let host = "";
  try {
    host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return { site: null, redeSocial: null };
  }
  const social = SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return social ? { site: null, redeSocial: url } : { site: url, redeSocial: null };
}
