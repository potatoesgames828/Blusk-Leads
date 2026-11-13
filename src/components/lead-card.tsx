import Link from "next/link";
import { formatBrPhone } from "@/lib/phone";
import type { LeadCard as LeadCardData } from "@/lib/queries";
import { Badge, TempBadge } from "./ui";

const fmtNota = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function LeadFacts({ lead }: { lead: Pick<LeadCardData, "telefone_e164" | "whatsapp_provavel" | "site" | "rede_social" | "nota" | "avaliacoes"> }) {
  return (
    <ul className="flex flex-wrap gap-1.5 text-xs">
      <li>
        <Badge>
          {lead.telefone_e164 ? formatBrPhone(lead.telefone_e164) : "Telefone não disponível"}
          {lead.whatsapp_provavel && <span className="ml-1 text-emerald-700">· WhatsApp provável</span>}
        </Badge>
      </li>
      <li>
        <Badge>{lead.site ? "Tem site" : lead.rede_social ? "Usa rede social como site" : "Sem site"}</Badge>
      </li>
      <li>
        <Badge>
          {lead.nota !== null && lead.avaliacoes ? `★ ${fmtNota(lead.nota)} · ${lead.avaliacoes} avaliações` : "Sem avaliações no Google"}
        </Badge>
      </li>
    </ul>
  );
}

export function LeadCard({ lead, children }: { lead: LeadCardData; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/leads/${lead.id}`} className="block truncate text-[17px] font-bold hover:text-brand-700">
            {lead.nome}
          </Link>
          <p className="truncate text-sm text-ink-600">
            {[lead.categoria, lead.cidade && `${lead.cidade}${lead.uf ? ` - ${lead.uf}` : ""}`].filter(Boolean).join(" · ") || "Categoria não disponível"}
          </p>
        </div>
        <TempBadge temp={lead.temperatura} score={lead.score} />
      </div>
      <div className="mt-3">
        <LeadFacts lead={lead} />
      </div>
      {children}
    </div>
  );
}
