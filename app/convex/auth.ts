import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

function validarDominioEletromidia(email: string): boolean {
  const emailLower = email.trim().toLowerCase();
  return (
    emailLower.endsWith("@eletromidia.com.br") ||
    emailLower.endsWith("@eletromidia.com") ||
    emailLower === "cassiano.silva@eletromidia.com.br"
  );
}

/**
 * Sincroniza o usuário autenticado pelo Clerk no banco do Convex.
 * Valida o domínio institucional @eletromidia.com.br e define a permissão.
 */
export const sincronizarUsuario = mutation({
  args: {
    clerkId: v.string(),
    nome: v.string(),
    email: v.string(),
    fotoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const emailLimpo = args.email.trim().toLowerCase();
    const dominioValido = validarDominioEletromidia(emailLimpo);

    if (!dominioValido) {
      return {
        permitido: false,
        motivo: "dominio_invalido",
        mensagem: "Apenas e-mails corporativos (@eletromidia.com.br) têm autorização para solicitar acesso ao painel de gestão.",
        usuario: null,
      };
    }

    const usuarioExistente = await ctx.db
      .query("usuariosAdmin")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    const agora = new Date().toISOString();
    const ehDonoOriginal = emailLimpo === "cassiano.silva@eletromidia.com.br";

    if (usuarioExistente) {
      // Atualizar nome ou foto se tiver mudado
      const atualizacoes: any = {
        nome: args.nome,
        fotoUrl: args.fotoUrl,
        email: emailLimpo,
      };

      // Garante que o dono original sempre seja aprovado e seja super admin
      if (ehDonoOriginal && (usuarioExistente.status !== "aprovado" || !usuarioExistente.ehSuperAdmin)) {
        atualizacoes.status = "aprovado";
        atualizacoes.ehSuperAdmin = true;
      }

      await ctx.db.patch(usuarioExistente._id, atualizacoes);

      const statusFinal = ehDonoOriginal ? "aprovado" : usuarioExistente.status;

      return {
        permitido: statusFinal === "aprovado",
        motivo: statusFinal,
        mensagem:
          statusFinal === "aprovado"
            ? "Acesso autorizado."
            : statusFinal === "pendente"
            ? "Seu cadastro está aguardando aprovação do administrador."
            : "Seu acesso ao painel foi revogado.",
        usuario: {
          ...usuarioExistente,
          ...atualizacoes,
        },
      };
    }

    // Se é o primeiro usuário do sistema OU é o dono original
    const todosUsuarios = await ctx.db.query("usuariosAdmin").collect();
    const ehPrimeiro = todosUsuarios.length === 0;
    const deveAprovarAutomatico = ehPrimeiro || ehDonoOriginal;

    const novoId = await ctx.db.insert("usuariosAdmin", {
      clerkId: args.clerkId,
      nome: args.nome,
      email: emailLimpo,
      fotoUrl: args.fotoUrl,
      status: deveAprovarAutomatico ? "aprovado" : "pendente",
      ehSuperAdmin: deveAprovarAutomatico,
      criadoEm: agora,
      aprovadoEm: deveAprovarAutomatico ? agora : undefined,
      aprovadoPor: deveAprovarAutomatico ? "Sistema (Mestre)" : undefined,
    });

    const novoUsuario = await ctx.db.get(novoId);

    return {
      permitido: deveAprovarAutomatico,
      motivo: deveAprovarAutomatico ? "aprovado" : "pendente",
      mensagem: deveAprovarAutomatico
        ? "Administrador configurado com sucesso."
        : "Cadastro realizado com sucesso! Aguarde a aprovação de um líder.",
      usuario: novoUsuario,
    };
  },
});

/**
 * Consulta os dados e permissões do usuário logado pelo Clerk ID
 */
export const getMeuUsuario = query({
  args: {
    clerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.clerkId) return null;

    const usuario = await ctx.db
      .query("usuariosAdmin")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId!))
      .first();

    return usuario;
  },
});

/**
 * Lista todos os administradores cadastrados para a tela de aprovação de acessos
 */
export const listarUsuariosAdmin = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const adminAtual = await ctx.db
      .query("usuariosAdmin")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!adminAtual || adminAtual.status !== "aprovado") {
      return [];
    }

    const todos = await ctx.db.query("usuariosAdmin").collect();
    // Ordenar: pendentes primeiro, depois por data de criação mais recente
    return todos.sort((a, b) => {
      if (a.status === "pendente" && b.status !== "pendente") return -1;
      if (a.status !== "pendente" && b.status === "pendente") return 1;
      return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
    });
  },
});

/**
 * Aprova o acesso de um líder pendente
 */
export const aprovarUsuario = mutation({
  args: {
    adminClerkId: v.string(),
    usuarioId: v.id("usuariosAdmin"),
  },
  handler: async (ctx, args) => {
    const adminAtual = await ctx.db
      .query("usuariosAdmin")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.adminClerkId))
      .first();

    if (!adminAtual || adminAtual.status !== "aprovado") {
      throw new Error("Você não tem autorização para aprovar usuários.");
    }

    await ctx.db.patch(args.usuarioId, {
      status: "aprovado",
      aprovadoEm: new Date().toISOString(),
      aprovadoPor: adminAtual.nome || adminAtual.email,
    });

    return { sucesso: true };
  },
});

/**
 * Rejeita ou revoga o acesso de um usuário
 */
export const rejeitarUsuario = mutation({
  args: {
    adminClerkId: v.string(),
    usuarioId: v.id("usuariosAdmin"),
  },
  handler: async (ctx, args) => {
    const adminAtual = await ctx.db
      .query("usuariosAdmin")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.adminClerkId))
      .first();

    if (!adminAtual || adminAtual.status !== "aprovado") {
      throw new Error("Você não tem autorização para alterar acessos.");
    }

    const alvo = await ctx.db.get(args.usuarioId);
    if (alvo?.ehSuperAdmin && !adminAtual.ehSuperAdmin) {
      throw new Error("Não é possível revogar o acesso de um Super Administrador.");
    }

    await ctx.db.patch(args.usuarioId, {
      status: "rejeitado",
    });

    return { sucesso: true };
  },
});

/**
 * Remove o registro de um usuário do banco
 */
export const removerUsuario = mutation({
  args: {
    adminClerkId: v.string(),
    usuarioId: v.id("usuariosAdmin"),
  },
  handler: async (ctx, args) => {
    const adminAtual = await ctx.db
      .query("usuariosAdmin")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.adminClerkId))
      .first();

    if (!adminAtual || !adminAtual.ehSuperAdmin) {
      throw new Error("Apenas Super Administradores podem excluir usuários.");
    }

    await ctx.db.delete(args.usuarioId);
    return { sucesso: true };
  },
});
