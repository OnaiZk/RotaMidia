import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tecnicos: defineTable({
    nome: v.string(),
    email: v.string(),
    telefone: v.optional(v.string()),
  }).index("by_email", ["email"]),

  ordensServico: defineTable({
    titulo: v.string(),
    descricao: v.optional(v.string()),
    dataCriacao: v.string(), // Data no formato ISO (ex: "2026-08-18T14:00:00.000Z")
    dataLimite: v.optional(v.string()), // Data limite no formato ISO
    status: v.union(
      v.literal("rascunho"),
      v.literal("ativa"),
      v.literal("concluida"),
      v.literal("cancelada")
    ),
  }).index("by_status", ["status"]),

  atribuicoes: defineTable({
    ordemServicoId: v.id("ordensServico"),
    tecnicoId: v.id("tecnicos"),
    token: v.string(),
    enviadoEm: v.optional(v.string()), // Timestamp ISO de quando o e-mail/notificação foi enviado
    visualizadoEm: v.optional(v.string()), // Timestamp ISO do primeiro acesso do técnico
  })
    .index("by_token", ["token"])
    .index("by_ordemServicoId", ["ordemServicoId"])
    .index("by_tecnicoId", ["tecnicoId"])
    .index("by_ordem_e_tecnico", ["ordemServicoId", "tecnicoId"]),

  pontos: defineTable({
    ordemServicoId: v.id("ordensServico"),
    numeroPonto: v.string(),
    numeroEletro: v.optional(v.string()),
    numeroParada: v.optional(v.string()),
    rota: v.optional(v.string()),
    modelo: v.optional(v.string()),
    endereco: v.string(),
    referencia: v.optional(v.string()),
    tipo: v.union(
      v.literal("totem"),
      v.literal("abrigo"),
      v.literal("outro")
    ),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    ordem: v.number(), // Ordenação sequencial dos pontos na rota (float64)
  })
    .index("by_ordemServicoId", ["ordemServicoId"])
    .index("by_ordemServicoId_ordem", ["ordemServicoId", "ordem"]),

  atividades: defineTable({
    pontoId: v.id("pontos"),
    descricao: v.string(),
    concluida: v.boolean(),
    observacao: v.optional(v.string()),
    concluidaEm: v.optional(v.string()), // Timestamp ISO do momento da conclusão
    concluidaPorId: v.optional(v.id("tecnicos")),
  }).index("by_pontoId", ["pontoId"]),

  usuariosAdmin: defineTable({
    clerkId: v.optional(v.string()),
    nome: v.string(),
    email: v.string(),
    fotoUrl: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("aprovado"),
        v.literal("pendente"),
        v.literal("rejeitado")
      )
    ),
    ehSuperAdmin: v.optional(v.boolean()),
    criadoEm: v.string(),
    aprovadoEm: v.optional(v.string()),
    aprovadoPor: v.optional(v.string()),
    senhaHash: v.optional(v.string()),
    ultimoLogin: v.optional(v.string()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_status", ["status"]),
});

