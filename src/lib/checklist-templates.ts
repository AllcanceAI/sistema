export type ChecklistTemplateItem = { label: string };

export const CHECKLIST_ENTRADA: ChecklistTemplateItem[] = [
  { label: "Lataria / pintura (riscos e amassados)" },
  { label: "Para-brisa e vidros" },
  { label: "Faróis, lanternas e setas" },
  { label: "Pneus e estepe" },
  { label: "Nível de combustível" },
  { label: "Km de entrada registrado" },
  { label: "Interior / estofamento" },
  { label: "Itens pessoais no veículo" },
  { label: "Documentos do veículo" },
  { label: "Chaves entregues" },
];

export const CHECKLIST_DIAGNOSTICO: ChecklistTemplateItem[] = [
  { label: "Motor — ruídos, marcha lenta, vazamentos" },
  { label: "Sistema de arrefecimento" },
  { label: "Óleo e filtros" },
  { label: "Freios — discos, pastilhas, fluido" },
  { label: "Suspensão e amortecedores" },
  { label: "Direção e alinhamento" },
  { label: "Embreagem / câmbio" },
  { label: "Sistema elétrico e bateria" },
  { label: "Escapamento" },
  { label: "Ar-condicionado" },
  { label: "Leitura de erros (scanner)" },
  { label: "Teste de rodagem" },
];

export const CHECK_STATE_LABELS: Record<string, string> = {
  ok: "OK",
  atencao: "Atenção",
  critico: "Crítico",
  na: "N/A",
};
