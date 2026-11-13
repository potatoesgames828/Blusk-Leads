import type { BusinessData } from "../business";

export interface ProviderQuery {
  nicho: string;
  /** Cidade e UF, quando a busca é por cidade. Ausentes = Brasil todo. */
  cidade?: string | null;
  uf?: string | null;
}

export interface ProviderPage {
  businesses: BusinessData[];
  nextPageToken: string | null;
}

export type ProviderErrorCode = "quota" | "auth" | "network" | "invalid" | "unknown";

export class ProviderError extends Error {
  constructor(
    public code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Fonte de dados de empresas. Trocável: hoje Google Places (oficial) e um provedor
 * de dados FICTÍCIOS para desenvolvimento e testes. Nunca raspagem.
 */
export interface LeadProvider {
  readonly id: BusinessData["provider"];
  /** No máximo 20 resultados por página. */
  searchPage(query: ProviderQuery, pageToken?: string | null): Promise<ProviderPage>;
  getDetails(providerId: string): Promise<BusinessData | null>;
}
