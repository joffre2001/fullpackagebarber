# Editor de conteúdo do website — ativação da versão 4

O painel possui “Editar website”, com:
- textos da página inicial e horários exibidos;
- serviços, imagens, duração e preços;
- pacotes e preços;
- galeria (envio de JPG/PNG/WebP ou URL HTTPS, até 12 fotos);
- pop-up promocional com início/fim opcionais e botão de agendamento;
- prévia em computador/celular e publicação explícita.

## Ativar uma vez
1. Abra o projeto Google Apps Script usado pela URL /exec em admin.js.
2. Substitua seu código pelo conteúdo completo de google-apps-script.gs deste projeto.
3. Preserve ADMIN_KEY e o ID da planilha.
4. Salve. Em Implantar > Gerenciar implantações > Editar, selecione Nova versão e implante a implantação existente.
5. Atualize o admin. Deve aparecer “Servidor: versão 4”.
6. Abra Editar website. Faça uma alteração, confira a prévia e clique em Publicar alterações.

A URL /exec deve permanecer a mesma. Publicar conteúdo depois dessa ativação não exige GitHub ou Render.

## Armazenamento e comportamento
WebsiteContent é uma aba separada das reservas. O servidor valida o conteúdo e grava uma publicação completa antes de ativá-la. A propriedade SITE_CONTENT_POINTER aponta para a publicação atual. Não altere manualmente essa propriedade ou a aba.

As fotos enviadas são redimensionadas e armazenadas com o conteúdo, sem depender de outro serviço de imagens. Uma publicação comporta até 3 milhões de caracteres; cada imagem tem limite de 220 mil caracteres após otimização. Fotos antigas permanecem nas publicações anteriores; remover da galeria retira a exibição pública, não apaga o histórico interno.

Somente o admin autenticado publica. O endpoint público retorna exclusivamente o conteúdo do site. Nenhuma reserva, chave ou receita faz parte desse retorno.

Uma sessão não pode sobrescrever silenciosamente uma publicação mais recente de outra sessão. Use Descartar e recarregar em caso de conflito.

Os preços publicados não alteram pagamentos nem valores históricos. Os horários editáveis são informativos; não modificam a grade de horários do formulário. O pop-up aparece uma vez por sessão dentro das datas definidas em São Paulo e pode ser desativado publicando novamente.

O site consulta o conteúdo ao abrir/recarregar a página. Se o servidor estiver indisponível ou ainda na versão anterior, mostra o conteúdo padrão incluído na implantação (que pode ter preços anteriores). Após ativar, confira a publicação em uma nova aba.

## Handoff
Depois de ativar a versão 4, o proprietário usa seu mesmo acesso admin. Não é necessário compartilhar sua conta GitHub ou Render para editar o site.
