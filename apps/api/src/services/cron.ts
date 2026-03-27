import cron from "node-cron";
import { DateTime } from "luxon";
import { TIMEZONE } from "../utils/time";
import { createDailyBatchesForAllVendors } from "./batchService";

export const startDailyBatchCron = () => {
  cron.schedule(
    "0 4 * * *",
    async () => {
      try {
        const now = DateTime.now().setZone(TIMEZONE);
        await createDailyBatchesForAllVendors(now);
        console.log(`[cron] Daily batches created: ${now.toISO()}`);
      } catch (error) {
        console.error("[cron] Failed to create daily batches", error);
      }
    },
    { timezone: TIMEZONE }
  );
};
