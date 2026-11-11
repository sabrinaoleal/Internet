# Conexão com a planilha

Os nomes são lidos diretamente da sua planilha. O rodízio começa com Jardim imperial (ID 9), em outubro de 2026, e segue os IDs, voltando ao primeiro após o 19.

Para abrir: execute `iniciar.cmd` e acesse http://127.0.0.1:4173. Não é necessário instalar pacotes.

## Ativar pagamentos e comprovantes

Esta etapa precisa ser feita na conta Google que pode editar a planilha:

1. Na planilha, abra **Extensões > Apps Script**.
2. Copie o conteúdo de `google-apps-script.gs` para o editor e salve.
3. Selecione **prepararConexao** e clique em **Executar**. Leia e autorize o acesso solicitado pelo Google.
4. Clique em **Implantar > Nova implantação > Aplicativo da Web**. Execute como sua conta. O acesso ao endereço deve permitir chamadas externas; o código exige um token privado em todas elas. Não compartilhe esse token.
5. Copie a URL terminada em `/exec`.
6. Em **Configurações do projeto > Propriedades do script**, copie o valor de **APP_TOKEN**.
7. Copie `.env.example` para `.env`. Preencha `GOOGLE_APPS_SCRIPT_URL` com a URL e `GOOGLE_APPS_SCRIPT_TOKEN` com o token. Esses valores ficam somente no servidor, sem aparecer no HTML. Não envie o token pelo chat.
8. Feche o programa, abra `iniciar.cmd` novamente e clique em **Atualizar**.

O preparo cria somente a aba **Pagamentos Internet** e não altera o cadastro original. Os comprovantes são guardados em uma pasta privada do Google Drive, criada no primeiro envio. Quem abrir um comprovante precisa ter acesso a esse arquivo na conta Google.

Sem essa autorização, o programa carrega as congregações, mostra os responsáveis e mantém os pagamentos como **Pendente**, aguardando confirmação. Não registra pagamentos fictícios nem reaproveita os testes da prévia.

Referência: [aplicativos da Web do Google Apps Script](https://developers.google.com/apps-script/guides/web).
