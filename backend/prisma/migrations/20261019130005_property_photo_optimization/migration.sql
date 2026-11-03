-- AlterTable
ALTER TABLE "PropertyImage" ADD COLUMN "blurDataUrl" TEXT;
ALTER TABLE "PropertyImage" ADD COLUMN "bytes" INTEGER;
ALTER TABLE "PropertyImage" ADD COLUMN "checksum" TEXT;
ALTER TABLE "PropertyImage" ADD COLUMN "height" INTEGER;
ALTER TABLE "PropertyImage" ADD COLUMN "thumbUrl" TEXT;
ALTER TABLE "PropertyImage" ADD COLUMN "width" INTEGER;

-- CreateIndex
CREATE INDEX "PropertyImage_propertyId_checksum_idx" ON "PropertyImage"("propertyId", "checksum");
