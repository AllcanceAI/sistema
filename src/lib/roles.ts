export const APP_ROLES = [
  "dono",
  "gerente",
  "secretaria",
  "mecanico",
  "contabilidade",
  "funcionario",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  dono: "Dono",
  gerente: "Gerente",
  secretaria: "Secretaria",
  mecanico: "Mecânico",
  contabilidade: "Contabilidade",
  funcionario: "Funcionário",
};

export const PERMISSIONS = [
  { key: "gerenciar_usuarios", label: "Gerenciar usuários e permissões" },
  { key: "cadastrar_os", label: "Abrir e editar ordens de serviço" },
  { key: "lancar_diagnostico", label: "Lançar diagnóstico e laudo" },
  { key: "aprovar_orcamento", label: "Aprovar orçamento" },
  { key: "aprovar_compra", label: "Aprovar compra de peças" },
  { key: "ver_financeiro", label: "Ver valores e financeiro" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const OS_STATUS_LABELS: Record<string, string> = {
  recebido: "Recebido",
  checklist: "Checklist",
  diagnostico: "Diagnóstico",
  orcamento: "Orçamento",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovado: "Aprovado",
  compra_pecas: "Compra de peças",
  em_execucao: "Em execução",
  concluido: "Concluído",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const STAGE_LABELS: Record<string, string> = {
  entrada: "Entrada do veículo",
  checklist: "Checklist",
  defeito: "Peça com defeito",
  peca_nova: "Peça nova",
  servico_concluido: "Serviço realizado",
  outro: "Outro",
};

export const APPROVAL_STAGE_LABELS: Record<string, string> = {
  orcamento: "Aprovação do orçamento",
  compra_pecas: "Aprovação da compra de peças",
  execucao: "Liberação da execução",
  entrega: "Liberação da entrega",
};
