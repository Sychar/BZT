import { DateTime } from "luxon";

export const TIMEZONE = "Europe/Berlin";

const parseCutoff = (cutoffTime: string) => {
  const [hourStr, minuteStr] = cutoffTime.split(":");
  const hour = Number(hourStr ?? 0);
  const minute = Number(minuteStr ?? 0);
  return { hour, minute };
};

export const getCurrentBatchDate = (
  cutoffTime: string,
  now = DateTime.now().setZone(TIMEZONE)
) => {
  const { hour, minute } = parseCutoff(cutoffTime);
  const todayCutoff = now.set({ hour, minute, second: 0, millisecond: 0 });
  const effective = now < todayCutoff ? now.minus({ days: 1 }) : now;
  return effective.startOf("day");
};

export const getBatchWindowForDate = (
  batchDate: DateTime,
  cutoffTime: string
) => {
  const { hour, minute } = parseCutoff(cutoffTime);
  const end = batchDate.set({ hour, minute, second: 0, millisecond: 0 });
  const start = end.minus({ days: 1 });
  return { start, end };
};

export const toUtcDate = (dateTime: DateTime) => dateTime.toUTC().toJSDate();
