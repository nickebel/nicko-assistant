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


function decodeXml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, code) => {
      const point = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      try { return String.fromCodePoint(point); } catch { return ""; }
    })
    .replace(/\s+/g, " ")
    .trim();
}

function readXmlTag(block, tag) {
  const match = block.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"));
  return match ? decodeXml(match[1]) : "";
}

function parseNewsRss(xml, limit = 12) {
  const matches = [...String(xml).matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  return matches.map(match => {
    const block = match[1];
    const title = readXmlTag(block, "title");
    const url = readXmlTag(block, "link");
    const publishedAt = readXmlTag(block, "pubDate");
    const source = readXmlTag(block, "source");
    return { title, url, publishedAt, source };
  }).filter(item => item.title && /^https:\/\//i.test(item.url)).slice(0, limit);
}

function normalizeText(value = "") {
  return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function detectNewsTopic(message = "") {
  const text = normalizeText(message);
  if (/\b(alagoas|maceio)\b/.test(text)) return "alagoas";
  if (/\b(tecnologia|inteligencia artificial|ia)\b/.test(text)) return "tecnologia";
  if (/\b(mundo|internacional|exterior)\b/.test(text)) return "mundo";
  if (/\b(brasil|brasileir[oa]s?)\b/.test(text)) return "brasil";
  return "geral";
}

function isCurrentNewsRequest(message = "") {
  const text = normalizeText(message);
  const mentionsNews = /\b(noticias?|manchetes?|atualidades|news)\b/.test(text);
  const asksCurrent = /\b(agora|hoje|atual|atualizadas?|tempo real|ultimas?|recentes?|acontecendo)\b/.test(text);
  return mentionsNews && (asksCurrent || /\b(noticias?|manchetes?)\b/.test(text));
}

async function createNewsBrief(env, topic = "geral") {
  const searches = {
    geral: "",
    brasil: "Brasil when:1d",
    mundo: "(mundo OR internacional) when:1d",
    alagoas: "(Alagoas OR Maceió) when:7d",
    tecnologia: "(tecnologia OR inteligência artificial) when:1d",
  };
  const safeTopic = Object.prototype.hasOwnProperty.call(searches, topic) ? topic : "geral";
  const query = searches[safeTopic];
  const feedUrl = new URL(query ? "https://news.google.com/rss/search" : "https://news.google.com/rss");
  if (query) feedUrl.searchParams.set("q", query);
  feedUrl.searchParams.set("hl", "pt-BR");
  feedUrl.searchParams.set("gl", "BR");
  feedUrl.searchParams.set("ceid", "BR:pt-419");

  const feedResponse = await fetch(feedUrl.toString(), {
    headers: { "Accept": "application/rss+xml, application/xml, text/xml" },
  });
  if (!feedResponse.ok) throw new Error("O feed de notícias não respondeu agora. Tente novamente em instantes.");
  const articles = parseNewsRss(await feedResponse.text(), 12);
  if (!articles.length) {
    return {
      reply: "Não encontrei manchetes recentes para esse tema agora. Experimente outra categoria.",
      sources: [],
    };
  }

  const now = new Date();
  const updatedAt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Maceio", dateStyle: "short", timeStyle: "short",
  }).format(now);
  const headlines = articles.map((item, index) =>
    (index + 1) + ". " + item.title +
    (item.source ? " — Fonte: " + item.source : "") +
    (item.publishedAt ? " — Publicado em: " + item.publishedAt : "")
  ).join("\n");

  let summaryText;
  try {
    const summary = await askAI(
      env,
      "Você é o editor de notícias do Nicko. Resuma as manchetes fornecidas em português do Brasil, em até 5 tópicos curtos. Use somente fatos explícitos nos títulos; não invente detalhes, causas, números, citações ou consequências. Não diga que não tem acesso a notícias, pois os títulos foram fornecidos pelo feed nesta solicitação. Avise que é um panorama de manchetes e que os links levam às matérias completas.",
      [{ role: "user", content: "Categoria: " + safeTopic + "\nManchetes do feed consultado agora:\n" + headlines }],
      900
    );
    summaryText = summary.reply;
  } catch (error) {
    summaryText = "Aqui estão as manchetes recentes encontradas. A síntese automática não ficou disponível nesta tentativa; abra os links para ler as matérias.";
  }

  return {
    reply: "**Manchetes consultadas às " + updatedAt + " (horário de Alagoas)**\n\n" +
      summaryText + "\n\n*Panorama baseado nos títulos do feed; consulte as fontes para os detalhes.*",
    sources: articles.map(item => {
      let publication = "";
      const parsedDate = item.publishedAt ? new Date(item.publishedAt) : null;
      if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
        publication = " · " + new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Maceio", dateStyle: "short", timeStyle: "short",
        }).format(parsedDate);
      }
      return {
        title: (item.source ? item.source + " — " : "") + item.title + publication,
        url: item.url,
      };
    }),
  };
}

const BASE_INSTRUCTIONS =
  "Você é o Nicko Assistant, o assistente pessoal digital do usuário. Converse sempre em português do Brasil, salvo quando o usuário pedir outro idioma.\n" +
  "PERSONALIDADE: seja próximo, gentil, natural, paciente e confiável. Use linguagem simples e informal na medida certa, sem gírias forçadas. Use poucos emojis, apenas quando combinarem. Não chame o usuário pelo nome em toda resposta.\n" +
  "ESTILO: responda primeiro ao que foi perguntado. Prefira respostas curtas, claras e humanas; aprofunde quando o assunto exigir. Use Markdown padrão: títulos com # ou ##, termos importantes entre **dois asteriscos** para negrito, listas com - e passos com 1. 2. 3. Quando o usuário pedir uma resposta formatada, cumpra explicitamente os formatos solicitados. Não use linhas de sinais de igual ou hífens para sublinhar títulos. Não escreva asteriscos literais fora da marcação Markdown. Evite excesso de títulos e listas.\n" +
  "AJUDA: organize ideias, listas de tarefas, rotinas, estudos, textos, mensagens, planejamento e dúvidas de tecnologia. Ao ensinar algo técnico, use palavras simples, explique termos necessários e não presuma conhecimento avançado.\n" +
  "CONTEXTO: quando relevante, considere que o usuário vive em São Miguel dos Campos, Alagoas. A rotina de trabalho informada é de segunda a sexta, 07h às 12h e 13h às 17h, e sábado, 07h às 12h. O usuário prefere explicações simples, diretas e humanizadas. Use esses dados somente quando forem úteis; não os repita sem necessidade.\n" +
  "INFORMAÇÕES ATUAIS: quando a solicitação for sobre notícias ou manchetes recentes, o sistema pode fornecer um feed atualizado do Google Notícias. Use somente as manchetes e os links recebidos do feed; não invente acontecimentos, datas, números ou fontes. Para outros assuntos que exijam dados ao vivo, explique com transparência quando não houver uma fonte conectada.\n" +
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

        if (isCurrentNewsRequest(message)) {
          return json(await createNewsBrief(env, detectNewsTopic(message)));
        }

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
        const topic = String(body.topic || "geral").toLowerCase();
        return json(await createNewsBrief(env, topic));
      }

      return json({ error: "Rota não encontrada." }, 404);
    } catch (error) {
      return json({
        error: error instanceof Error ? error.message : "Falha inesperada no serviço.",
      }, 502);
    }
  },
};
