# Nicko Assistant

Aplicativo web instalável (PWA), em português, pensado para uso no celular.

## O que funciona nesta versão
- Painel com data e saudação.
- Previsão atual do tempo e máximas/mínimas via Open-Meteo, para São Miguel dos Campos (AL).
- Resumo local dos horários de trabalho informados: segunda a sexta, 07h–12h e 13h–17h; sábado, 07h–12h.
- Lista de tarefas salva no armazenamento local do navegador.
- Botão para copiar um resumo do dia e colar no ChatGPT.
- Atalhos para Google Agenda, ChatGPT e notícias.
- Cache básico para abrir a interface offline depois da primeira visita.

## Limitações conhecidas
- O painel de trabalho não lê eventos da conta Google; ele apenas apresenta os horários informados e oferece um atalho ao Google Agenda.
- Notícias abrem páginas externas; não existe resumo automático de manchetes nesta versão.
- O ChatGPT abre em outra aba ou no aplicativo; não há API de IA integrada.
- O aplicativo não executa tarefas em segundo plano às 05h nem garante notificações agendadas.
- Tarefas ficam salvas apenas no navegador/aparelho atual.

## Publicação
O site pode ser hospedado gratuitamente no GitHub Pages. Depois de publicado em HTTPS, abra no Chrome ou Samsung Internet e escolha no menu do navegador **Adicionar à tela inicial** ou **Instalar aplicativo**.

## Privacidade
As tarefas ficam no localStorage do navegador. A previsão consulta a API pública Open-Meteo. Os links de agenda, notícias e ChatGPT abrem serviços externos. Não insira senhas ou informações sensíveis neste projeto.
