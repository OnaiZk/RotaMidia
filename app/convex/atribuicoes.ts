import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Gera um token seguro e aleatório para links mágicos de técnicos.
 */
function gerarToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "") + Math.random().toString(36).substring(2, 8);
  }
  return (
    Math.random().toString(36).substring(2) +
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 6)
  );
}

/**
 * Lista todas as atribuições vinculadas a uma ordem de serviço,
 * incluindo os detalhes do técnico.
 */
export const listByOrdem = query({
  args: {
    ordemServicoId: v.id("ordensServico"),
  },
  handler: async (ctx, args) => {
    const atribuicoes = await ctx.db
      .query("atribuicoes")
      .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", args.ordemServicoId))
      .collect();

    const resultado = await Promise.all(
      atribuicoes.map(async (atrib) => {
        const tecnico = await ctx.db.get(atrib.tecnicoId);
        return {
          ...atrib,
          tecnico,
        };
      })
    );

    return resultado;
  },
});

/**
 * Consulta de acesso do técnico por Token único.
 * Retorna os detalhes completos da OS, técnico, pontos e suas atividades.
 */
export const getByToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const atribuicao = await ctx.db
      .query("atribuicoes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!atribuicao) {
      return null;
    }

    const [tecnico, ordemServico] = await Promise.all([
      ctx.db.get(atribuicao.tecnicoId),
      ctx.db.get(atribuicao.ordemServicoId),
    ]);

    if (!tecnico || !ordemServico) {
      return null;
    }

    // Buscar todos os pontos da ordem ordenados
    const pontos = await ctx.db
      .query("pontos")
      .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", ordemServico._id))
      .collect();

    pontos.sort((a, b) => a.ordem - b.ordem);

    let totalAtividades = 0;
    let atividadesConcluidas = 0;

    const pontosComAtividades = await Promise.all(
      pontos.map(async (ponto) => {
        const atividades = await ctx.db
          .query("atividades")
          .withIndex("by_pontoId", (q) => q.eq("pontoId", ponto._id))
          .collect();

        const concluidas = atividades.filter((a) => a.concluida).length;
        totalAtividades += atividades.length;
        atividadesConcluidas += concluidas;

        return {
          ...ponto,
          atividades,
          totalAtividades: atividades.length,
          atividadesConcluidas: concluidas,
          concluido: atividades.length > 0 && concluidas === atividades.length,
        };
      })
    );

    const progresso =
      totalAtividades > 0
        ? Math.round((atividadesConcluidas / totalAtividades) * 100)
        : 0;

    return {
      atribuicao,
      tecnico,
      ordemServico,
      pontos: pontosComAtividades,
      stats: {
        totalPontos: pontos.length,
        totalAtividades,
        atividadesConcluidas,
        progresso,
      },
    };
  },
});

/**
 * Cria uma atribuição de ordem de serviço para um técnico com token gerado automaticamente.
 */
export const create = mutation({
  args: {
    ordemServicoId: v.id("ordensServico"),
    tecnicoId: v.id("tecnicos"),
  },
  handler: async (ctx, args) => {
    const [ordem, tecnico] = await Promise.all([
      ctx.db.get(args.ordemServicoId),
      ctx.db.get(args.tecnicoId),
    ]);

    if (!ordem) {
      throw new Error("Ordem de serviço não encontrada");
    }
    if (!tecnico) {
      throw new Error("Técnico não encontrado");
    }

    // Verificar se o técnico já está atribuído a esta OS
    const existente = await ctx.db
      .query("atribuicoes")
      .withIndex("by_ordem_e_tecnico", (q) =>
        q.eq("ordemServicoId", args.ordemServicoId).eq("tecnicoId", args.tecnicoId)
      )
      .first();

    if (existente) {
      return {
        atribuicaoId: existente._id,
        token: existente.token,
        jaExistia: true,
      };
    }

    const token = gerarToken();

    const atribuicaoId = await ctx.db.insert("atribuicoes", {
      ordemServicoId: args.ordemServicoId,
      tecnicoId: args.tecnicoId,
      token,
    });

    return {
      atribuicaoId,
      token,
      jaExistia: false,
    };
  },
});

/**
 * Marca a atribuição como visualizada quando o técnico acessa o link pela primeira vez.
 */
export const marcarVisualizado = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const atribuicao = await ctx.db
      .query("atribuicoes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!atribuicao) {
      throw new Error("Atribuição não encontrada para o token informado");
    }

    if (!atribuicao.visualizadoEm) {
      const agora = new Date().toISOString();
      await ctx.db.patch(atribuicao._id, {
        visualizadoEm: agora,
      });
      return { success: true, visualizadoEm: agora };
    }

    return { success: true, visualizadoEm: atribuicao.visualizadoEm };
  },
});

/**
 * Remove uma atribuição de técnico.
 */
export const remove = mutation({
  args: {
    id: v.id("atribuicoes"),
  },
  handler: async (ctx, args) => {
    const atribuicao = await ctx.db.get(args.id);
    if (!atribuicao) {
      throw new Error("Atribuição não encontrada");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * Internal query para carregar os dados necessários para o envio de e-mail ao técnico.
 */
export const getDadosEnvioEmail = internalQuery({
  args: {
    atribuicaoId: v.id("atribuicoes"),
  },
  handler: async (ctx, args) => {
    const atribuicao = await ctx.db.get(args.atribuicaoId);
    if (!atribuicao) {
      return null;
    }

    const tecnico = await ctx.db.get(atribuicao.tecnicoId);
    const ordem = await ctx.db.get(atribuicao.ordemServicoId);

    if (!tecnico || !ordem) {
      return null;
    }

    const pontos = await ctx.db
      .query("pontos")
      .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", ordem._id))
      .collect();

    return {
      atribuicao,
      tecnico,
      ordem,
      totalPontos: pontos.length,
    };
  },
});

/**
 * Internal mutation para registrar a data e hora do envio de e-mail ao técnico.
 */
export const registrarEnvioEmail = internalMutation({
  args: {
    atribuicaoId: v.id("atribuicoes"),
  },
  handler: async (ctx, args) => {
    const agora = new Date().toISOString();
    await ctx.db.patch(args.atribuicaoId, {
      enviadoEm: agora,
    });
    return { success: true, enviadoEm: agora };
  },
});
