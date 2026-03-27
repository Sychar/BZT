-- DropForeignKey
ALTER TABLE "CompanyInvite" DROP CONSTRAINT "CompanyInvite_companyId_fkey";

-- DropForeignKey
ALTER TABLE "DailyBatch" DROP CONSTRAINT "DailyBatch_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "DailyBatchItem" DROP CONSTRAINT "DailyBatchItem_batchId_fkey";

-- DropForeignKey
ALTER TABLE "DailyBatchOrder" DROP CONSTRAINT "DailyBatchOrder_batchId_fkey";

-- DropForeignKey
ALTER TABLE "DailyBatchOrder" DROP CONSTRAINT "DailyBatchOrder_orderId_fkey";

-- DropForeignKey
ALTER TABLE "DailyMenu" DROP CONSTRAINT "DailyMenu_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "DailyMenuItem" DROP CONSTRAINT "DailyMenuItem_menuId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "RestaurantOrderItem" DROP CONSTRAINT "RestaurantOrderItem_orderId_fkey";

-- DropForeignKey
ALTER TABLE "VendorCompany" DROP CONSTRAINT "VendorCompany_companyId_fkey";

-- DropForeignKey
ALTER TABLE "VendorCompany" DROP CONSTRAINT "VendorCompany_vendorId_fkey";

-- DropIndex
DROP INDEX "CompanyInvite_companyId_idx";

-- AddForeignKey
ALTER TABLE "CompanyInvite" ADD CONSTRAINT "CompanyInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCompany" ADD CONSTRAINT "VendorCompany_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorCompany" ADD CONSTRAINT "VendorCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyBatch" ADD CONSTRAINT "DailyBatch_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyBatchItem" ADD CONSTRAINT "DailyBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DailyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyBatchOrder" ADD CONSTRAINT "DailyBatchOrder_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DailyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyBatchOrder" ADD CONSTRAINT "DailyBatchOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMenu" ADD CONSTRAINT "DailyMenu_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMenuItem" ADD CONSTRAINT "DailyMenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "DailyMenu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
