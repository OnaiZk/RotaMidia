import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Usado por: src/app/campo/[token]/page.tsx
// Retorna: { atribuicao, ordem, tecnico, pontosComAtividades }
export const getAtribuicaoByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const atribuicao = await ctx.db
      .query("atribuicoes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!atribuicao) return null;

    const [tecnico, ordem] = await Promise.all([
      ctx.db.get(atribuicao.tecnicoId),
      ctx.db.get(atribuicao.ordemServicoId),
    ]);
    if (!tecnico || !ordem) return null;

    const pontos = await ctx.db
      .query("pontos")
      .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", ordem._id))
      .collect();
    pontos.sort((a, b) => a.ordem - b.ordem);

    const pontosComAtividades = await Promise.all(
      pontos.map(async (ponto) => {
        const atividades = await ctx.db
          .query("atividades")
          .withIndex("by_pontoId", (q) => q.eq("pontoId", ponto._id))
          .collect();
        return { ...ponto, atividades };
      })
    );

    return {
      atribuicao,
      tecnico,
      ordem,
      pontosComAtividades,
      visualizadoEm: atribuicao.visualizadoEm,
    };
  },
});

// Marca atribuicao como visualizada
export const markAtribuicaoVisualizado = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const atribuicao = await ctx.db
      .query("atribuicoes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!atribuicao) throw new Error("Atribuição não encontrada");
    if (!atribuicao.visualizadoEm) {
      await ctx.db.patch(atribuicao._id, {
        visualizadoEm: new Date().toISOString(),
      });
    }
  },
});

// Usado por: src/app/campo/[token]/ponto/[pontoId]/page.tsx
// Retorna { ponto, atividades } para um ponto específico, validado pelo token
export const getPontoDetailsByToken = query({
  args: { token: v.string(), pontoId: v.string() },
  handler: async (ctx, args) => {
    // Validar token
    const atribuicao = await ctx.db
      .query("atribuicoes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!atribuicao) return null;

    const pontoId = ctx.db.normalizeId("pontos", args.pontoId);
    if (!pontoId) return null;

    const ponto = await ctx.db.get(pontoId);
    if (!ponto) return null;

    // Verificar se o ponto pertence à mesma ordem de serviço
    if (ponto.ordemServicoId !== atribuicao.ordemServicoId) return null;

    const atividades = await ctx.db
      .query("atividades")
      .withIndex("by_pontoId", (q) => q.eq("pontoId", ponto._id))
      .collect();

    return { ponto, atividades };
  },
});

// Alterna status de conclusão da atividade
export const toggleAtividade = mutation({
  args: {
    token: v.string(),
    pontoId: v.string(),
    atividadeId: v.string(),
    concluida: v.boolean(),
  },
  handler: async (ctx, args) => {
    const atribuicao = await ctx.db
      .query("atribuicoes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!atribuicao) throw new Error("Token inválido");

    const atividadeId = ctx.db.normalizeId("atividades", args.atividadeId);
    if (!atividadeId) throw new Error("Atividade não encontrada");

    if (args.concluida) {
      await ctx.db.patch(atividadeId, {
        concluida: true,
        concluidaEm: new Date().toISOString(),
        concluidaPorId: atribuicao.tecnicoId,
      });
    } else {
      await ctx.db.patch(atividadeId, {
        concluida: false,
        concluidaEm: undefined,
        concluidaPorId: undefined,
      });
    }
  },
});

// Atualiza observação de uma atividade
export const updateAtividadeObservacao = mutation({
  args: {
    token: v.string(),
    pontoId: v.string(),
    atividadeId: v.string(),
    observacao: v.string(),
  },
  handler: async (ctx, args) => {
    const atribuicao = await ctx.db
      .query("atribuicoes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!atribuicao) throw new Error("Token inválido");

    const atividadeId = ctx.db.normalizeId("atividades", args.atividadeId);
    if (!atividadeId) throw new Error("Atividade não encontrada");

    await ctx.db.patch(atividadeId, {
      observacao: args.observacao.trim(),
    });
  },
});

// Marca todas as atividades de um ponto como concluídas
export const markAllAtividades = mutation({
  args: {
    token: v.string(),
    pontoId: v.string(),
  },
  handler: async (ctx, args) => {
    const atribuicao = await ctx.db
      .query("atribuicoes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!atribuicao) throw new Error("Token inválido");

    const pontoId = ctx.db.normalizeId("pontos", args.pontoId);
    if (!pontoId) throw new Error("Ponto não encontrado");

    const atividades = await ctx.db
      .query("atividades")
      .withIndex("by_pontoId", (q) => q.eq("pontoId", pontoId))
      .collect();

    const agora = new Date().toISOString();
    for (const ativ of atividades) {
      if (!ativ.concluida) {
        await ctx.db.patch(ativ._id, {
          concluida: true,
          concluidaEm: agora,
          concluidaPorId: atribuicao.tecnicoId,
        });
      }
    }
  },
});

// Desmarca todas as atividades de um ponto como concluídas
export const unmarkAllAtividades = mutation({
  args: {
    token: v.string(),
    pontoId: v.string(),
  },
  handler: async (ctx, args) => {
    const atribuicao = await ctx.db
      .query("atribuicoes")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!atribuicao) throw new Error("Token inválido");

    const pontoId = ctx.db.normalizeId("pontos", args.pontoId);
    if (!pontoId) throw new Error("Ponto não encontrado");

    const atividades = await ctx.db
      .query("atividades")
      .withIndex("by_pontoId", (q) => q.eq("pontoId", pontoId))
      .collect();

    for (const ativ of atividades) {
      if (ativ.concluida) {
        await ctx.db.patch(ativ._id, {
          concluida: false,
          concluidaEm: undefined,
          concluidaPorId: undefined,
        });
      }
    }
  },
});
