# Integração com ERP

O E-Kanban funciona sozinho. Esta versão não envia dados ao SAP nem consulta outro ERP.

## Porta de saída e entrada

`src/server/integration/erp-port.ts` define o que um adaptador futuro precisa implementar:

- `pullMaterials`: importar cadastros.
- `pushStock`: enviar uma fotografia dos saldos.
- `pushReplenishment`: enviar uma solicitação de reposição.
- `pushMovement`: sincronizar uma movimentação.

`getErpPort()` devolve `IndependentErp`, que recusa essas operações com uma mensagem explícita. Um adaptador SAP futuro substitui essa classe sem alterar estoque, Kanban ou telas.

## Contrato HTTP

As rotas abaixo existem para um middleware futuro consultar o E-Kanban. Elas ficam desligadas até um administrador habilitar a integração e definir uma chave em Configurações. A chave vai no cabeçalho `X-Api-Key`.

| Método | Rota | Conteúdo |
| --- | --- | --- |
| GET | `/api/integration/v1/materials` | Cadastro de materiais |
| GET | `/api/integration/v1/stock` | Saldos por localização e recipiente |
| GET | `/api/integration/v1/replenishments` | Solicitações ativas |
| GET | `/api/integration/v1/movements?from=2026-01-01` | Movimentações, no máximo 500 |

Com a integração desligada, a resposta é `403`. Com a chave errada, `401`.

Essas rotas apenas leem o banco do E-Kanban. Elas não chamam um sistema externo.
