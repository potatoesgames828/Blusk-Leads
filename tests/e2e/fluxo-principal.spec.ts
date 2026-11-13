import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const db = postgres(process.env.E2E_DATABASE_URL ?? "postgres://blusk_owner:blusk@localhost:5432/blusk_e2e", { max: 2, onnotice: () => {} });

test.afterAll(async () => {
  await db.end();
});

async function signupAndConfirm(page: Page, email: string, nome = "Ana Motion") {
  await page.goto("/cadastrar");
  await page.getByLabel("Seu nome").fill(nome);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha123abc");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar conta grátis" }).click();
  await expect(page).toHaveURL(/confirmar-email/);
  await expect(page.getByRole("heading", { name: "Confirme seu e-mail" })).toBeVisible();

  const [mail] = await db<{ corpo_texto: string }[]>`select corpo_texto from outbox_emails where para = ${email} order by created_at desc limit 1`;
  const link = /(http:\/\/\S+confirmar-email\?token=\S+)/.exec(mail!.corpo_texto)![1]!;
  await page.goto(new URL(link).pathname + new URL(link).search);
  await expect(page.getByText("Tudo certo! Sua conta está ativa.")).toBeVisible();
  await page.getByRole("link", { name: "Continuar" }).click();
}

async function onboarding(page: Page) {
  await expect(page.getByRole("heading", { name: "Vamos ajustar o Blusk Leads para você" })).toBeVisible();
  await expect(page.getByLabel("Motion graphics e vídeo")).toBeChecked();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Nichos que você NÃO quer atender")).toHaveValue("advocacia");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Sobre você e seu serviço").fill("Faço vídeos animados para negócios locais.");
  await page.getByRole("button", { name: "Começar a buscar" }).click();
  await expect(page).toHaveURL(/\/buscar\?bemvindo=1/);
}

test("cadastro → busca → mensagem → WhatsApp → CRM → persistência → saldo", async ({ page }) => {
  const email = `ana${Date.now()}@e2e.local`;
  await signupAndConfirm(page, email);
  await onboarding(page);

  // Teste grátis: 5 créditos, busca no Brasil todo.
  await expect(page.getByText("5 créditos").first()).toBeVisible();
  await expect(page.getByText("Região: Brasil todo.")).toBeVisible();
  await page.getByLabel("Nicho").fill("restaurante");
  await page.getByLabel("Filtro por oferta").selectOption("qualquer");
  await page.getByRole("button", { name: "Buscar leads" }).click();

  await expect(page).toHaveURL(/\/buscar\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/leads novos entregues|Você só pagou pelos entregues/)).toBeVisible({ timeout: 30_000 });
  const cards = page.getByRole("link", { name: /\[FICTÍCIO\]/ });
  await expect(cards).toHaveCount(5);

  // Recibo do score soma a nota exibida (abre o primeiro lead).
  await page.getByText("Selecionar todos").click();
  await page.getByRole("button", { name: "Enviar para o CRM" }).click();
  await expect(page.getByText("5 leads enviados para o CRM.")).toBeVisible();

  await cards.first().click();
  await expect(page.getByRole("heading", { name: /Por que a nota \d+\?/ })).toBeVisible();
  const heading = await page.getByRole("heading", { name: /Por que a nota/ }).textContent();
  const nota = Number(/(\d+)/.exec(heading!)![1]);
  const totalCell = page.getByRole("row", { name: /Total/ }).getByRole("cell").last();
  await expect(totalCell).toHaveText(String(nota));

  // Mensagem e link do WhatsApp corretos.
  await page.getByRole("button", { name: "Gerar mensagem" }).click();
  const textarea = page.getByLabel("Texto da mensagem (pode editar)");
  await expect(textarea).toContainText("SAIR");
  const msg = await textarea.inputValue();
  const link = page.getByTestId("whatsapp-link");
  if (await link.count()) {
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/5510\d{8,9}\?text=/);
    expect(new URL(href!).searchParams.get("text")).toBe(msg.trim());
  }
  await page.getByRole("button", { name: "Já enviei: marcar como contatado" }).click();
  await expect(page.getByText("Marcado como contatado. Criamos lembretes de follow-up para você.")).toBeVisible();

  // CRM: lead em "Contatado"; mover outro para "Qualificado" e recarregar.
  await page.goto("/crm");
  await expect(page.getByTestId("column-Contatado").getByTestId("kanban-card")).toHaveCount(1);
  const novo = page.getByTestId("column-Novo").getByTestId("kanban-card");
  await expect(novo).toHaveCount(4);
  await novo.first().getByTestId("move-select").selectOption({ label: "Mover para: Qualificado" });
  await expect(page.getByText("Etapa atualizada.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("column-Qualificado").getByTestId("kanban-card")).toHaveCount(1);
  await expect(page.getByTestId("column-Novo").getByTestId("kanban-card")).toHaveCount(3);

  // Perdido exige motivo.
  await page.getByTestId("column-Novo").getByTestId("kanban-card").first().getByTestId("move-select").selectOption({ label: "Mover para: Perdido" });
  await expect(page.getByRole("heading", { name: "Por que este lead foi perdido?" })).toBeVisible();
  await page.getByLabel("Motivo").selectOption("preco");
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Etapa atualizada.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("column-Perdido").getByTestId("kanban-card")).toHaveCount(1);

  // Saldo: 5 leads entregues = 5 créditos usados, com extrato.
  await page.goto("/saldo");
  await expect(page.getByTestId("saldo")).toContainText("0");
  await expect(page.getByText("Teste grátis: 5 leads, sem cartão")).toBeVisible();

  // Hoje mostra o painel.
  await page.goto("/hoje");
  await expect(page.getByRole("heading", { name: "Olá, Ana!" })).toBeVisible();
});

test("isolamento: outra conta não acessa busca nem lead de ninguém", async ({ page, browser }) => {
  const emailA = `a${Date.now()}@e2e.local`;
  await signupAndConfirm(page, emailA, "Bia");
  await onboarding(page);
  await page.getByLabel("Nicho").fill("academia");
  await page.getByLabel("Filtro por oferta").selectOption("qualquer");
  await page.getByRole("button", { name: "Buscar leads" }).click();
  await expect(page).toHaveURL(/\/buscar\/[0-9a-f-]{36}$/);
  const searchUrl = page.url();
  const searchId = searchUrl.split("/").pop()!;
  await expect(page.getByRole("link", { name: /\[FICTÍCIO\]/ }).first()).toBeVisible({ timeout: 30_000 });
  const leadHref = await page.getByRole("link", { name: /\[FICTÍCIO\]/ }).first().getAttribute("href");

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signupAndConfirm(pageB, `b${Date.now()}@e2e.local`, "Caio");
  await onboarding(pageB);
  const api = await pageB.request.get(`/api/searches/${searchId}`);
  expect(api.status()).toBe(404);
  await pageB.goto(`/buscar/${searchId}`);
  await expect(pageB.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await pageB.goto(leadHref!);
  await expect(pageB.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  await ctxB.close();
});

test("Remover minha empresa tira o lead do CRM", async ({ page }) => {
  await signupAndConfirm(page, `c${Date.now()}@e2e.local`, "Duda");
  await onboarding(page);
  await page.getByLabel("Nicho").fill("pizzaria");
  await page.getByLabel("Filtro por oferta").selectOption("qualquer");
  await page.getByRole("button", { name: "Buscar leads" }).click();
  await expect(page.getByRole("link", { name: /\[FICTÍCIO\]/ }).first()).toBeVisible({ timeout: 30_000 });
  const searchId = page.url().split("/").pop()!;
  const [biz] = await db<{ nome: string; telefone_e164: string }[]>`
    select b.nome, b.telefone_e164 from leads l join businesses b on b.id = l.business_id
    where l.search_id = ${searchId} and b.telefone_e164 is not null limit 1`;

  await page.goto("/remover-empresa");
  await page.getByLabel("Nome da empresa").fill(biz!.nome);
  await page.getByLabel("Telefone da empresa, com DDD").fill(biz!.telefone_e164.replace("+55", ""));
  await page.getByRole("button", { name: "Remover minha empresa" }).click();
  await expect(page.getByText("Pronto. Sua empresa foi bloqueada em todas as contas")).toBeVisible();

  await page.goto(`/buscar/${searchId}`);
  await expect(page.getByRole("link", { name: biz!.nome, exact: true })).toHaveCount(0);
});
