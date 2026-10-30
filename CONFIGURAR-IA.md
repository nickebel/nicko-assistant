# Configurar o Nicko com Cloudflare Workers AI

O Nicko Assistant usa o Cloudflare Workers AI para conversar sem depender de créditos da API da OpenAI. O uso continua sujeito às cotas e aos limites da conta Cloudflare.

## 1. Configurar o Worker

1. Entre em https://dash.cloudflare.com/ e abra **Workers & Pages**.
2. Selecione o Worker `nicko-assistant-api`.
3. Abra **Edit code** e substitua o código pelo conteúdo completo de `cloudflare-worker.js` deste repositório.
4. Clique em **Deploy**.

## 2. Conferir o vínculo de IA

No Worker, abra **Settings → Bindings** e confira se existe um vínculo **Workers AI** com o nome exato:

- Variable name: `AI`

O código usa o modelo `@cf/meta/llama-3.2-3b-instruct`.

## 3. Configurar o código de acesso

Em **Settings → Variables and Secrets**, mantenha o secret:

- `NICKO_ACCESS_CODE`: o mesmo código pessoal usado no aplicativo.

A versão atual não precisa de `OPENAI_API_KEY` nem de `OPENAI_MODEL`. Se esses secrets antigos ainda estiverem cadastrados, o código simplesmente não os utiliza; não é necessário apagá-los para o Nicko funcionar.

## 4. Conectar o aplicativo

1. Abra https://nickebel.github.io/nicko-assistant/.
2. Entre na aba **Assistente** e abra **Configurar conexão inteligente**.
3. Informe o endereço `workers.dev` do Worker.
4. Digite o mesmo `NICKO_ACCESS_CODE`.
5. Toque em **Salvar e testar conexão**.

## Recursos e limitações desta versão

- `GET /health`: verifica o código de acesso e informa se o binding de IA existe.
- `POST /api/chat`: conversa com o modelo Workers AI; quando a mensagem pede notícias ou manchetes atuais, consulta o feed RSS antes de gerar a resposta e retorna os links das fontes.
- `POST /api/news`: consulta manchetes do Google Notícias por tema (geral, Brasil, mundo, Alagoas ou tecnologia), organiza uma síntese com Workers AI e devolve links das fontes.
- O boletim de notícias usa manchetes de um feed RSS; a síntese é baseada nos títulos disponíveis, não na leitura integral de cada matéria. Os links das fontes são apresentados para conferência.
- A pesquisa de manchetes ocorre ao solicitar notícias no chat ou ao tocar em “Gerar resumo atualizado”; não há atualização automática em segundo plano.
- As horas de saudação, data e agenda exibidas no app usam explicitamente o fuso `America/Maceio`.
- O histórico da conversa fica na memória da página e não é salvo como memória permanente.
- A lista de tarefas fica no navegador/aparelho; o Worker não acessa essa lista.
- O serviço não monitora o celular, não executa ações em segundo plano e não sincroniza o Google Agenda.

## Segurança

- Nunca publique o código de acesso pessoal no HTML ou em repositórios públicos.
- Mantenha `NICKO_ACCESS_CODE` como Secret no Cloudflare.
- O Worker aceita solicitações do domínio GitHub Pages deste projeto e exige o código de acesso.
- Não envie senhas, dados bancários ou outras informações sensíveis ao chat.
- Consulte no painel Cloudflare os limites e o consumo de Workers AI da sua conta.
