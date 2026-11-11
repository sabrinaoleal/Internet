@echo off
cd /d "%~dp0"
echo Abrindo o programa de pagamento de internet...
echo Quando aparecer o endereco, abra http://127.0.0.1:4173 no navegador.
node server.mjs
pause
