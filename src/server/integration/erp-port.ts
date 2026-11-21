/**
 * Portas de integração com ERP.
 * A primeira versão não conversa com SAP nem com outro sistema externo.
 * Um adaptador futuro implementa estas interfaces sem alterar o núcleo do E-Kanban.
 */

export type ErpMaterial = {
  code: string;
  name: string;
  unit: string;
  active: boolean;
};

export type ErpStockSnapshot = {
  materialCode: string;
  locationCode: string;
  quantity: number;
};

export type ErpReplenishment = {
  materialCode: string;
  locationCode: string;
  quantity: number;
  externalId?: string;
};

export type ErpMovement = {
  materialCode: string;
  type: "IN" | "OUT";
  quantity: number;
  happenedAt: string;
};

export interface ErpPort {
  readonly name: string;
  pullMaterials(): Promise<ErpMaterial[]>;
  pushStock(snapshot: ErpStockSnapshot[]): Promise<void>;
  pushReplenishment(request: ErpReplenishment): Promise<void>;
  pushMovement(movement: ErpMovement): Promise<void>;
}

export class IndependentErp implements ErpPort {
  readonly name = "independent";

  async pullMaterials(): Promise<ErpMaterial[]> {
    throw new Error("Nenhum ERP está conectado. O E-Kanban funciona de forma independente.");
  }

  async pushStock(): Promise<void> {
    throw new Error("Nenhum ERP está conectado. O E-Kanban funciona de forma independente.");
  }

  async pushReplenishment(): Promise<void> {
    throw new Error("Nenhum ERP está conectado. O E-Kanban funciona de forma independente.");
  }

  async pushMovement(): Promise<void> {
    throw new Error("Nenhum ERP está conectado. O E-Kanban funciona de forma independente.");
  }
}

export function getErpPort(): ErpPort {
  return new IndependentErp();
}
