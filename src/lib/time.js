export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function getTimeZoneOffset(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [
      part.type,
      Number(part.value)
    ])
  );

  const representedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );
  return representedAsUtc - date.getTime();
}

export function zonedDateTimeToUtc(localDateTime, timeZone) {
  if (!isValidTimeZone(timeZone)) {
    throw new Error("Fuso horário inválido.");
  }

  const match = String(localDateTime).match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) throw new Error("Data e horário inválidos.");

  const [, year, month, day, hour, minute, second = "0"] = match;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );

  let result = localAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    result = localAsUtc - getTimeZoneOffset(new Date(result), timeZone);
  }
  return new Date(result);
}

export function toMysqlDate(date) {
  return new Date(date).toISOString().slice(0, 19).replace("T", " ");
}
