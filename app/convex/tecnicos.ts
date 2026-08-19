import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Lista todos os técnicos cadastrados, ordenados alfabeticamente por nome.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const tecnicos = await ctx.db.query("tecnicos").collect();
    return tecnicos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },
});

/**
 * Retorna um técnico específico pelo seu ID.
 */
export const getById = query({
  args: {
    id: v.id("tecnicos"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Cadastra um novo técnico de manutenção.
 */
export const create = mutation({
  args: {
    nome: v.string(),
    email: v.string(),
    telefone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const emailSanitizado = args.email.trim().toLowerCase();
    const nomeSanitizado = args.nome.trim();

    // Validação de unicidade do e-mail
    const existente = await ctx.db
      .query("tecnicos")
      .withIndex("by_email", (q) => q.eq("email", emailSanitizado))
      .first();

    if (existente) {
      throw new Error(`Já existe um técnico cadastrado com o e-mail: ${emailSanitizado}`);
    }

    const tecnicoId = await ctx.db.insert("tecnicos", {
      nome: nomeSanitizado,
      email: emailSanitizado,
      telefone: args.telefone ? args.telefone.trim() : undefined,
    });

    return tecnicoId;
  },
});

/**
 * Atualiza os dados de um técnico existente.
 */
export const update = mutation({
  args: {
    id: v.id("tecnicos"),
    nome: v.optional(v.string()),
    email: v.optional(v.string()),
    telefone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tecnico = await ctx.db.get(args.id);
    if (!tecnico) {
      throw new Error("Técnico não encontrado");
    }

    const updates: {
      nome?: string;
      email?: string;
      telefone?: string;
    } = {};

    if (args.nome !== undefined) {
      updates.nome = args.nome.trim();
    }

    if (args.email !== undefined) {
      const emailSanitizado = args.email.trim().toLowerCase();
      if (emailSanitizado !== tecnico.email) {
        const existente = await ctx.db
          .query("tecnicos")
          .withIndex("by_email", (q) => q.eq("email", emailSanitizado))
          .first();
        if (existente && existente._id !== args.id) {
          throw new Error(`Já existe outro técnico com o e-mail: ${emailSanitizado}`);
        }
      }
      updates.email = emailSanitizado;
    }

    if (args.telefone !== undefined) {
      updates.telefone = args.telefone ? args.telefone.trim() : undefined;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Remove um técnico do sistema e limpa as suas atribuições pendentes.
 */
export const remove = mutation({
  args: {
    id: v.id("tecnicos"),
  },
  handler: async (ctx, args) => {
    const tecnico = await ctx.db.get(args.id);
    if (!tecnico) {
      throw new Error("Técnico não encontrado");
    }

    // Remover atribuições vinculadas a este técnico
    const atribuicoes = await ctx.db
      .query("atribuicoes")
      .withIndex("by_tecnicoId", (q) => q.eq("tecnicoId", args.id))
      .collect();

    for (const atribuicao of atribuicoes) {
      await ctx.db.delete(atribuicao._id);
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

/**
 * Importa múltiplos técnicos em lote (via planilha).
 * Se o e-mail já existir, atualiza os dados cadastrais (upsert).
 */
export const importBatch = mutation({
  args: {
    tecnicos: v.array(
      v.object({
        nome: v.string(),
        email: v.string(),
        telefone: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (const tec of args.tecnicos) {
      const emailSanitizado = tec.email.trim().toLowerCase();
      const nomeSanitizado = tec.nome.trim();
      const telefoneSanitizado = tec.telefone?.trim() || undefined;

      if (!nomeSanitizado || !emailSanitizado) {
        ignorados++;
        continue;
      }

      const existente = await ctx.db
        .query("tecnicos")
        .withIndex("by_email", (q) => q.eq("email", emailSanitizado))
        .first();

      if (existente) {
        await ctx.db.patch(existente._id, {
          nome: nomeSanitizado,
          ...(telefoneSanitizado !== undefined ? { telefone: telefoneSanitizado } : {}),
        });
        atualizados++;
      } else {
        await ctx.db.insert("tecnicos", {
          nome: nomeSanitizado,
          email: emailSanitizado,
          telefone: telefoneSanitizado,
        });
        inseridos++;
      }
    }

    return {
      inseridos,
      atualizados,
      ignorados,
      total: args.tecnicos.length,
    };
  },
});
