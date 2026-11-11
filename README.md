# Pagamento de internet

Aplicativo para acompanhar o pagamento mensal de internet entre 19 congregações.

- Uma congregação responsável por mês, em rodízio contínuo.
- Lista por ano, com pagamento pendente ou confirmado.
- Comprovante de pagamento por mês.
- Resumo do ano atual para compartilhar no WhatsApp.

## Como abrir

### Pela internet

Abra [Pagamento de internet](https://internet-congregacoes-sabrinaoleal.saltyquince4.chatgpt.site) no celular ou no computador. O acesso à consulta é público: qualquer pessoa com o link pode abrir o aplicativo, sem login. O computador original pode ficar desligado.

Os nomes já são consultados na planilha. Para registrar pagamentos e comprovantes, ainda é necessário autorizar a conexão Google descrita abaixo e configurar os valores privados na hospedagem.

### Neste computador

É necessário ter o Node.js 22 ou mais recente no computador.

No Windows, abra **iniciar.cmd**. Depois, acesse **http://127.0.0.1:4173/** no navegador.

Também é possível iniciar pelo terminal:

```sh
npm start
```

O projeto usa apenas os recursos do Node.js, sem pacotes adicionais.

## Planilha e comprovantes

O cadastro das congregações é consultado no Google Sheets. O rodízio começa com Jardim imperial em outubro de 2026.

Para consultar e salvar pagamentos e enviar comprovantes ao Google Drive, é necessário autorizar a integração. Siga [Conexão com o Google](CONEXAO-GOOGLE.md).

As configurações privadas ficam no arquivo `.env`, que não deve ser enviado ao GitHub. Use `.env.example` como modelo, sem preencher dados privados nele.

## Conferir o funcionamento

```sh
npm test
```

## Sobre o GitHub

O repositório guarda os arquivos do projeto. Para usar o aplicativo, é preciso executar o servidor Node.js. O aplicativo completo não funciona somente no GitHub Pages.
