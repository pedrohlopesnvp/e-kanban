export const roleLabels = {
  ADMIN: "Administrador",
  OPERATOR: "Operador",
  VIEWER: "Visualizador",
} as const;

export const movementLabels = {
  IN: "Entrada",
  OUT: "Saída",
  ADJUSTMENT: "Ajuste de inventário",
  TRANSFER: "Transferência",
  RESERVE: "Reserva",
  RELEASE: "Liberação de reserva",
  RETURN: "Devolução",
} as const;

export const statusLabels = {
  AVAILABLE: "Disponível",
  NEEDED: "Reposição necessária",
  REQUESTED: "Reposição solicitada",
  IN_SUPPLY: "Em abastecimento",
  REPLENISHED: "Reabastecido",
  CANCELLED: "Cancelada",
} as const;

export const priorityLabels = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
} as const;

export const containerTypeLabels = {
  BOX: "Caixa",
  DRAWER: "Gaveta",
  TRAY: "Bandeja",
  SHELF: "Prateleira",
  CUSTOM: "Personalizado",
} as const;

export const binRoleLabels = {
  NONE: "Não faz parte de par",
  WORKING: "Caixa em uso",
  TRIGGER: "Caixa de disparo",
} as const;

export const containerStatusLabels = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  IN_REPLENISHMENT: "Em reposição",
} as const;

export const kanbanColumns = [
  {
    id: "AVAILABLE",
    title: "Disponível",
    hint: "Estoque completo, pronto para uso",
    tone: "blue",
  },
  {
    id: "IN_USE",
    title: "Em uso",
    hint: "Estoque em consumo, acima da reposição",
    tone: "green",
  },
  {
    id: "CRITICAL",
    title: "Crítico",
    hint: "Reposição necessária",
    tone: "yellow",
  },
  {
    id: "EMPTY",
    title: "Vazio",
    hint: "Sem saldo disponível",
    tone: "red",
  },
] as const;

export type KanbanColumnId = (typeof kanbanColumns)[number]["id"];
