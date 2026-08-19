import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Lista todas as atividades de um determinado ponto de parada.
 */
export const listByPonto = query({
  args: {
    pontoId: v.id("pontos"),
  },
  handler: async (ctx, args) => {
    const atividades = await ctx.db
      .query("atividades")
      .withIndex("by_pontoId", (q) => q.eq("pontoId", args.pontoId))
      .collect();

    return atividades;
  },
});

/**
 * Cria uma nova atividade para um ponto de parada.
 */
export const create = mutation({
  args: {
    pontoId: v.id("pontos"),
    descricao: v.string(),
    observacao: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ponto = await ctx.db.get(args.pontoId);
    if (!ponto) {
      throw new Error("Ponto de parada não encontrado");
    }

    const atividadeId = await ctx.db.insert("atividades", {
      pontoId: args.pontoId,
      descricao: args.descricao.trim(),
      concluida: false,
      observacao: args.observacao ? args.observacao.trim() : undefined,
    });

    return atividadeId;
  },
});

/**
 * Cria múltiplas atividades em lote para um ponto.
 */
export const createBatch = mutation({
  args: {
    pontoId: v.id("pontos"),
    atividades: v.array(
      v.object({
        descricao: v.string(),
        observacao: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ponto = await ctx.db.get(args.pontoId);
    if (!ponto) {
      throw new Error("Ponto de parada não encontrado");
    }

    const idsCriados: string[] = [];

    for (const item of args.atividades) {
      if (item.descricao && item.descricao.trim()) {
        const id = await ctx.db.insert("atividades", {
          pontoId: args.pontoId,
          descricao: item.descricao.trim(),
          concluida: false,
          observacao: item.observacao ? item.observacao.trim() : undefined,
        });
        idsCriados.push(id);
      }
    }

    return { success: true, count: idsCriados.length, ids: idsCriados };
  },
});

/**
 * Alterna (toggle) o status de conclusão de uma atividade.
 * Se desmarcada -> marca como concluída com timestamp ISO e ID do técnico.
 * Se já concluída -> desmarca e limpa data e técnico.
 */
export const toggleConcluida = mutation({
  args: {
    id: v.id("atividades"),
    tecnicoId: v.optional(v.id("tecnicos")),
  },
  handler: async (ctx, args) => {
    const atividade = await ctx.db.get(args.id);
    if (!atividade) {
      throw new Error("Atividade não encontrada");
    }

    const novaConclusao = !atividade.concluida;

    if (novaConclusao) {
      await ctx.db.patch(args.id, {
        concluida: true,
        concluidaEm: new Date().toISOString(),
        concluidaPorId: args.tecnicoId,
      });
    } else {
      await ctx.db.patch(args.id, {
        concluida: false,
        concluidaEm: undefined,
        concluidaPorId: undefined,
      });
    }

    return { id: args.id, concluida: novaConclusao };
  },
});

/**
 * Atualiza a observação ou notas de campo de uma atividade.
 */
export const updateObservacao = mutation({
  args: {
    id: v.id("atividades"),
    observacao: v.string(),
  },
  handler: async (ctx, args) => {
    const atividade = await ctx.db.get(args.id);
    if (!atividade) {
      throw new Error("Atividade não encontrada");
    }

    await ctx.db.patch(args.id, {
      observacao: args.observacao.trim(),
    });

    return { success: true };
  },
});

/**
 * Marca todas as atividades pendentes de um ponto como concluídas.
 */
export const marcarTodasConcluidas = mutation({
  args: {
    pontoId: v.id("pontos"),
    tecnicoId: v.optional(v.id("tecnicos")),
  },
  handler: async (ctx, args) => {
    const ponto = await ctx.db.get(args.pontoId);
    if (!ponto) {
      throw new Error("Ponto não encontrado");
    }

    const atividades = await ctx.db
      .query("atividades")
      .withIndex("by_pontoId", (q) => q.eq("pontoId", args.pontoId))
      .collect();

    const agora = new Date().toISOString();
    let totalAlteradas = 0;

    for (const ativ of atividades) {
      if (!ativ.concluida) {
        await ctx.db.patch(ativ._id, {
          concluida: true,
          concluidaEm: agora,
          concluidaPorId: args.tecnicoId,
        });
        totalAlteradas++;
      }
    }

    return { success: true, totalAlteradas };
  },
});

/**
 * Remove uma atividade.
 */
export const remove = mutation({
  args: {
    id: v.id("atividades"),
  },
  handler: async (ctx, args) => {
    const atividade = await ctx.db.get(args.id);
    if (!atividade) {
      throw new Error("Atividade não encontrada");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
