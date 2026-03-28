import app from "./app";
import { env } from "./utils/env";
import { startDailyBatchCron } from "./services/cron";

const port = Number(env.PORT ?? 4000);
const host = "0.0.0.0";

app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});

if (env.CRON_ENABLED !== "false") {
  startDailyBatchCron();
}
