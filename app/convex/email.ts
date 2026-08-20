"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import nodemailer from "nodemailer";
import { Doc } from "./_generated/dataModel";

/**
 * Envia um e-mail com design limpo e moderno para o técnico via Brevo (Sendinblue) ou Gmail SMTP,
 * contendo o link direto (token) para execução da ordem de serviço no celular.
 */
export const enviarEmailTecnico = action({
  args: {
    atribuicaoId: v.id("atribuicoes"),
    baseUrl: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; emailId?: string; destinatario: string }> => {
    // Credenciais Brevo (Sendinblue)
    const brevoApiKey = process.env.BREVO_API_KEY;
    const senderEmail =
      process.env.SENDER_EMAIL || "mouracassiano410@gmail.com";

    if (!brevoApiKey) {
      throw new Error(
        "Chave da API Brevo (BREVO_API_KEY) não configurada nas variáveis de ambiente do Convex. Configure com: npx convex env set BREVO_API_KEY sua_chave"
      );
    }

    // 1. Buscar os dados consolidados da atribuição, técnico e ordem de serviço
    const dados: {
      atribuicao: Doc<"atribuicoes">;
      tecnico: Doc<"tecnicos">;
      ordem: Doc<"ordensServico">;
      totalPontos: number;
    } | null = await ctx.runQuery(internal.atribuicoes.getDadosEnvioEmail, {
      atribuicaoId: args.atribuicaoId,
    });

    if (!dados) {
      throw new Error(
        "Dados da atribuição, do técnico ou da ordem de serviço não foram encontrados para envio do e-mail."
      );
    }

    const { atribuicao, tecnico, ordem, totalPontos } = dados;

    const emailDestino = tecnico.email?.trim();
    if (!emailDestino || !emailDestino.includes("@")) {
      throw new Error(
        `E-mail do técnico inválido: '${tecnico.email}'. Verifique o cadastro do técnico.`
      );
    }

    // 2. Montar URL de acesso mobile do técnico
    const cleanBaseUrl = args.baseUrl.replace(/\/+$/, "");
    const linkAcesso = `${cleanBaseUrl}/campo/${atribuicao.token}`;

    // 3. Formatar data limite em formato brasileiro legível
    let prazoFormatado = "Não definido";
    if (ordem.dataLimite) {
      try {
        const dataObj = new Date(ordem.dataLimite);
        prazoFormatado = dataObj.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        prazoFormatado = ordem.dataLimite;
      }
    }

    // 4. Construir template HTML profissional e responsivo para celular e desktop
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ordem de Serviço - Eletromidia Campo</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01); border: 1px solid #e2e8f0;">
          <!-- Top Header com Branding Eletromidia -->
          <tr>
            <td style="background: #0f172a; padding: 28px 32px; text-align: left; border-bottom: 3px solid #ff5000;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      <span style="color: #ff5000;">eletromidia</span> <span style="font-size: 16px; color: #94a3b8; font-weight: 400; margin-left: 6px;">| Campo</span>
                    </div>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px; font-weight: 400;">
                      Sistema de Manutenção e Gestão de Mobiliário Urbano
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Corpo do E-mail -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px; letter-spacing: -0.3px;">
                Olá, ${tecnico.nome}!
              </h1>
              <p style="font-size: 15px; line-height: 24px; color: #334155; margin-top: 0; margin-bottom: 24px;">
                Uma nova <strong>Ordem de Serviço</strong> foi atribuída a você para execução em campo. Clique no botão abaixo para abrir a rota e registrar as atividades diretamente pelo celular:
              </p>

              <!-- Card Detalhes da OS -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #ff5000; margin-bottom: 6px;">
                      Ordem de Serviço
                    </div>
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 16px;">
                      ${ordem.titulo}
                    </div>

                    ${
                      ordem.descricao
                        ? `
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 4px;">
                      Instruções / Descrição
                    </div>
                    <div style="font-size: 14px; color: #475569; margin-bottom: 16px; line-height: 20px;">
                      ${ordem.descricao}
                    </div>`
                        : ""
                    }

                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #e2e8f0; padding-top: 16px;">
                      <tr>
                        <td width="50%" style="vertical-align: top;">
                          <div style="font-size: 12px; color: #64748b; margin-bottom: 2px;">Total de Pontos</div>
                          <div style="font-size: 16px; font-weight: 700; color: #ff5000;">📍 ${totalPontos} ${totalPontos === 1 ? "ponto" : "pontos"}</div>
                        </td>
                        <td width="50%" style="vertical-align: top;">
                          <div style="font-size: 12px; color: #64748b; margin-bottom: 2px;">Prazo Limite</div>
                          <div style="font-size: 15px; font-weight: 700; color: #0f172a;">⏰ ${prazoFormatado}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botão de Ação Principal (CTA Eletromidia) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${linkAcesso}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; text-align: center; background-color: #ff5000; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; padding: 16px 24px; border-radius: 12px; box-shadow: 0 4px 10px rgba(255, 80, 0, 0.3);">
                      🚀 Abrir Ordem de Serviço no Celular
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Box Informativo -->
              <div style="background-color: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 10px; margin-bottom: 24px;">
                <div style="font-size: 13px; font-weight: 700; color: #c2410c; margin-bottom: 4px;">
                  💡 Acesso Direto Sem Senha
                </div>
                <div style="font-size: 13px; color: #9a3412; line-height: 19px;">
                  Este link é exclusivo para você. Não é necessário fazer login. Você pode marcar atividades concluídas e registrar observações diretamente do campo.
                </div>
              </div>

              <!-- Link alternativo por texto -->
              <div style="font-size: 12px; color: #94a3b8; line-height: 18px; word-break: break-all;">
                Caso não consiga clicar no botão, copie e cole o link no seu navegador:<br>
                <a href="${linkAcesso}" style="color: #ff5000; text-decoration: underline;">${linkAcesso}</a>
              </div>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <p style="font-size: 12px; font-weight: 600; color: #64748b; margin: 0;">
                Eletromidia • Sistema de Gestão e Manutenção de Campo
              </p>
              <p style="font-size: 11px; color: #94a3b8; margin: 6px 0 0 0;">
                Este e-mail foi gerado automaticamente pela plataforma Eletromidia Campo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const remetenteNome = process.env.SENDER_NAME || process.env.SMTP_FROM_NAME || "Eletromidia Campo";
    let messageId: string | undefined;

    // 5. Envio via Brevo API Oficial
    const cleanBrevoKey = brevoApiKey.trim();
    const cleanSender = (senderEmail || "mouracassiano410@gmail.com").trim();

    console.log(`[Brevo] Iniciando disparo de e-mail:`);
    console.log(`- De: ${remetenteNome} <${cleanSender}>`);
    console.log(`- Para: ${tecnico.nome} <${emailDestino}>`);
    console.log(`- OS: ${ordem.titulo}`);

    if (cleanBrevoKey.startsWith("xsmtpsib-")) {
      // Se for chave SMTP
      const transporter = nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: {
          user: cleanSender,
          pass: cleanBrevoKey,
        },
      });

      const info = await transporter.sendMail({
        from: `"${remetenteNome}" <${cleanSender}>`,
        to: emailDestino,
        subject: `[Eletromidia] Nova Ordem de Serviço: ${ordem.titulo}`,
        html,
      });

      messageId = info.messageId;
      console.log(`[Brevo SMTP] Enviado com sucesso. MessageID: ${messageId}`);
    } else {
      // Envio direto e ultra-rápido via REST API oficial do Brevo
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": cleanBrevoKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { name: remetenteNome, email: cleanSender },
          to: [{ email: emailDestino, name: tecnico.nome }],
          subject: `[Eletromidia] Nova Ordem de Serviço: ${ordem.titulo}`,
          htmlContent: html,
        }),
      });

      if (!res.ok) {
        const errData: any = await res.json().catch(() => ({}));
        console.error(`[Brevo API Erro] Status ${res.status}:`, errData);
        throw new Error(
          `Erro ao enviar e-mail via Brevo API (${res.status}): ${errData?.message || res.statusText || 'Falha no envio'}`
        );
      }

      const data: any = await res.json();
      messageId = data?.messageId;
      console.log(`[Brevo API] Enviado com sucesso. MessageID: ${messageId}`);
    }

    // 6. Atualizar a data de envio na atribuição
    await ctx.runMutation(internal.atribuicoes.registrarEnvioEmail, {
      atribuicaoId: args.atribuicaoId,
    });

    return {
      success: true,
      emailId: messageId,
      destinatario: emailDestino,
    };
  },
});
