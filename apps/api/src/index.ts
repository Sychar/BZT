import app from "./app";
import { env } from "./utils/env";
import { startDailyBatchCron } from "./services/cron";

const port = Number(env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

if (env.CRON_ENABLED !== "false") {
  startDailyBatchCron();
}
