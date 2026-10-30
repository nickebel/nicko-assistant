# Nicko Assistant

Aplicativo web instalável (PWA) em português, pensado para celular e tablet.

## Recursos
- Painel diário, clima e rotina de trabalho informada.
- Lista de tarefas salva no navegador.
- Assistente de conversa com Cloudflare Workers AI.
- Respostas formatadas com negrito, itálico, títulos e listas.
- Leitura das respostas em voz alta e entrada por voz, quando o navegador oferece suporte.
- Área de notícias com manchetes do Google Notícias por tema e síntese em português usando Workers AI; pedidos de notícias atuais no próprio chat também consultam o feed.

## Configurar a inteligência artificial
O projeto usa Cloudflare Workers AI por meio de um Worker. Não é necessária uma chave da API da OpenAI. Configure o binding Workers AI com o nome `AI` e o secret `NICKO_ACCESS_CODE`.

Consulte [CONFIGURAR-IA.md](./CONFIGURAR-IA.md) para o passo a passo.

## Limitações
- O uso de Workers AI está sujeito às cotas e aos limites da conta Cloudflare.
- A área de notícias consulta um feed RSS do Google Notícias sob demanda; a síntese é baseada nas manchetes e os links permitem conferir as matérias completas.
- A agenda é um resumo dos horários informados; não sincroniza diretamente com o Google Agenda.
- As tarefas ficam salvas somente neste navegador/aparelho.
- O histórico do chat existe apenas enquanto a página está aberta; não há memória permanente.
- O aplicativo não faz monitoramento contínuo nem executa tarefas em segundo plano.

## Privacidade
O secret `NICKO_ACCESS_CODE` deve existir somente no Cloudflare Worker. Não coloque o código de acesso no HTML/JavaScript público nem envie senhas ou dados sensíveis pela conversa.
