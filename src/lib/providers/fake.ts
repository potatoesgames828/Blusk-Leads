import { createHash } from "node:crypto";
import { classifyWebsite, type BusinessData } from "../business";
import { normalizeBrPhone } from "../phone";
import { ProviderError, type LeadProvider, type ProviderPage, type ProviderQuery } from "./types";

/**
 * Provedor de dados FICTÍCIOS, só para desenvolvimento e testes automatizados.
 * - Todo nome começa com "[FICTÍCIO]".
 * - Todo telefone usa o DDD 10, que não existe no Brasil: nenhuma mensagem chega a uma pessoa real.
 * - É determinístico: a mesma consulta sempre devolve os mesmos negócios (ajuda a testar deduplicação).
 * Nichos especiais para testes: "erro" (falha do provedor) e "vazio" (nenhum resultado).
 */
const PER_QUERY = 30;

function rng(seed: string) {
  let h = createHash("sha256").update(seed).digest().readUInt32LE(0);
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 2 ** 32;
  };
}

function fakeBusiness(query: ProviderQuery, i: number): BusinessData {
  const nicho = query.nicho.trim();
  const cidade = query.cidade ?? "São Paulo";
  const uf = query.uf ?? "SP";
  const r = rng(`${nicho.toLowerCase()}|${cidade.toLowerCase()}|${i}`);
  const celular = r() < 0.7;
  const numero = celular ? `9${String(Math.floor(r() * 1e8)).padStart(8, "0")}` : `3${String(Math.floor(r() * 1e7)).padStart(7, "0")}`;
  const temTelefone = r() < 0.9;
  const siteRoll = r();
  const website = siteRoll < 0.35 ? null : siteRoll < 0.6 ? `https://instagram.com/ficticio${i}` : `https://ficticio-${i}.example.com`;
  const { site, redeSocial } = classifyWebsite(website);
  const temNota = r() < 0.9;
  const phone = temTelefone ? normalizeBrPhone(`10${numero}`) : null;
  const categoria = nicho.charAt(0).toUpperCase() + nicho.slice(1);
  return {
    provider: "fake",
    providerId: `fake:${createHash("sha1").update(`${nicho.toLowerCase()}|${cidade.toLowerCase()}|${i}`).digest("hex").slice(0, 16)}`,
    nome: `[FICTÍCIO] ${categoria} Exemplo ${i + 1}`,
    categoria,
    tipos: [nicho.toLowerCase()],
    endereco: `Rua Fictícia, ${100 + i} - ${cidade} - ${uf}`,
    cidade,
    uf,
    pais: "BR",
    telefoneE164: phone?.e164 ?? null,
    whatsappProvavel: phone?.celular ?? false,
    site,
    redeSocial,
    nota: temNota ? Math.round((3 + r() * 2) * 10) / 10 : null,
    avaliacoes: temNota ? Math.floor(r() * 200) : 0,
    horario: ["segunda-feira: 09:00–18:00", "sábado: 09:00–13:00", "domingo: Fechado"],
    lat: null,
    lng: null,
    mapsUrl: null,
    emailPublico: null,
    statusFuncionamento: r() < 0.05 ? "CLOSED_TEMPORARILY" : "OPERATIONAL",
  };
}

export class FakeProvider implements LeadProvider {
  readonly id = "fake" as const;

  async searchPage(query: ProviderQuery, pageToken?: string | null): Promise<ProviderPage> {
    const nicho = query.nicho.trim().toLowerCase();
    if (nicho === "erro") throw new ProviderError("unknown", "Falha simulada do provedor");
    if (nicho === "vazio") return { businesses: [], nextPageToken: null };
    const start = pageToken ? Number(pageToken) : 0;
    const end = Math.min(start + 20, PER_QUERY);
    const businesses = Array.from({ length: end - start }, (_, k) => fakeBusiness(query, start + k));
    return { businesses, nextPageToken: end < PER_QUERY ? String(end) : null };
  }

  async getDetails(): Promise<BusinessData | null> {
    return null; // Dados fictícios não expiram.
  }
}
