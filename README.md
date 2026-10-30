# Nicko Assistant

Aplicativo web instalável (PWA) em português, pensado para o celular.

## Recursos do painel
- Visão diária, clima e agenda de trabalho informada pelo usuário.
- Lista de tarefas salva no navegador.
- Interface de conversa dentro do próprio aplicativo.
- Boletim de notícias por tema: geral, Brasil, mundo, Alagoas e tecnologia.
- Pesquisa na web com links de fontes e leitura das respostas em voz alta, quando o navegador oferece suporte.

## Ativar o assistente e o boletim de notícias
O site é estático e não pode guardar credenciais secretas. Para ativar a IA, publique `cloudflare-worker.js` como Cloudflare Worker e configure os segredos `OPENAI_API_KEY` e `NICKO_ACCESS_CODE`. Depois, informe o endereço do Worker e o código de acesso na aba Assistente do aplicativo.

Consulte [CONFIGURAR-IA.md](./CONFIGURAR-IA.md) para o passo a passo completo.

## Limitações
- A API da OpenAI tem faturamento separado da assinatura ChatGPT.
- Agenda exibida é um resumo dos horários informados; ainda não sincroniza diretamente com o Google Agenda.
- Tarefas ficam neste navegador/aparelho.
- Notícias e conversa inteligente só funcionam depois de configurar o serviço Worker.
- O aplicativo não executa monitoramento contínuo nem boletins garantidos em segundo plano às 05h.

## Privacidade
A chave da OpenAI deve existir somente como Secret no Worker, nunca no HTML/JavaScript público. Não envie senhas ou dados sensíveis pela conversa.
