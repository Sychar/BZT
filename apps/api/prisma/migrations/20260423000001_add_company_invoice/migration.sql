CREATE TABLE "CompanyInvoice" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "periodMonth" TIMESTAMP(3) NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "vendorNameSnapshot" TEXT NOT NULL,
    "companyNameSnapshot" TEXT NOT NULL,
    "employeeBreakdown" JSONB NOT NULL,
    "ordersCount" INTEGER NOT NULL,
    "positionsCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "pdfPath" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyInvoice_vendorId_companyId_periodMonth_key" ON "CompanyInvoice"("vendorId", "companyId", "periodMonth");
CREATE INDEX "CompanyInvoice_vendorId_periodMonth_idx" ON "CompanyInvoice"("vendorId", "periodMonth");
CREATE INDEX "CompanyInvoice_companyId_periodMonth_idx" ON "CompanyInvoice"("companyId", "periodMonth");

ALTER TABLE "CompanyInvoice" ADD CONSTRAINT "CompanyInvoice_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyInvoice" ADD CONSTRAINT "CompanyInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
