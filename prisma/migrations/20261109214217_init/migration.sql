-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('Processing', 'Completed', 'Failed');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "classification_system" TEXT NOT NULL DEFAULT 'eBKP-H',
    "calculation_area_type" TEXT,
    "calculation_area_value" DOUBLE PRECISION,
    "calculation_area_unit" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'Processing',
    "error" TEXT,
    "element_count" INTEGER NOT NULL DEFAULT 0,
    "material_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elements" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "upload_id" TEXT,
    "guid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "load_bearing" BOOLEAN NOT NULL DEFAULT false,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "classification_system" TEXT,
    "classification_code" TEXT,
    "classification_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "element_materials" (
    "id" TEXT NOT NULL,
    "element_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "fraction" DOUBLE PRECISION,

    CONSTRAINT "element_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "density" DOUBLE PRECISION,
    "kbob_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kbob_materials" (
    "id" TEXT NOT NULL,
    "name_de" TEXT NOT NULL,
    "name_fr" TEXT,
    "group" TEXT,
    "unit" TEXT,
    "density" DOUBLE PRECISION,
    "gwp_total" DOUBLE PRECISION,
    "ubp21_total" DOUBLE PRECISION,
    "penre_total" DOUBLE PRECISION,
    "version" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kbob_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_deletions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "material_name" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_deletions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_user_id_updated_at_idx" ON "projects"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "uploads_project_id_created_at_idx" ON "uploads"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "elements_upload_id_idx" ON "elements"("upload_id");

-- CreateIndex
CREATE UNIQUE INDEX "elements_project_id_guid_key" ON "elements"("project_id", "guid");

-- CreateIndex
CREATE INDEX "element_materials_element_id_idx" ON "element_materials"("element_id");

-- CreateIndex
CREATE INDEX "element_materials_material_id_idx" ON "element_materials"("material_id");

-- CreateIndex
CREATE INDEX "materials_kbob_id_idx" ON "materials"("kbob_id");

-- CreateIndex
CREATE UNIQUE INDEX "materials_project_id_name_key" ON "materials"("project_id", "name");

-- CreateIndex
CREATE INDEX "kbob_materials_name_de_idx" ON "kbob_materials"("name_de");

-- CreateIndex
CREATE INDEX "material_deletions_project_id_created_at_idx" ON "material_deletions"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elements" ADD CONSTRAINT "elements_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_materials" ADD CONSTRAINT "element_materials_element_id_fkey" FOREIGN KEY ("element_id") REFERENCES "elements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "element_materials" ADD CONSTRAINT "element_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_kbob_id_fkey" FOREIGN KEY ("kbob_id") REFERENCES "kbob_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_deletions" ADD CONSTRAINT "material_deletions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
