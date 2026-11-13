import { describe, expect, it } from "vitest";
import { buildFacts } from "@/lib/ai/facts";
import { sanitizePack } from "@/lib/ai/generate";
import { checkMessage, OPT_OUT_LINE } from "@/lib/ai/guard";
import { templateMessages } from "@/lib/ai/templates";
import { classifyWebsite, type BusinessData } from "@/lib/business";
import { cadenceDates } from "@/lib/crm";
import { OFFER_FILTERS } from "@/lib/filters";
import { matchesExcludedNiche } from "@/lib/niches";
import { normalizeBrPhone } from "@/lib/phone";
import { phoneHash } from "@/lib/phone-hash";
import { mapGooglePlace } from "@/lib/providers/google-places";
import { receiptIsConsistent, scoreBusiness, temperatureOf } from "@/lib/score/engine";
import { whatsappLink } from "@/lib/whatsapp";

function biz(over: Partial<BusinessData> = {}): BusinessData {
  return {
    provider: "fake", providerId: "x", nome: "Padaria Teste", categoria: "Padaria", tipos: ["bakery"],
    endereco: null, cidade: "Curitiba", uf: "PR", pais: "BR", telefoneE164: "+5541987654321", whatsappProvavel: true,
    site: null, redeSocial: null, nota: 4.5, avaliacoes: 80, horario: null, lat: null, lng: null, mapsUrl: null,
    emailPublico: null, statusFuncionamento: "OPERATIONAL", ...over,
  };
}

describe("telefone", () => {
  it("normaliza formatos comuns para E.164", () => {
    expect(normalizeBrPhone("(11) 98765-4321")?.e164).toBe("+5511987654321");
    expect(normalizeBrPhone("+55 11 98765-4321")?.e164).toBe("+5511987654321");
    expect(normalizeBrPhone("011 3333-4444")?.e164).toBe("+551133334444");
    expect(normalizeBrPhone("41 3333-4444")?.celular).toBe(false);
    expect(normalizeBrPhone("41 99999-0000")?.celular).toBe(true);
  });
  it("recusa números ambíguos em vez de chutar", () => {
    expect(normalizeBrPhone("12345")).toBeNull();
    expect(normalizeBrPhone("11 88765-4321")).toBeNull(); // 9 dígitos sem começar com 9
    expect(normalizeBrPhone("")).toBeNull();
  });
  it("hash é estável e não contém o número", () => {
    expect(phoneHash("+5511987654321")).toBe(phoneHash("+5511987654321"));
    expect(phoneHash("+5511987654321")).not.toContain("987654321");
  });
});

describe("link do WhatsApp", () => {
  it("abre a conversa com número e texto corretos e codificados", () => {
    const link = whatsappLink("+5511987654321", "Oi! Tudo bem? 50% & mais\nlinha 2");
    expect(link).toBe("https://wa.me/5511987654321?text=Oi!%20Tudo%20bem%3F%2050%25%20%26%20mais%0Alinha%202");
    expect(new URL(link).searchParams.get("text")).toBe("Oi! Tudo bem? 50% & mais\nlinha 2");
  });
});

describe("site x rede social", () => {
  it("separa domínio próprio de perfil social", () => {
    expect(classifyWebsite("https://instagram.com/loja")).toEqual({ site: null, redeSocial: "https://instagram.com/loja" });
    expect(classifyWebsite("https://www.facebook.com/loja").site).toBeNull();
    expect(classifyWebsite("https://wa.me/5511999999999").redeSocial).not.toBeNull();
    expect(classifyWebsite("https://padaria.com.br").site).toBe("https://padaria.com.br");
    expect(classifyWebsite(null)).toEqual({ site: null, redeSocial: null });
  });
});

describe("score com recibo", () => {
  it("o recibo soma exatamente a nota exibida", () => {
    const cases = [
      biz(),
      biz({ telefoneE164: null, whatsappProvavel: false, nota: null, avaliacoes: null }),
      biz({ site: "https://x.com.br", nota: 3.1, avaliacoes: 5 }),
      biz({ statusFuncionamento: "CLOSED_TEMPORARILY", telefoneE164: null }),
    ];
    for (const b of cases) {
      for (const ofertas of [[], ["motion"], ["site"], ["motion", "site", "social_media"]]) {
        const r = scoreBusiness({ business: b, ofertas });
        expect(receiptIsConsistent(r)).toBe(true);
      }
    }
  });
  it("corta em 0 e 100 e registra o corte", () => {
    const r = scoreBusiness({ business: biz({ telefoneE164: null, whatsappProvavel: false, statusFuncionamento: "CLOSED_TEMPORARILY", site: "https://a.com" }), ofertas: [] }, { sem_telefone: -50, fechado_temporariamente: -50 });
    expect(r.total).toBe(0);
    expect(r.corte).toBeGreaterThan(0);
    expect(receiptIsConsistent(r)).toBe(true);
  });
  it("respeita pesos do usuário e regra com peso zero some do recibo", () => {
    const base = scoreBusiness({ business: biz(), ofertas: ["motion"] });
    const custom = scoreBusiness({ business: biz(), ofertas: ["motion"] }, { categoria_visual: 0, telefone_presente: 25 });
    expect(custom.regras.find((r) => r.chave === "categoria_visual")).toBeUndefined();
    expect(custom.regras.find((r) => r.chave === "telefone_presente")?.pontos).toBe(25);
    expect(base.total).not.toBe(custom.total);
  });
  it("lead sem site com celular é mais quente para quem vende site", () => {
    const quente = scoreBusiness({ business: biz({ avaliacoes: 5, nota: 3.5 }), ofertas: ["site"] });
    const frio = scoreBusiness({ business: biz({ site: "https://a.com.br", telefoneE164: null, whatsappProvavel: false }), ofertas: ["site"] });
    expect(quente.total).toBeGreaterThan(frio.total);
    expect(temperatureOf(quente.total)).toBe("quente");
    expect(temperatureOf(frio.total)).toBe("frio");
  });
});

describe("filtros por oferta", () => {
  it("sem site inclui quem usa rede social no lugar do site", () => {
    expect(OFFER_FILTERS.sem_site.aplica(biz({ redeSocial: "https://instagram.com/a" }))).toBe(true);
    expect(OFFER_FILTERS.sem_site.aplica(biz({ site: "https://a.com.br" }))).toBe(false);
  });
  it("sem presença exige poucas avaliações e nenhum link", () => {
    expect(OFFER_FILTERS.sem_presenca.aplica(biz({ avaliacoes: 3 }))).toBe(true);
    expect(OFFER_FILTERS.sem_presenca.aplica(biz({ avaliacoes: 3, redeSocial: "https://instagram.com/a" }))).toBe(false);
  });
  it("potencial para vídeo exige categoria visual e boa reputação", () => {
    expect(OFFER_FILTERS.potencial_video.aplica(biz({ categoria: "Restaurante", tipos: ["restaurant"] }))).toBe(true);
    expect(OFFER_FILTERS.potencial_video.aplica(biz({ categoria: "Contabilidade", tipos: ["accounting"] }))).toBe(false);
    expect(OFFER_FILTERS.potencial_video.aplica(biz({ categoria: "Restaurante", nota: 3.2 }))).toBe(false);
  });
  it("nenhum filtro aceita negócio fechado", () => {
    for (const f of Object.values(OFFER_FILTERS)) {
      expect(f.aplica(biz({ statusFuncionamento: "CLOSED_PERMANENTLY" }))).toBe(false);
    }
  });
});

describe("nichos excluídos", () => {
  it("advocacia exclui advogados e o tipo lawyer do Google", () => {
    expect(matchesExcludedNiche(["Escritório de Advocacia"], ["advocacia"])).toBe("advocacia");
    expect(matchesExcludedNiche(["Advogado"], ["Advocacia"])).toBe("Advocacia");
    expect(matchesExcludedNiche(["lawyer"], ["advocacia"])).toBe("advocacia");
    expect(matchesExcludedNiche(["Padaria", "bakery"], ["advocacia"])).toBeNull();
  });
});

describe("mensagens: só fatos verificáveis", () => {
  const facts = buildFacts({ nome: "Padaria Sol", categoria: "Padaria", cidade: "Curitiba", site: null, redeSocial: null, nota: 4.6, avaliacoes: 132, telefoneE164: "+5541987654321" });
  const input = { facts, nomeNegocio: "Padaria Sol", estilo: "amigavel" as const, ofertas: ["motion"], sobreMim: "Faço vídeos há 6 anos.", nomeUsuario: "Ana Lima" };

  it("aceita números presentes nos fatos ou no texto do usuário", () => {
    expect(checkMessage("Vi a nota 4,6 com 132 avaliações. Trabalho há 6 anos.", facts, input.sobreMim).ok).toBe(true);
  });
  it("recusa número, preço ou promessa inventados", () => {
    expect(checkMessage("Vocês têm 500 avaliações!", facts, "").ok).toBe(false);
    expect(checkMessage("Faço por R$ 900.", facts, "").ok).toBe(false);
    expect(checkMessage("Garanto mais clientes.", facts, "").ok).toBe(false);
    expect(checkMessage("Entrego em 5 dias.", facts, "").ok).toBe(false);
  });
  it("o modelo determinístico cita fatos reais, inclui saída e passa no verificador", () => {
    const pack = templateMessages(input);
    for (const t of [pack.whatsapp.curta, pack.whatsapp.media, pack.whatsapp.pergunta, pack.email.corpo]) {
      expect(checkMessage(t, facts, input.sobreMim).ok).toBe(true);
      expect(t).toContain("SAIR");
    }
    expect(pack.whatsapp.curta).toContain("4,6");
    expect(pack.whatsapp.curta).toContain("132");
  });
  it("sem fato útil, a mensagem é genérica e honesta", () => {
    const f2 = buildFacts({ nome: "X", categoria: null, cidade: null, site: "https://x.com.br", redeSocial: null, nota: null, avaliacoes: null, telefoneE164: null });
    const pack = templateMessages({ ...input, facts: f2, nomeNegocio: "X", sobreMim: "" });
    expect(pack.whatsapp.curta.toLowerCase()).toContain("encontrei o perfil de vocês no google");
  });
  it("troca variação da IA que inventa dado pela versão segura", () => {
    const safe = templateMessages(input);
    const ai = {
      whatsapp: { curta: "Oi! Vi a nota 4,6 de vocês.", media: "Vocês faturam 50 mil por mês, certo?", pergunta: "Posso ajudar?" },
      email: { assunto: "Ideia", corpo: "Garanto resultado." },
      ligacao: ["a", "b", "c"],
    };
    const { pack, substituicoes } = sanitizePack(ai, safe, input);
    expect(pack.whatsapp.curta).toContain(OPT_OUT_LINE);
    expect(pack.whatsapp.media).toBe(safe.whatsapp.media);
    expect(pack.email.corpo).toBe(safe.email.corpo);
    expect(substituicoes.length).toBe(2);
  });
});

describe("cadência de follow-up", () => {
  it("intervalos crescentes acumulam a partir da data de contato", () => {
    expect(cadenceDates(new Date("2026-01-10T12:00:00Z"), [3, 5, 7])).toEqual(["2026-01-13", "2026-01-18", "2026-01-25"]);
  });
});

describe("mapeamento do Google Places", () => {
  it("converte o retorno oficial sem inventar campos", () => {
    const b = mapGooglePlace({
      id: "ChIJ123",
      displayName: { text: "Café Bom" },
      formattedAddress: "R. A, 1 - Centro, Curitiba - PR",
      addressComponents: [
        { longText: "Curitiba", shortText: "Curitiba", types: ["locality"] },
        { longText: "Paraná", shortText: "PR", types: ["administrative_area_level_1"] },
        { longText: "Brasil", shortText: "BR", types: ["country"] },
      ],
      nationalPhoneNumber: "(41) 99876-5432",
      websiteUri: "https://instagram.com/cafebom",
      rating: 4.66,
      userRatingCount: 87,
      primaryTypeDisplayName: { text: "Cafeteria" },
      types: ["cafe"],
      businessStatus: "OPERATIONAL",
    });
    expect(b).toMatchObject({ cidade: "Curitiba", uf: "PR", telefoneE164: "+5541998765432", whatsappProvavel: true, site: null, nota: 4.7, avaliacoes: 87, emailPublico: null });
    expect(b.redeSocial).toBe("https://instagram.com/cafebom");
  });
});
