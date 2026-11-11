# Orientações do projeto

- Faça apenas o que o usuário pedir. Não invente requisitos nem acrescente funções, telas ou conteúdos por conta própria.
- Se faltar uma informação essencial, faça uma pergunta curta antes de decidir.
- Responda em português, com textos curtos, claros e objetivos. Evite termos técnicos.
- Desenvolva o aplicativo pensando em uma pessoa de aproximadamente 60 anos, com pouca instrução e pouquíssima experiência com tecnologia.
- Use palavras conhecidas, letras fáceis de ler, bom contraste e botões grandes com nomes claros.
- Mantenha as telas simples, com poucas opções e passos fáceis de entender.
- Deixe evidente o que a pessoa deve fazer e confirme de forma simples quando uma ação for concluída.
- Explique os erros com linguagem amigável e diga como resolvê-los.
- Priorize a facilidade de uso. Evite complicações e elementos desnecessários.

## Aplicativo: pagamento de internet

- Usar o Google Sheets como fonte das informações pré-cadastradas das 19 congregações.
- Planilha informada pelo usuário: https://docs.google.com/spreadsheets/d/1q6U4F_z4N3CKOy-8QZE7KcUgHbagLBB-AvV1u0tGF_0/edit?gid=0#gid=0
- Definir exatamente uma congregação responsável pelo pagamento em cada mês.
- O rodízio começou em outubro de 2026.
- A primeira congregação foi Jardim imperial (ID 9), confirmada pelo usuário. Seguir os IDs em ordem crescente, retornando ao ID 1 depois do ID 19.
- Seguir a ordem cadastrada. Depois da 19ª congregação, retornar à primeira e repetir o rodízio, sem reiniciar na virada do ano.
- Mostrar no destaque a congregação responsável e o mês, sem indicador de pagamento nem botão Ver pagamento. Incluir à direita apenas um ícone pequeno do WhatsApp, para compartilhar o resumo anual, conforme solicitado posteriormente.
- Permitir escolher um ano e consultar seus meses, com a congregação responsável por cada pagamento.
- A lista anual deve ter visual moderno e elegante, mantendo letras legíveis, botões claros e bom uso no celular.
- Permitir preparar o resumo do ano atual para WhatsApp, com meses, congregações e estados de pagamento. Mostrar a mensagem antes de abrir o WhatsApp; o usuário escolhe o contato ou grupo e confirma o envio no próprio WhatsApp. Não enviar automaticamente.
- Na mensagem do WhatsApp, usar 🟢 Confirmado e 🔴 Pendente.
- Na lista, mostrar somente os estados de pagamento: ✓ verde para Confirmado e X vermelho para Pendente. Pendente significa que o pagamento ainda não foi confirmado no programa.
- Permitir enviar e consultar o comprovante vinculado ao mês e à congregação responsáveis.
- Nos detalhes, manter o indicador de pagamento e o botão de confirmação com a mesma largura, altura e cantos alinhados. Usar a mesma altura nos botões de comprovante.
- Apenas guardar o comprovante, sem leitura automática ou extração de dados. O usuário marca o pagamento como pago manualmente.
- Não tratar os exemplos Paraíso em novembro de 2026 e Pérola Negra em dezembro de 2026 como cadastros confirmados.

### Congregações lidas da planilha

- Aba de ID 0 consultada em 10/11/2026. Colunas: ID, NOME, COORDENADOR, TELEFONE, EMAIL. As três últimas colunas estavam vazias.
- Ordem dos IDs: 1. Alto tropical; 2. Alto da torre; 3. Areia branca; 4. Bela vista do Ceasa; 5. Bosque das mangueiras; 6. Central de Itinga; 7. Itinga; 8. Jardim centenário; 9. Jardim imperial; 10. Nova esperança; 11. Novo horizonte; 12. Paraíso; 13. Parque São Paulo; 14. Pérola negra; 15. Pitanguinha; 16. Pomar do jambeiro; 17. Pouso alegre; 18. Taubaté; 19. Vila de sena.
- A aba consultada contém o cadastro. Jardim imperial foi confirmada separadamente pelo usuário como primeira responsável, em outubro de 2026.

### Programa local

- O arquivo index.html usa app.js e o servidor server.mjs. A rota /api/state consulta as congregações diretamente no Google Sheets, sem cadastros fictícios ou cópias fixas.
- Os testes antigos do navegador não são importados. Sem autorização de gravação, os pagamentos permanecem Pendentes de confirmação e os botões de alteração ficam bloqueados.
- A integração para gravação usa google-apps-script.gs e exige implantação e autorização na conta Google. Instruções em CONEXAO-GOOGLE.md. Credenciais ficam em .env, fora do HTML.

### Hospedagem online

- Link publicado e confirmado: https://internet-congregacoes-sabrinaoleal.saltyquince4.chatgpt.site. Acesso privado pela mesma conta ChatGPT proprietária.

- O projeto Sites registrado é appgprj_6af3d6c3fe008191826953e3def11d3f. Reutilizar esse identificador; não criar outro Site para este aplicativo.
- O checkout de publicação está em publication/pagamento-internet, com repositório próprio e manifesto .openai/hosting.json. A pasta publication/ fica fora do Git principal.
- Manter o Site privado para a conta proprietária. Não alterar o público sem pedido do usuário.
- Ao atualizar a interface, sincronizar index.html e app.js com source/ nesse checkout; a versão online de app.js usa uma mensagem de conexão adequada ao acesso remoto. Gerar a compilação com node scripts/build.mjs e conferir node --test hosted.test.mjs antes de publicar pelo fluxo Sites.
- As variáveis GOOGLE_APPS_SCRIPT_URL e GOOGLE_APPS_SCRIPT_TOKEN da versão online devem ser configuradas como valores de execução na hospedagem, nunca no código ou no GitHub.

### Informações a confirmar antes da implementação correspondente

- Autorização e implantação do Apps Script para consultar e gravar pagamentos e guardar comprovantes no Google Drive.
