-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'RESERVE', 'RELEASE', 'RETURN');

-- CreateEnum
CREATE TYPE "ReplenishmentStatus" AS ENUM ('NEEDED', 'REQUESTED', 'IN_SUPPLY', 'REPLENISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('BOX', 'DRAWER', 'TRAY', 'SHELF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'IN_REPLENISHMENT');

-- CreateEnum
CREATE TYPE "BinRole" AS ENUM ('NONE', 'WORKING', 'TRIGGER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "barcode" TEXT,
    "publicToken" TEXT NOT NULL,
    "imageUrl" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "minStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "maxStock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reorderPoint" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reorderQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "defaultLocationId" TEXT,
    "supplierId" TEXT,
    "supplierCode" TEXT,
    "unitCost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastMovementAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Container" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ContainerType" NOT NULL,
    "description" TEXT,
    "locationId" TEXT NOT NULL,
    "capacity" DECIMAL(14,3),
    "publicToken" TEXT NOT NULL,
    "status" "ContainerStatus" NOT NULL DEFAULT 'ACTIVE',
    "pairGroup" TEXT,
    "binRole" "BinRole" NOT NULL DEFAULT 'NONE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "containerId" TEXT,
    "containerKey" TEXT NOT NULL,
    "onHand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "quantitySigned" DECIMAL(14,3) NOT NULL,
    "userId" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "fromContainerId" TEXT,
    "toContainerId" TEXT,
    "note" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentRequest" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "status" "ReplenishmentStatus" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "quantity" DECIMAL(14,3) NOT NULL,
    "availableAtOpen" DECIMAL(14,3) NOT NULL,
    "source" "RequestSource" NOT NULL,
    "requestedById" TEXT,
    "assigneeId" TEXT,
    "note" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ReplenishmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplenishmentEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fromStatus" "ReplenishmentStatus",
    "toStatus" "ReplenishmentStatus" NOT NULL,
    "userId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplenishmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Material_code_key" ON "Material"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Material_barcode_key" ON "Material"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Material_publicToken_key" ON "Material"("publicToken");

-- CreateIndex
CREATE INDEX "Material_name_idx" ON "Material"("name");

-- CreateIndex
CREATE INDEX "Material_categoryId_idx" ON "Material"("categoryId");

-- CreateIndex
CREATE INDEX "Material_active_idx" ON "Material"("active");

-- CreateIndex
CREATE UNIQUE INDEX "Container_code_key" ON "Container"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Container_publicToken_key" ON "Container"("publicToken");

-- CreateIndex
CREATE INDEX "Container_locationId_idx" ON "Container"("locationId");

-- CreateIndex
CREATE INDEX "Container_pairGroup_idx" ON "Container"("pairGroup");

-- CreateIndex
CREATE INDEX "StockBalance_materialId_idx" ON "StockBalance"("materialId");

-- CreateIndex
CREATE INDEX "StockBalance_locationId_idx" ON "StockBalance"("locationId");

-- CreateIndex
CREATE INDEX "StockBalance_containerId_idx" ON "StockBalance"("containerId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_materialId_locationId_containerKey_key" ON "StockBalance"("materialId", "locationId", "containerKey");

-- CreateIndex
CREATE UNIQUE INDEX "Movement_idempotencyKey_key" ON "Movement"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Movement_materialId_createdAt_idx" ON "Movement"("materialId", "createdAt");

-- CreateIndex
CREATE INDEX "Movement_createdAt_idx" ON "Movement"("createdAt");

-- CreateIndex
CREATE INDEX "Movement_userId_idx" ON "Movement"("userId");

-- CreateIndex
CREATE INDEX "Movement_type_idx" ON "Movement"("type");

-- CreateIndex
CREATE INDEX "ReplenishmentRequest_materialId_locationId_status_idx" ON "ReplenishmentRequest"("materialId", "locationId", "status");

-- CreateIndex
CREATE INDEX "ReplenishmentRequest_status_idx" ON "ReplenishmentRequest"("status");

-- CreateIndex
CREATE INDEX "ReplenishmentRequest_openedAt_idx" ON "ReplenishmentRequest"("openedAt");

-- CreateIndex
CREATE INDEX "ReplenishmentEvent_requestId_createdAt_idx" ON "ReplenishmentEvent"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_fromContainerId_fkey" FOREIGN KEY ("fromContainerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_toContainerId_fkey" FOREIGN KEY ("toContainerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRequest" ADD CONSTRAINT "ReplenishmentRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentEvent" ADD CONSTRAINT "ReplenishmentEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ReplenishmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentEvent" ADD CONSTRAINT "ReplenishmentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
