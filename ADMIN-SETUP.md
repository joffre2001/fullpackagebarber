# Ativar atendimentos sem agendamento — versão 3

1. Abra o projeto Google Apps Script da implantação usada pelo site.
2. Substitua o código pelo conteúdo atualizado de google-apps-script.gs.
3. Preserve a propriedade ADMIN_KEY e o ID da planilha.
4. Salve. Em Implantar > Gerenciar implantações, edite a implantação existente, selecione Nova versão e clique em Implantar. Mantenha a mesma URL /exec.
5. Atualize admin.html com Ctrl+F5 e clique em Atualizar. O painel deve mostrar Servidor: versão 3.

O botão “Registrar atendimento” abre o formulário. Nome e telefone são opcionais; serviço, valor recebido e data são obrigatórios. O nome padrão é Cliente avulso. A data começa em hoje, no fuso de São Paulo.

A planilha ganha a coluna source sem reordenar as colunas existentes. Registros antigos continuam sendo tratados como reservas. Novas reservas públicas recebem source=reservation; registros feitos pelo admin recebem source=walk_in.

- Receita total e serviços realizados incluem reservas concluídas e atendimentos avulsos.
- Conversão usa apenas reservas: reservas concluídas / total de reservas.
- Os cartões detalham quantidade e receita com e sem agendamento.
- O período usa a data do serviço, não a data em que o pagamento foi registrado.
- Editar valor corrige um pagamento.
- Anular retira o atendimento avulso dos totais de serviços e receita; o registro continua no histórico.
- Restaurar atendimento permite informar novamente o pagamento de um atendimento anulado.
- Limpar histórico da lista arquiva registros encerrados e preserva indicadores.
- Registros arquivados continuam somente para consulta, conforme a regra anterior.

O frontend mantém o formulário, mas desativa seu envio quando o servidor ainda está na versão 2. As outras ações existentes continuam disponíveis.

Os testes utilizaram dados simulados. Nenhum atendimento real foi criado, alterado ou anulado.
