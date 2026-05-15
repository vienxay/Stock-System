-- CreateTable
CREATE TABLE "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "company_name" VARCHAR(200) NOT NULL DEFAULT 'ບໍລິສັດ',
    "company_name_en" VARCHAR(200),
    "logo_url" VARCHAR(500),
    "phone" VARCHAR(50),
    "email" VARCHAR(100),
    "address" TEXT,
    "tax_id" VARCHAR(50),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);
