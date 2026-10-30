/**
 * Nicko Assistant - secure AI bridge for Cloudflare Workers.
 * Configure secrets: OPENAI_API_KEY and NICKO_ACCESS_CODE.
 * Optional variable: OPENAI_MODEL (defaults to gpt-6-astra).
 */
const ALLOWED_ORIGIN = "https://nickebel.github.io";
const API_URL = "https://api.openai.com/v1/responses";

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

function extractText(response) {
  const pieces = [];
  const sources = [];
  for (const item of response.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      if (part.type === "output_text" && part.text) pieces.push(part.text);
      for (const annotation of part.annotations || []) {
        if (annotation.type === "url_citation" && annotation.url) {
          sources.push({ title: annotation.title || annotation.url, url: annotation.url });
        }
      }
    }
  }
  const unique = [...new Map(sources.map(item => [item.url, item])).values()];
  return { reply: pieces.join("\n\n").trim(), sources: unique };
}

async function askOpenAI(env, instructions, input, maxOutputTokens = 1200) {
  if (!env.OPENAI_API_KEY) throw new Error("A chave da API ainda não foi configurada no Worker.");
  const result = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-6-astra",
      instructions: instructions,
      input: input,
      tools: [{ type: "web_search" }],
      max_output_tokens: maxOutputTokens,
    }),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    throw new Error((payload.error && payload.error.message) || ("A API respondeu com o código " + result.status + "."));
  }
  const answer = extractText(payload);
  if (!answer.reply) throw new Error("A API não retornou texto. Verifique o modelo e os limites do projeto.");
  return answer;
}

const BASE_INSTRUCTIONS = "Você é o Nicko Assistant, um assistente pessoal amigável que conversa em português do Brasil.\n" +
  "Seja claro, acolhedor e prático. Responda diretamente, explique termos difíceis e use listas curtas quando ajudarem.\n" +
  "Quando a pergunta envolver informações atuais, pesquise na web antes de responder. Priorize fontes confiáveis e datas explícitas.\n" +
  "Não invente acontecimentos, dados, links ou compromissos. Diferencie fatos confirmados de estimativas.\n" +
  "O usuário mora em São Miguel dos Campos, Alagoas, Brasil, quando contexto local for relevante. O horário informado de trabalho é de segunda a sexta, 07h–12h e 13h–17h, e sábado, 07h–12h. Não afirme que consegue monitorar o celular ou executar tarefas em segundo plano.";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== ALLOWED_ORIGIN) return new Response("Origin not allowed", { status: 403 });

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
      return json({ ok: true, service: "Nicko Assistant" });
    }
    if (request.method !== "POST") return json({ error: "Rota não encontrada." }, 404);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Envie um JSON válido." }, 400); }

    try {
      if (url.pathname === "/api/chat") {
        const message = String(body.message || "").trim().slice(0, 2000);
        if (!message) return json({ error: "Escreva uma mensagem para o assistente." }, 400);
        const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
        const transcript = history
          .filter(item => item && ["user", "assistant"].includes(item.role))
          .map(item => (item.role === "assistant" ? "Nicko Assistant" : "Usuário") + ": " + String(item.content || "").slice(0, 2000))
          .join("\n\n");
        const input = (transcript ? "Conversa anterior:\n" + transcript + "\n\n" : "") + "Nova mensagem do usuário:\n" + message;
        return json(await askOpenAI(env, BASE_INSTRUCTIONS, input, 1200));
      }

      if (url.pathname === "/api/news") {
        const labels = {
          geral: "principais notícias do Brasil e do mundo, com uma seção para Alagoas e outra para tecnologia",
          brasil: "notícias do Brasil, especialmente política, economia, serviços e sociedade",
          mundo: "principais notícias internacionais e geopolítica",
          alagoas: "notícias de Alagoas, com atenção a São Miguel dos Campos e região quando houver cobertura relevante",
          tecnologia: "tecnologia, ciência digital e inteligência artificial",
        };
        const topic = labels[String(body.topic || "geral")] || labels.geral;
        const instructions = BASE_INSTRUCTIONS + "\nVocê também é editor de um boletim informativo. Não use manchetes antigas como se fossem de hoje. Informe as datas dos acontecimentos. Inclua referências a fontes confiáveis; as citações da pesquisa serão mostradas no aplicativo.";
        const localNow = new Date().toLocaleString("pt-BR", { timeZone: "America/Maceio" });
        const input = "Prepare um boletim de notícias atualizado para hoje (" + localNow + ", horário de Alagoas). Tema: " + topic + ".\n" +
          "Pesquise notícias publicadas preferencialmente nas últimas 24 horas. Se houver poucas, amplie para 72 horas e deixe isso claro. Selecione de 5 a 8 notícias realmente relevantes. Para cada uma, escreva uma manchete curta, um resumo objetivo de 2 ou 3 frases e por que ela importa. Organize com títulos e tópicos. Termine com uma pequena seção 'O que merece atenção'. Não invente fatos nem datas; se não houver notícia local relevante, diga isso com transparência.";
        return json(await askOpenAI(env, instructions, input, 1800));
      }
      return json({ error: "Rota não encontrada." }, 404);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Falha inesperada no serviço." }, 502);
    }
  },
};
