import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Lista todas as ordens de serviço com estatísticas consolidadas:
 * - Total de pontos
 * - Total de atividades e atividades concluídas
 * - Percentual de progresso
 * - Técnicos atribuídos
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("rascunho"),
        v.literal("ativa"),
        v.literal("concluida"),
        v.literal("cancelada")
      )
    ),
  },
  handler: async (ctx, args) => {
    let ordens = args.status
      ? await ctx.db
          .query("ordensServico")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .collect()
      : await ctx.db.query("ordensServico").collect();

    // Ordenar pelas mais recentes primeiro
    ordens.sort((a, b) => b.dataCriacao.localeCompare(a.dataCriacao));

    const ordensComEstatisticas = await Promise.all(
      ordens.map(async (ordem) => {
        // Obter todos os pontos da ordem
        const pontos = await ctx.db
          .query("pontos")
          .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", ordem._id))
          .collect();

        // Obter todas as atividades de todos os pontos da ordem
        let totalAtividades = 0;
        let atividadesConcluidas = 0;

        for (const ponto of pontos) {
          const atividades = await ctx.db
            .query("atividades")
            .withIndex("by_pontoId", (q) => q.eq("pontoId", ponto._id))
            .collect();

          totalAtividades += atividades.length;
          atividadesConcluidas += atividades.filter((a) => a.concluida).length;
        }

        // Obter técnicos atribuídos
        const atribuicoes = await ctx.db
          .query("atribuicoes")
          .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", ordem._id))
          .collect();

        const tecnicosAtribuidos = await Promise.all(
          atribuicoes.map(async (atrib) => {
            const tecnico = await ctx.db.get(atrib.tecnicoId);
            return tecnico
              ? {
                  ...tecnico,
                  atribuicaoId: atrib._id,
                  token: atrib.token,
                  enviadoEm: atrib.enviadoEm,
                  visualizadoEm: atrib.visualizadoEm,
                }
              : null;
          })
        );

        const progresso =
          totalAtividades > 0
            ? Math.round((atividadesConcluidas / totalAtividades) * 100)
            : 0;

        return {
          ...ordem,
          totalPontos: pontos.length,
          totalAtividades,
          atividadesConcluidas,
          progresso,
          tecnicos: tecnicosAtribuidos.filter(Boolean),
        };
      })
    );

    return ordensComEstatisticas;
  },
});

/**
 * Retorna uma ordem de serviço completa pelo ID com:
 * - Lista de pontos ordenados por sequência
 * - Lista de atividades vinculadas a cada ponto
 * - Estatísticas consolidadas de conclusão
 * - Técnicos atribuídos e seus status de acesso
 */
export const getById = query({
  args: {
    id: v.id("ordensServico"),
  },
  handler: async (ctx, args) => {
    const ordem = await ctx.db.get(args.id);
    if (!ordem) {
      return null;
    }

    const pontos = await ctx.db
      .query("pontos")
      .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", args.id))
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

    const atribuicoes = await ctx.db
      .query("atribuicoes")
      .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", args.id))
      .collect();

    const tecnicos = await Promise.all(
      atribuicoes.map(async (atrib) => {
        const tecnico = await ctx.db.get(atrib.tecnicoId);
        return {
          atribuicaoId: atrib._id,
          token: atrib.token,
          enviadoEm: atrib.enviadoEm,
          visualizadoEm: atrib.visualizadoEm,
          tecnico,
        };
      })
    );

    const progresso =
      totalAtividades > 0
        ? Math.round((atividadesConcluidas / totalAtividades) * 100)
        : 0;

    return {
      ...ordem,
      pontos: pontosComAtividades,
      tecnicos,
      totalPontos: pontos.length,
      totalAtividades,
      atividadesConcluidas,
      progresso,
    };
  },
});

/**
 * Cria uma nova ordem de serviço.
 * Define dataCriacao automaticamente com timestamp ISO atual e status como 'rascunho'.
 */
export const create = mutation({
  args: {
    titulo: v.string(),
    descricao: v.optional(v.string()),
    dataLimite: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const dataCriacao = new Date().toISOString();

    const ordemId = await ctx.db.insert("ordensServico", {
      titulo: args.titulo.trim(),
      descricao: args.descricao ? args.descricao.trim() : undefined,
      dataCriacao,
      dataLimite: args.dataLimite,
      status: "rascunho",
    });

    return ordemId;
  },
});

/**
 * Atualiza campos gerais de uma ordem de serviço.
 */
export const update = mutation({
  args: {
    id: v.id("ordensServico"),
    titulo: v.optional(v.string()),
    descricao: v.optional(v.string()),
    dataLimite: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("rascunho"),
        v.literal("ativa"),
        v.literal("concluida"),
        v.literal("cancelada")
      )
    ),
  },
  handler: async (ctx, args) => {
    const ordem = await ctx.db.get(args.id);
    if (!ordem) {
      throw new Error("Ordem de serviço não encontrada");
    }

    const updates: {
      titulo?: string;
      descricao?: string;
      dataLimite?: string;
      status?: "rascunho" | "ativa" | "concluida" | "cancelada";
    } = {};

    if (args.titulo !== undefined) updates.titulo = args.titulo.trim();
    if (args.descricao !== undefined) updates.descricao = args.descricao.trim();
    if (args.dataLimite !== undefined) updates.dataLimite = args.dataLimite;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Atualiza o status de uma ordem de serviço ('rascunho' | 'ativa' | 'concluida' | 'cancelada').
 */
export const updateStatus = mutation({
  args: {
    id: v.id("ordensServico"),
    status: v.union(
      v.literal("rascunho"),
      v.literal("ativa"),
      v.literal("concluida"),
      v.literal("cancelada")
    ),
  },
  handler: async (ctx, args) => {
    const ordem = await ctx.db.get(args.id);
    if (!ordem) {
      throw new Error("Ordem de serviço não encontrada");
    }

    await ctx.db.patch(args.id, { status: args.status });
    return { success: true, status: args.status };
  },
});

/**
 * Remove uma ordem de serviço e realiza a exclusão em cascata:
 * - Todas as atividades vinculadas aos pontos da OS
 * - Todos os pontos da OS
 * - Todas as atribuições da OS
 * - A própria ordem de serviço
 */
export const remove = mutation({
  args: {
    id: v.id("ordensServico"),
  },
  handler: async (ctx, args) => {
    const ordem = await ctx.db.get(args.id);
    if (!ordem) {
      throw new Error("Ordem de serviço não encontrada");
    }

    // 1. Buscar todos os pontos da ordem
    const pontos = await ctx.db
      .query("pontos")
      .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", args.id))
      .collect();

    // 2. Para cada ponto, excluir todas as suas atividades e depois o ponto
    for (const ponto of pontos) {
      const atividades = await ctx.db
        .query("atividades")
        .withIndex("by_pontoId", (q) => q.eq("pontoId", ponto._id))
        .collect();

      for (const atividade of atividades) {
        await ctx.db.delete(atividade._id);
      }

      await ctx.db.delete(ponto._id);
    }

    // 3. Excluir todas as atribuições vinculadas à ordem
    const atribuicoes = await ctx.db
      .query("atribuicoes")
      .withIndex("by_ordemServicoId", (q) => q.eq("ordemServicoId", args.id))
      .collect();

    for (const atribuicao of atribuicoes) {
      await ctx.db.delete(atribuicao._id);
    }

    // 4. Excluir a ordem de serviço
    await ctx.db.delete(args.id);

    return { success: true };
  },
});

/**
 * Cria uma ordem de serviço completa com seus pontos, atividades e atribuições em uma única transação rápida.
 */
export const createOrdemComPontos = mutation({
  args: {
    titulo: v.string(),
    descricao: v.optional(v.string()),
    dataLimite: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("rascunho"),
        v.literal("ativa"),
        v.literal("concluida"),
        v.literal("cancelada")
      )
    ),
    tecnicosIds: v.optional(v.array(v.id("tecnicos"))),
    atividadesPadrao: v.optional(v.array(v.string())),
    pontos: v.array(
      v.object({
        numeroPonto: v.string(),
        numeroEletro: v.optional(v.string()),
        numeroParada: v.optional(v.string()),
        rota: v.optional(v.string()),
        modelo: v.optional(v.string()),
        endereco: v.string(),
        referencia: v.optional(v.string()),
        tipo: v.union(v.literal("totem"), v.literal("abrigo"), v.literal("outro")),
        latitude: v.optional(v.number()),
        longitude: v.optional(v.number()),
        ordem: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const dataCriacao = new Date().toISOString();
    const ordemId = await ctx.db.insert("ordensServico", {
      titulo: args.titulo.trim(),
      descricao: args.descricao ? args.descricao.trim() : undefined,
      dataCriacao,
      dataLimite: args.dataLimite,
      status: args.status || "rascunho",
    });

    const atividadesList =
      args.atividadesPadrao && args.atividadesPadrao.length > 0
        ? args.atividadesPadrao
        : [
            "Limpeza geral",
            "Verificar iluminação",
            "Verificar estrutura",
            "Verificar vidros",
          ];

    let seq = 1;
    for (const p of args.pontos) {
      if (!p.endereco.trim()) continue;
      const pontoId = await ctx.db.insert("pontos", {
        ordemServicoId: ordemId,
        numeroPonto: p.numeroPonto.trim() || `P-${seq}`,
        numeroEletro: p.numeroEletro ? p.numeroEletro.trim() : undefined,
        numeroParada: p.numeroParada ? p.numeroParada.trim() : undefined,
        rota: p.rota ? p.rota.trim() : undefined,
        modelo: p.modelo ? p.modelo.trim() : undefined,
        endereco: p.endereco.trim(),
        referencia: p.referencia ? p.referencia.trim() : undefined,
        tipo: p.tipo,
        latitude: p.latitude,
        longitude: p.longitude,
        ordem: p.ordem ?? seq,
      });
      seq++;

      for (const desc of atividadesList) {
        if (desc && desc.trim()) {
          await ctx.db.insert("atividades", {
            pontoId,
            descricao: desc.trim(),
            concluida: false,
          });
        }
      }
    }

    if (args.tecnicosIds && args.tecnicosIds.length > 0) {
      for (const tecId of args.tecnicosIds) {
        const token =
          Math.random().toString(36).substring(2) +
          Date.now().toString(36) +
          Math.random().toString(36).substring(2, 6);
        await ctx.db.insert("atribuicoes", {
          ordemServicoId: ordemId,
          tecnicoId: tecId,
          token,
        });
      }
    }

    return ordemId;
  },
});

/**
 * Cria múltiplas ordens de serviço preventivas em lote para diversas rotas selecionadas.
 */
export const createBatchOrdens = mutation({
  args: {
    ordens: v.array(
      v.object({
        titulo: v.string(),
        descricao: v.optional(v.string()),
        dataLimite: v.optional(v.string()),
        status: v.optional(
          v.union(
            v.literal("rascunho"),
            v.literal("ativa"),
            v.literal("concluida"),
            v.literal("cancelada")
          )
        ),
        tecnicosIds: v.optional(v.array(v.id("tecnicos"))),
        atividadesPadrao: v.optional(v.array(v.string())),
        pontos: v.array(
          v.object({
            numeroPonto: v.string(),
            numeroEletro: v.optional(v.string()),
            numeroParada: v.optional(v.string()),
            rota: v.optional(v.string()),
            modelo: v.optional(v.string()),
            endereco: v.string(),
            referencia: v.optional(v.string()),
            tipo: v.union(v.literal("totem"), v.literal("abrigo"), v.literal("outro")),
            latitude: v.optional(v.number()),
            longitude: v.optional(v.number()),
            ordem: v.optional(v.number()),
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const dataCriacao = new Date().toISOString();
    const createdIds: string[] = [];

    for (const item of args.ordens) {
      const ordemId = await ctx.db.insert("ordensServico", {
        titulo: item.titulo.trim(),
        descricao: item.descricao ? item.descricao.trim() : undefined,
        dataCriacao,
        dataLimite: item.dataLimite,
        status: item.status || "rascunho",
      });
      createdIds.push(ordemId);

      const atividadesList =
        item.atividadesPadrao && item.atividadesPadrao.length > 0
          ? item.atividadesPadrao
          : [
              "Limpeza geral",
              "Verificar iluminação",
              "Verificar estrutura",
              "Verificar vidros",
            ];

      let seq = 1;
      for (const p of item.pontos) {
        if (!p.endereco.trim()) continue;
        const pontoId = await ctx.db.insert("pontos", {
          ordemServicoId: ordemId,
          numeroPonto: p.numeroPonto.trim() || `P-${seq}`,
          numeroEletro: p.numeroEletro ? p.numeroEletro.trim() : undefined,
          numeroParada: p.numeroParada ? p.numeroParada.trim() : undefined,
          rota: p.rota ? p.rota.trim() : undefined,
          modelo: p.modelo ? p.modelo.trim() : undefined,
          endereco: p.endereco.trim(),
          referencia: p.referencia ? p.referencia.trim() : undefined,
          tipo: p.tipo,
          latitude: p.latitude,
          longitude: p.longitude,
          ordem: p.ordem ?? seq,
        });
        seq++;

        for (const desc of atividadesList) {
          if (desc && desc.trim()) {
            await ctx.db.insert("atividades", {
              pontoId,
              descricao: desc.trim(),
              concluida: false,
            });
          }
        }
      }

      if (item.tecnicosIds && item.tecnicosIds.length > 0) {
        for (const tecId of item.tecnicosIds) {
          const token =
            Math.random().toString(36).substring(2) +
            Date.now().toString(36) +
            Math.random().toString(36).substring(2, 6);
          await ctx.db.insert("atribuicoes", {
            ordemServicoId: ordemId,
            tecnicoId: tecId,
            token,
          });
        }
      }
    }

    return { success: true, count: createdIds.length, ordensIds: createdIds };
  },
});
