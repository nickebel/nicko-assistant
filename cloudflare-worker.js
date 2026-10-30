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
    .replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, "$1")
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
    .replace(/\\s+/g, " ")
    .trim();
}

function readXmlTag(block, tag) {
  const match = block.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i"));
  return match ? decodeXml(match[1]) : "";
}

function parseNewsRss(xml, limit = 12) {
  const matches = [...String(xml).matchAll(/<item\\b[^>]*>([\\s\\S]*?)<\\/item>/gi)];
  return matches.map(match => {
    const block = match[1];
    const title = readXmlTag(block, "title");
    const url = readXmlTag(block, "link");
    const publishedAt = readXmlTag(block, "pubDate");
    const source = readXmlTag(block, "source");
    return { title, url, publishedAt, source };
  }).filter(item => item.title && /^https:\\/\\//i.test(item.url)).slice(0, limit);
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
        const topic = String(body.topic || "geral").toLowerCase();
        const searches = {
          geral: "",
          brasil: "Brasil when:2d",
          mundo: "mundo internacional when:2d",
          alagoas: "Alagoas OR Maceió when:7d",
          tecnologia: "tecnologia OR inteligência artificial when:2d",
        };
        const query = Object.prototype.hasOwnProperty.call(searches, topic) ? searches[topic] : searches.geral;
        const feedUrl = new URL(query ? "https://news.google.com/rss/search" : "https://news.google.com/rss");
        if (query) feedUrl.searchParams.set("q", query);
        feedUrl.searchParams.set("hl", "pt-BR");
        feedUrl.searchParams.set("gl", "BR");
        feedUrl.searchParams.set("ceid", "BR:pt-419");

        const feedResponse = await fetch(feedUrl.toString(), {
          headers: { "Accept": "application/rss+xml, application/xml, text/xml" },
        });
        if (!feedResponse.ok) throw new Error("Não consegui acessar o feed de notícias agora. Tente novamente.");
        const xml = await feedResponse.text();
        const articles = parseNewsRss(xml, 12);
        if (!articles.length) {
          return json({
            reply: "Não encontrei manchetes para esse tema neste momento. Tente outra categoria ou atualize novamente daqui a pouco.",
            sources: [],
          });
        }

        const headlines = articles.map((item, index) =>
          (index + 1) + ". " + item.title +
          (item.source ? " — Fonte: " + item.source : "") +
          (item.publishedAt ? " — Publicado em: " + item.publishedAt : "")
        ).join("\\n");

        let reply;
        try {
          const summary = await askAI(
            env,
            "Você é o editor de notícias do Nicko. Organize as manchetes fornecidas em português do Brasil, em até 4 tópicos curtos. Explique somente o que é possível concluir pelas manchetes. Não invente detalhes, causas, números, citações ou consequências que não estejam nelas. Deixe claro que o boletim é um panorama das manchetes, não a leitura integral das matérias. Termine recomendando abrir os links das fontes para detalhes.",
            [{ role: "user", content: "Tema selecionado: " + (topic || "geral") + "\\nManchetes coletadas no Google Notícias:\\n" + headlines }],
            850
          );
          reply = summary.reply;
        } catch (error) {
          reply = "Encontrei estas manchetes recentes. A síntese por IA não ficou disponível agora, mas você pode abrir cada fonte abaixo:\\n\\n" +
            articles.map(item => "- " + item.title).join("\\n");
        }

        return json({
          reply,
          sources: articles.map(item => ({
            title: (item.source ? item.source + " — " : "") + item.title,
            url: item.url,
            publishedAt: item.publishedAt,
          })),
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
