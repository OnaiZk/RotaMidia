import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Retorna dados analíticos completos para a central de relatórios:
 * - Métricas globais consolidadas (KPIs)
 * - Relatório detalhado de ordens pendentes (rascunho / ativas, cálculo de atraso, progresso)
 * - Relatório detalhado de ordens concluídas
 * - Relatório de produtividade por técnico com:
 *    * Gráfico de evolução temporal de atividades realizadas (diário e acumulado)
 *    * Ordens em andamento/execução com gráfico da % concluída de cada ordem e contribuição individual
 */
export const getDadosCompletos = query({
  args: {
    periodoDias: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Carregar dados base
    const ordens = await ctx.db.query("ordensServico").collect();
    const pontos = await ctx.db.query("pontos").collect();
    const atividades = await ctx.db.query("atividades").collect();
    const tecnicos = await ctx.db.query("tecnicos").collect();
    const atribuicoes = await ctx.db.query("atribuicoes").collect();

    // Mapas para busca rápida em O(1)
    const tecnicosMap = new Map(tecnicos.map((t) => [t._id.toString(), t]));
    const ordensMap = new Map(ordens.map((o) => [o._id.toString(), o]));
    const pontosMap = new Map(pontos.map((p) => [p._id.toString(), p]));

    // Agrupar pontos por ordem
    const pontosPorOrdem = new Map<string, typeof pontos>();
    for (const ponto of pontos) {
      const oId = ponto.ordemServicoId.toString();
      if (!pontosPorOrdem.has(oId)) pontosPorOrdem.set(oId, []);
      pontosPorOrdem.get(oId)!.push(ponto);
    }

    // Agrupar atividades por ponto
    const atividadesPorPonto = new Map<string, typeof atividades>();
    for (const ativ of atividades) {
      const pId = ativ.pontoId.toString();
      if (!atividadesPorPonto.has(pId)) atividadesPorPonto.set(pId, []);
      atividadesPorPonto.get(pId)!.push(ativ);
    }

    // Agrupar atribuições por ordem
    const atribuicoesPorOrdem = new Map<string, typeof atribuicoes>();
    for (const atrib of atribuicoes) {
      const oId = atrib.ordemServicoId.toString();
      if (!atribuicoesPorOrdem.has(oId)) atribuicoesPorOrdem.set(oId, []);
      atribuicoesPorOrdem.get(oId)!.push(atrib);
    }

    // Agrupar atribuições por técnico
    const atribuicoesPorTecnico = new Map<string, typeof atribuicoes>();
    for (const atrib of atribuicoes) {
      const tId = atrib.tecnicoId.toString();
      if (!atribuicoesPorTecnico.has(tId)) atribuicoesPorTecnico.set(tId, []);
      atribuicoesPorTecnico.get(tId)!.push(atrib);
    }

    // Mapear atividades concluídas por técnico
    interface AtividadeDetalhada {
      _id: string;
      descricao: string;
      concluidaEm?: string;
      observacao?: string;
      pontoNumero: string;
      pontoEndereco: string;
      ordemId: string;
      ordemTitulo: string;
    }

    const atividadesPorTecnico = new Map<string, AtividadeDetalhada[]>();
    for (const ponto of pontos) {
      const pAtivs = atividadesPorPonto.get(ponto._id.toString()) || [];
      const isConcluido = pAtivs.length > 0 && pAtivs.every((a) => a.concluida);
      
      if (isConcluido) {
        // Encontra a atividade que tem a informação de quem concluiu
        const ativConcluida = pAtivs.find(a => a.concluidaPorId);
        
        if (ativConcluida && ativConcluida.concluidaPorId) {
          const tId = ativConcluida.concluidaPorId.toString();
          if (!atividadesPorTecnico.has(tId)) atividadesPorTecnico.set(tId, []);

          const ordem = ordensMap.get(ponto.ordemServicoId.toString());

          atividadesPorTecnico.get(tId)!.push({
            _id: ponto._id.toString(), // Usamos o ID do ponto
            descricao: 'Manutenção do Ponto', // Descrição simplificada por ponto
            concluidaEm: ativConcluida.concluidaEm,
            observacao: ativConcluida.observacao, // Ou juntar todas
            pontoNumero: ponto.numeroPonto || "N/A",
            pontoEndereco: ponto.endereco || "Endereço não informado",
            ordemId: ordem?._id.toString() || "",
            ordemTitulo: ordem?.titulo || "Ordem desconhecida",
          });
        }
      }
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 2. Processar Ordens com Estatísticas Consolidadas
    const ordensProcessadas = ordens.map((ordem) => {
      const oId = ordem._id.toString();
      const ordemPontos = pontosPorOrdem.get(oId) || [];
      
      let totalAtividades = ordemPontos.length;
      let atividadesConcluidas = 0;
      let ultimaDataConclusao: string | null = null;
      const atividadesFeitasPorTecnicoNaOrdem: Record<string, number> = {};

      for (const p of ordemPontos) {
        const pAtivs = atividadesPorPonto.get(p._id.toString()) || [];
        const isConcluido = pAtivs.length > 0 && pAtivs.every((a) => a.concluida);
        
        if (isConcluido) {
          atividadesConcluidas++;
          
          let tIdEncontrado = null;
          let maiorData = null;
          
          for (const a of pAtivs) {
            if (a.concluidaPorId && !tIdEncontrado) tIdEncontrado = a.concluidaPorId.toString();
            if (a.concluidaEm && (!maiorData || a.concluidaEm > maiorData)) maiorData = a.concluidaEm;
          }
          
          if (tIdEncontrado) {
             atividadesFeitasPorTecnicoNaOrdem[tIdEncontrado] = (atividadesFeitasPorTecnicoNaOrdem[tIdEncontrado] || 0) + 1;
          }
          if (maiorData) {
            if (!ultimaDataConclusao || maiorData > ultimaDataConclusao) {
              ultimaDataConclusao = maiorData;
            }
          }
        }
      }

      const atribuicoesOrdem = atribuicoesPorOrdem.get(oId) || [];
      const tecnicosOrdem = atribuicoesOrdem
        .map((a) => {
          const tec = tecnicosMap.get(a.tecnicoId.toString());
          if (!tec) return null;
          return {
            _id: tec._id,
            nome: tec.nome,
            email: tec.email,
            telefone: tec.telefone,
            visualizadoEm: a.visualizadoEm,
            enviadoEm: a.enviadoEm,
          };
        })
        .filter(Boolean);

      const progresso =
        totalAtividades > 0
          ? Math.round((atividadesConcluidas / totalAtividades) * 100)
          : 0;

      // Cálculo de prazo e atraso
      let diasRestantes: number | null = null;
      let estaAtrasada = false;
      let statusPrazo: "no_prazo" | "alerta" | "atrasada" | "sem_prazo" = "sem_prazo";

      if (ordem.dataLimite) {
        const dataLimiteObj = new Date(ordem.dataLimite);
        dataLimiteObj.setHours(0, 0, 0, 0);
        const diffTempo = dataLimiteObj.getTime() - hoje.getTime();
        diasRestantes = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));

        if (ordem.status !== "concluida" && ordem.status !== "cancelada") {
          if (diasRestantes < 0) {
            estaAtrasada = true;
            statusPrazo = "atrasada";
          } else if (diasRestantes <= 2) {
            statusPrazo = "alerta";
          } else {
            statusPrazo = "no_prazo";
          }
        }
      }

      return {
        ...ordem,
        totalPontos: ordemPontos.length,
        totalAtividades,
        atividadesConcluidas,
        atividadesPendentes: totalAtividades - atividadesConcluidas,
        progresso,
        tecnicos: tecnicosOrdem,
        diasRestantes,
        estaAtrasada,
        statusPrazo,
        ultimaDataConclusao,
        atividadesFeitasPorTecnicoNaOrdem,
      };
    });

    const ordensMapProcessadas = new Map(ordensProcessadas.map((o) => [o._id.toString(), o]));

    // 3. Segmentar Ordens Pendentes vs Concluídas
    const ordensPendentes = ordensProcessadas
      .filter((o) => o.status === "rascunho" || o.status === "ativa")
      .sort((a, b) => {
        if (a.estaAtrasada && !b.estaAtrasada) return -1;
        if (!a.estaAtrasada && b.estaAtrasada) return 1;
        if (a.dataLimite && b.dataLimite) return a.dataLimite.localeCompare(b.dataLimite);
        if (a.dataLimite) return -1;
        if (b.dataLimite) return 1;
        return b.dataCriacao.localeCompare(a.dataCriacao);
      });

    const ordensConcluidas = ordensProcessadas
      .filter((o) => o.status === "concluida" || (o.totalAtividades > 0 && o.progresso === 100))
      .sort((a, b) => (b.ultimaDataConclusao || b.dataCriacao).localeCompare(a.ultimaDataConclusao || a.dataCriacao));

    const ordensCanceladas = ordensProcessadas.filter((o) => o.status === "cancelada");

    // 4. Montar Relatório Detalhado de Técnicos com Gráfico de Evolução e Ordens em Andamento
    const relatorioTecnicos = tecnicos.map((tec) => {
      const tId = tec._id.toString();
      const ativs = atividadesPorTecnico.get(tId) || [];
      ativs.sort((a, b) => (b.concluidaEm || "").localeCompare(a.concluidaEm || ""));

      const ordensIds = new Set(ativs.map((a) => a.ordemId).filter(Boolean));
      const atribs = atribuicoesPorTecnico.get(tId) || [];
      const ordensAtribuidasIds = new Set(atribs.map((a) => a.ordemServicoId.toString()));

      // 4.1 Identificar Ordens em Andamento em que o Técnico atua
      const ordensEmAndamentoSet = new Set<string>();
      ordensAtribuidasIds.forEach((oId) => {
        const ord = ordensMapProcessadas.get(oId);
        if (ord && (ord.status === "ativa" || ord.status === "rascunho") && ord.progresso < 100) {
          ordensEmAndamentoSet.add(oId);
        }
      });
      ordensIds.forEach((oId) => {
        const ord = ordensMapProcessadas.get(oId);
        if (ord && (ord.status === "ativa" || ord.status === "rascunho") && ord.progresso < 100) {
          ordensEmAndamentoSet.add(oId);
        }
      });

      const ordensEmAndamento = Array.from(ordensEmAndamentoSet).map((oId) => {
        const ord = ordensMapProcessadas.get(oId)!;
        const feitasPeloTecnico = ord.atividadesFeitasPorTecnicoNaOrdem[tId] || 0;
        return {
          ordemId: ord._id.toString(),
          titulo: ord.titulo,
          status: ord.status,
          progresso: ord.progresso,
          totalPontos: ord.totalPontos,
          totalAtividades: ord.totalAtividades,
          atividadesConcluidas: ord.atividadesConcluidas,
          atividadesPendentes: ord.atividadesPendentes,
          atividadesFeitasPeloTecnico: feitasPeloTecnico,
          dataLimite: ord.dataLimite,
          diasRestantes: ord.diasRestantes,
          estaAtrasada: ord.estaAtrasada,
          statusPrazo: ord.statusPrazo,
        };
      });

      // Ordenar ordens em andamento pelas com prazo mais crítico ou maior atividade
      ordensEmAndamento.sort((a, b) => {
        if (a.estaAtrasada && !b.estaAtrasada) return -1;
        if (!a.estaAtrasada && b.estaAtrasada) return 1;
        return b.progresso - a.progresso;
      });

      // 4.2 Gráfico de Evolução Temporal (Agrupamento diário cronológico)
      // Agrupar atividades por data ISO YYYY-MM-DD
      const atividadesPorDia = new Map<string, number>();
      for (const a of ativs) {
        if (a.concluidaEm) {
          const diaIso = a.concluidaEm.split("T")[0];
          atividadesPorDia.set(diaIso, (atividadesPorDia.get(diaIso) || 0) + 1);
        }
      }

      // Montar série temporal ordenada
      const datasOrdenadas = Array.from(atividadesPorDia.keys()).sort();
      let acumulado = 0;
      const evolucaoTemporal = datasOrdenadas.map((diaIso) => {
        const qtd = atividadesPorDia.get(diaIso) || 0;
        acumulado += qtd;
        const [ano, mes, dia] = diaIso.split("-");
        return {
          dataIso: diaIso,
          dataFormatada: `${dia}/${mes}`,
          quantidade: qtd,
          acumulado,
        };
      });

      return {
        _id: tec._id,
        nome: tec.nome,
        email: tec.email,
        telefone: tec.telefone,
        totalAtividadesFeitas: ativs.length,
        totalOrdensComAtividades: ordensIds.size,
        totalOrdensAtribuidas: ordensAtribuidasIds.size,
        ordensEmAndamento,
        evolucaoTemporal,
        ultimaAtividadeEm: ativs.length > 0 ? ativs[0].concluidaEm : null,
        atividades: ativs,
      };
    });

    // Ordenar técnicos por quem mais fez atividades (ranking de produtividade)
    relatorioTecnicos.sort((a, b) => {
      if (b.totalAtividadesFeitas !== a.totalAtividadesFeitas) {
        return b.totalAtividadesFeitas - a.totalAtividadesFeitas;
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });

    // 5. Métricas Gerais (KPIs)
    const totalPontosGeral = pontos.length;
    
    // Contagem por endereço/ponto
    let pontosConcluidosGeral = 0;
    for (const p of pontos) {
      const pAtivs = atividades.filter(a => a.pontoId === p._id);
      if (pAtivs.length > 0 && pAtivs.every(a => a.concluida)) {
        pontosConcluidosGeral++;
      }
    }
    
    const totalAtividadesGeral = totalPontosGeral;
    const totalAtividadesConcluidasGeral = pontosConcluidosGeral;
    const totalAtividadesPendentesGeral = totalAtividadesGeral - totalAtividadesConcluidasGeral;
    const taxaGeralConclusao = totalAtividadesGeral > 0
      ? Math.round((totalAtividadesConcluidasGeral / totalAtividadesGeral) * 100)
      : 0;

    const ordensAtrasadas = ordensPendentes.filter((o) => o.estaAtrasada).length;
    const ordensAlertaPrazo = ordensPendentes.filter((o) => o.statusPrazo === "alerta").length;
    const tecnicosComAtividade = relatorioTecnicos.filter((t) => t.totalAtividadesFeitas > 0).length;

    return {
      metricas: {
        totalOrdens: ordens.length,
        totalPendentes: ordensPendentes.length,
        totalConcluidas: ordensConcluidas.length,
        totalCanceladas: ordensCanceladas.length,
        ordensAtrasadas,
        ordensAlertaPrazo,
        totalPontos: totalPontosGeral,
        totalAtividades: totalAtividadesGeral,
        totalAtividadesConcluidas: totalAtividadesConcluidasGeral,
        totalAtividadesPendentes: totalAtividadesPendentesGeral,
        taxaGeralConclusao,
        totalTecnicos: tecnicos.length,
        tecnicosComAtividade,
      },
      ordensPendentes,
      ordensConcluidas,
      relatorioTecnicos,
    };
  },
});
