# E-Kanban

Aplicação web para cadastrar pequenos materiais, controlar o estoque por movimentações e acompanhar a reposição em um quadro Kanban.

O saldo físico e a etapa da reposição são coisas diferentes. Arrastar um cartão para **Reabastecido** não dá entrada no estoque. O recebimento só altera a quantidade quando alguém registra uma movimentação de entrada.

## Requisitos

- Node.js 20 ou superior
- Docker, para subir o PostgreSQL

## Instalação

```bash
docker compose up -d
copy .env.example .env
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

No PowerShell, use `Copy-Item .env.example .env` se o arquivo ainda não existir.

A aplicação fica em [http://localhost:3000](http://localhost:3000).

O comando de seed recria os dados de demonstração e apaga a carga anterior.

## Testes

```bash
npm test
```

As regras de quantidade, reserva, reposição automática e a separação entre Kanban e estoque são testadas sem depender de tela. Os testes de movimentação usam o PostgreSQL e desfazem a transação ao final.

## Decisões de negócio

- A quantidade disponível é a soma de `físico - reservado` nas localizações. Ela não é digitada no cadastro.
- O ponto de reposição é avaliado por material e localização. Enquanto existir solicitação ativa naquele par, outra automática não é aberta.
- Reposição automática só ocorre quando o ponto de reposição é maior que zero.
- No Kanban de duas caixas, zerar a caixa de disparo abre a reposição mesmo que a outra caixa ainda tenha saldo.
- Estoque negativo fica desligado. Um administrador pode permitir saídas além do saldo em Configurações. Reserva continua limitada ao disponível.
- Cadastros com histórico não são apagados. Materiais, locais e recipientes com saldo não podem ser desativados.
- O QR Code contém apenas a URL com um identificador interno.

## Arquitetura

```text
src/app            interface e APIs HTTP
src/components     componentes de tela
src/server         regras de negócio, autenticação e portas de integração
src/lib            banco, formatação e erros
prisma             modelo relacional e dados de demonstração
```

A autenticação usa sessão em cookie HttpOnly. A senha fica com hash bcrypt e o token da sessão fica apenas como hash no banco.

A integração com ERP não está conectada. O contrato e as portas estão em `docs/integracao-erp.md`.
