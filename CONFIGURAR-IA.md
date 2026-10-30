# Conectar o assistente e os resumos de notícias

O site GitHub Pages é estático. Para ter conversa com IA e boletins de notícias pesquisados na hora, ele precisa de um pequeno serviço seguro no servidor. Este projeto usa Cloudflare Workers como ponte para a API da OpenAI.

## Antes de começar

- Uma conta Cloudflare (o painel oferece opções gratuitas e pagas; confira os limites e condições atuais).
- Uma conta na OpenAI Platform com acesso à API.
- Atenção: a cobrança da API é separada da assinatura ChatGPT. Verifique os preços e configure limites de gasto antes de usar.

## 1. Criar o Worker

1. Entre em https://dash.cloudflare.com/ e abra **Workers & Pages**.
2. Escolha **Create** / **Create application** e depois **Create Worker**.
3. Dê o nome `nicko-assistant-api` e crie o Worker.
4. Abra **Edit code** e substitua o código de exemplo pelo conteúdo completo de `cloudflare-worker.js` deste repositório.
5. Salve e faça o Deploy. O Cloudflare mostrará um endereço parecido com `https://nicko-assistant-api.seu-subdominio.workers.dev`.

## 2. Guardar os segredos no servidor

No Worker, entre em **Settings → Variables and Secrets**. Adicione como **Secrets** (não como texto no código):

- `OPENAI_API_KEY`: crie uma chave em https://platform.openai.com/api-keys.
- `NICKO_ACCESS_CODE`: crie uma senha longa e exclusiva, com pelo menos 24 caracteres. Guarde-a em um gerenciador de senhas.

Opcionalmente, adicione uma variável `OPENAI_MODEL` com um modelo habilitado no seu projeto da API. O padrão no código é `gpt-6-astra`.

Faça novo Deploy depois de salvar os segredos.

## 3. Conectar o aplicativo

1. Abra https://nickebel.github.io/nicko-assistant/ no navegador do celular.
2. Entre na aba **Assistente**.
3. Abra **Configurar conexão inteligente**.
4. Cole o endereço `workers.dev` do Worker no primeiro campo.
5. Digite o mesmo `NICKO_ACCESS_CODE` no segundo campo.
6. Toque em **Salvar e testar conexão**.

O teste deve mostrar **Assistente conectado**. A partir daí, a conversa e os resumos de notícias serão gerados dentro do próprio aplicativo.

## Segurança e privacidade

- Nunca coloque sua chave `OPENAI_API_KEY` no HTML, no JavaScript público, no GitHub ou no campo de código de acesso do aplicativo.
- O Worker restringe chamadas ao domínio GitHub Pages deste projeto e exige o código pessoal.
- O código de acesso é mantido apenas na sessão atual do navegador; talvez seja necessário digitá-lo novamente quando abrir uma nova sessão.
- Mensagens enviadas ao assistente e pedidos de resumo são processados pela API da OpenAI. Não envie senhas, dados bancários ou informações sensíveis.
- O Worker não salva histórico de conversa. A conversa mostrada na tela permanece apenas na memória da página.
- Revise os gastos e configure limites na OpenAI Platform. ChatGPT e API têm faturamentos separados.

## O que fica ativo

- `GET /health`: verifica se o Worker está ativo e se o código de acesso confere.
- `POST /api/chat`: conversa com o assistente, com pesquisa na web para perguntas atuais.
- `POST /api/news`: produz um boletim atualizado por tema (geral, Brasil, mundo, Alagoas ou tecnologia), com links de fontes.

O aplicativo não faz monitoramento contínuo nem garante envio automático de boletins às 05h. Para isso, será necessário configurar uma automação agendada separadamente.