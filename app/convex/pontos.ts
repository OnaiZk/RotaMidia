import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Lista todos os pontos de uma ordem de serviço ordenados pela sequência de rota,
 * incluindo a lista de atividades vinculadas a cada ponto.
 */
export const listByOrdem = query({
  args: {
    ordemServicoId: v.id("ordensServico"),
  },
  handler: async (ctx, args) => {
    const pontos = await ctx.db
      .query("pontos")
      .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", args.ordemServicoId))
      .collect();

    pontos.sort((a, b) => a.ordem - b.ordem);

    const pontosComAtividades = await Promise.all(
      pontos.map(async (ponto) => {
        const atividades = await ctx.db
          .query("atividades")
          .withIndex("by_pontoId", (q) => q.eq("pontoId", ponto._id))
          .collect();

        const concluidas = atividades.filter((a) => a.concluida).length;

        return {
          ...ponto,
          atividades,
          totalAtividades: atividades.length,
          atividadesConcluidas: concluidas,
          concluido: atividades.length > 0 && concluidas === atividades.length,
        };
      })
    );

    return pontosComAtividades;
  },
});

/**
 * Retorna os detalhes de um ponto específico com suas atividades.
 */
export const getById = query({
  args: {
    id: v.id("pontos"),
  },
  handler: async (ctx, args) => {
    const ponto = await ctx.db.get(args.id);
    if (!ponto) {
      return null;
    }

    const atividades = await ctx.db
      .query("atividades")
      .withIndex("by_pontoId", (q) => q.eq("pontoId", ponto._id))
      .collect();

    const concluidas = atividades.filter((a) => a.concluida).length;

    return {
      ...ponto,
      atividades,
      totalAtividades: atividades.length,
      atividadesConcluidas: concluidas,
      concluido: atividades.length > 0 && concluidas === atividades.length,
    };
  },
});

/**
 * Cria um novo ponto para uma ordem de serviço.
 * Caso a ordem sequencial não seja informada, calcula automaticamente como o próximo item da fila.
 */
export const create = mutation({
  args: {
    ordemServicoId: v.id("ordensServico"),
    numeroPonto: v.string(),
    endereco: v.string(),
    referencia: v.optional(v.string()),
    tipo: v.union(v.literal("totem"), v.literal("abrigo"), v.literal("outro")),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    ordem: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ordemExistente = await ctx.db.get(args.ordemServicoId);
    if (!ordemExistente) {
      throw new Error("Ordem de serviço não encontrada");
    }

    let ordemPosicao = args.ordem;

    if (ordemPosicao === undefined) {
      const pontosExistentes = await ctx.db
        .query("pontos")
        .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", args.ordemServicoId))
        .collect();

      ordemPosicao = pontosExistentes.length + 1;
    }

    const pontoId = await ctx.db.insert("pontos", {
      ordemServicoId: args.ordemServicoId,
      numeroPonto: args.numeroPonto.trim(),
      endereco: args.endereco.trim(),
      referencia: args.referencia ? args.referencia.trim() : undefined,
      tipo: args.tipo,
      latitude: args.latitude,
      longitude: args.longitude,
      ordem: ordemPosicao,
    });

    return pontoId;
  },
});

/**
 * Cria múltiplos pontos em lote para uma ordem de serviço (ideal para importação CSV/Planilha).
 * Permite também cadastrar atividades iniciais em lote para cada ponto.
 */
export const createBatch = mutation({
  args: {
    ordemServicoId: v.id("ordensServico"),
    pontos: v.array(
      v.object({
        numeroPonto: v.string(),
        endereco: v.string(),
        referencia: v.optional(v.string()),
        tipo: v.union(v.literal("totem"), v.literal("abrigo"), v.literal("outro")),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        ordem: v.optional(v.number()),
        atividades: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const ordemExistente = await ctx.db.get(args.ordemServicoId);
    if (!ordemExistente) {
      throw new Error("Ordem de serviço não encontrada");
    }

    const pontosExistentes = await ctx.db
      .query("pontos")
      .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", args.ordemServicoId))
      .collect();

    let proximaOrdem = pontosExistentes.length + 1;
    const idsCriados: string[] = [];

    for (const item of args.pontos) {
      const ordemPosicao = item.ordem ?? proximaOrdem++;

      const pontoId = await ctx.db.insert("pontos", {
        ordemServicoId: args.ordemServicoId,
        numeroPonto: item.numeroPonto.trim(),
        endereco: item.endereco.trim(),
        referencia: item.referencia ? item.referencia.trim() : undefined,
        tipo: item.tipo,
        latitude: item.latitude,
        longitude: item.longitude,
        ordem: ordemPosicao,
      });

      idsCriados.push(pontoId);

      // Inserir atividades iniciais para o ponto, se fornecidas
      if (item.atividades && item.atividades.length > 0) {
        for (const desc of item.atividades) {
          if (desc && desc.trim()) {
            await ctx.db.insert("atividades", {
              pontoId,
              descricao: desc.trim(),
              concluida: false,
            });
          }
        }
      }
    }

    return { success: true, count: idsCriados.length, pontoIds: idsCriados };
  },
});

/**
 * Atualiza os dados de um ponto.
 */
export const update = mutation({
  args: {
    id: v.id("pontos"),
    numeroPonto: v.optional(v.string()),
    endereco: v.optional(v.string()),
    referencia: v.optional(v.string()),
    tipo: v.optional(v.union(v.literal("totem"), v.literal("abrigo"), v.literal("outro"))),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    ordem: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ponto = await ctx.db.get(args.id);
    if (!ponto) {
      throw new Error("Ponto não encontrado");
    }

    const updates: {
      numeroPonto?: string;
      endereco?: string;
      referencia?: string;
      tipo?: "totem" | "abrigo" | "outro";
      latitude?: number;
      longitude?: number;
      ordem?: number;
    } = {};

    if (args.numeroPonto !== undefined) updates.numeroPonto = args.numeroPonto.trim();
    if (args.endereco !== undefined) updates.endereco = args.endereco.trim();
    if (args.referencia !== undefined) updates.referencia = args.referencia.trim();
    if (args.tipo !== undefined) updates.tipo = args.tipo;
    if (args.latitude !== undefined) updates.latitude = args.latitude;
    if (args.longitude !== undefined) updates.longitude = args.longitude;
    if (args.ordem !== undefined) updates.ordem = args.ordem;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Remove um ponto e todas as suas atividades vinculadas.
 */
export const remove = mutation({
  args: {
    id: v.id("pontos"),
  },
  handler: async (ctx, args) => {
    const ponto = await ctx.db.get(args.id);
    if (!ponto) {
      throw new Error("Ponto não encontrado");
    }

    // 1. Remover todas as atividades deste ponto
    const atividades = await ctx.db
      .query("atividades")
      .withIndex("by_pontoId", (q) => q.eq("pontoId", args.id))
      .collect();

    for (const atividade of atividades) {
      await ctx.db.delete(atividade._id);
    }

    // 2. Remover o ponto
    await ctx.db.delete(args.id);

    return { success: true };
  },
});
