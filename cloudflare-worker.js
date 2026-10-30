/**
 * Nicko Assistant - Cloudflare Workers AI (sem API paga da OpenAI).
 * Requer o binding Workers AI chamado AI e o secret NICKO_ACCESS_CODE.
 * Modelo: @cf/meta/llama-3.2-3b-instruct
 */
const ALLOWED_ORIGIN = "https://nickebel.github.io";
const MODEL = "@cf/meta/llama-3.2-3b-instruct";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin",
    },
  });
}

async function askAI(env, instructions, messages, maxTokens = 1200) {
  if (!env.AI || typeof env.AI.run !== "function") {
    throw new Error("O vínculo Workers AI não foi encontrado. Confira se o binding se chama AI.");
  }

  const result = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: instructions },
      ...messages,
    ],
    max_tokens: maxTokens,
    temperature: 0.6,
  });

  const reply = typeof result?.response === "string" ? result.response.trim() : "";
  if (!reply) throw new Error("A IA não retornou texto. Tente novamente em instantes.");
  return { reply, sources: [] };
}

const BASE_INSTRUCTIONS =
  "Você é o Nicko Assistant, o assistente pessoal digital do usuário. Converse sempre em português do Brasil, salvo quando o usuário pedir outro idioma.\n" +
  "PERSONALIDADE: seja próximo, gentil, natural, paciente e confiável. Use linguagem simples e informal na medida certa, sem gírias forçadas. Use poucos emojis, apenas quando combinarem. Não chame o usuário pelo nome em toda resposta.\n" +
  "ESTILO: responda primeiro ao que foi perguntado. Prefira respostas curtas, claras e humanas; aprofunde quando o assunto exigir. Use Markdown padrão: títulos com # ou ##, termos importantes entre **dois asteriscos** para negrito, listas com - e passos com 1. 2. 3. Quando o usuário pedir uma resposta formatada, cumpra explicitamente os formatos solicitados. Não use linhas de sinais de igual ou hífens para sublinhar títulos. Não escreva asteriscos literais fora da marcação Markdown. Evite excesso de títulos e listas.\n" +
  "AJUDA: organize ideias, listas de tarefas, rotinas, estudos, textos, mensagens, planejamento e dúvidas de tecnologia. Ao ensinar algo técnico, use palavras simples, explique termos necessários e não presuma conhecimento avançado.\n" +
  "CONTEXTO: quando relevante, considere que o usuário vive em São Miguel dos Campos, Alagoas. A rotina de trabalho informada é de segunda a sexta, 07h às 12h e 13h às 17h, e sábado, 07h às 12h. O usuário prefere explicações simples, diretas e humanizadas. Use esses dados somente quando forem úteis; não os repita sem necessidade.\n" +
  "INFORMAÇÕES ATUAIS: nesta versão, você não tem pesquisa na web nem acesso a informações ao vivo. Para notícias, preços, horários ou acontecimentos recentes, informe claramente que não consegue verificar em tempo real e convide a pessoa a enviar um link ou texto para analisar. Não invente fontes, links, dados ou datas.\n" +
  "LIMITES: não diga que acessa arquivos, agenda, aplicativos ou tarefas do aparelho. Não afirme que cria alarmes, envia mensagens, monitora o celular, executa comandos ou trabalha em segundo plano, a menos que uma integração realmente faça isso. Não afirme que salva memórias permanentes. Use apenas o contexto da conversa e as informações fixas acima.";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== ALLOWED_ORIGIN) {
      return new Response("Origin not allowed", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    const url = new URL(request.url);
    const auth = request.headers.get("Authorization") || "";
    if (!env.NICKO_ACCESS_CODE || auth !== ("Bearer " + env.NICKO_ACCESS_CODE)) {
      return json({ error: "Código de acesso incorreto ou não configurado." }, 401);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "Nicko Assistant", aiConfigured: !!env.AI });
    }

    if (request.method !== "POST") return json({ error: "Rota não encontrada." }, 404);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Envie um JSON válido." }, 400);
    }

    try {
      if (url.pathname === "/api/chat") {
        const message = String(body.message || "").trim().slice(0, 2000);
        if (!message) return json({ error: "Escreva uma mensagem para o assistente." }, 400);

        const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
        const messages = history
          .filter(item => item && ["user", "assistant"].includes(item.role))
          .map(item => ({
            role: item.role,
            content: String(item.content || "").slice(0, 2000),
          }));
        messages.push({ role: "user", content: message });

        return json(await askAI(env, BASE_INSTRUCTIONS, messages, 1200));
      }

      if (url.pathname === "/api/news") {
        return json({
          reply: "A pesquisa automática de notícias ainda não está ativada nesta versão. Para não inventar manchetes, o Nicko não vai apresentar notícias como se fossem atuais. Envie um link ou copie o texto de uma matéria no chat para que eu possa resumir e explicar.",
          sources: [],
        });
      }

      return json({ error: "Rota não encontrada." }, 404);
    } catch (error) {
      return json({
        error: error instanceof Error ? error.message : "Falha inesperada no serviço.",
      }, 502);
    }
  },
};
