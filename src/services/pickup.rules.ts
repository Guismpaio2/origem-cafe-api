// Regras de retirada na loja (RN003): seg a sáb, das 08h às 18h, slots de 30 min,
// com antecedência mínima de 2 h. Horários são de Brasília (UTC-3).
// O Brasil não usa horário de verão desde 2019, então o deslocamento é fixo.

export const TZ_OFFSET_MINUTES = -180;

const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;
const SLOT_MINUTES = 30;
const MIN_ADVANCE_MINUTES = 120;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

// Converte um horário de Brasília (data + HH:MM) para o instante UTC equivalente.
export function localToUtc(date: string, hhmm: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - TZ_OFFSET_MINUTES * 60_000);
}

// 0 = domingo ... 6 = sábado, no calendário de Brasília.
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Lista os horários livres de um dia, já descontando a antecedência mínima a partir de "now".
export function slotsFor(date: string, now: Date): string[] {
  if (!isValidDate(date)) return [];
  if (weekdayOf(date) === 0) return []; // domingo: sem retirada

  const slots: string[] = [];
  for (let minutes = OPEN_HOUR * 60; minutes < CLOSE_HOUR * 60; minutes += SLOT_MINUTES) {
    const hhmm = formatMinutes(minutes);
    const start = localToUtc(date, hhmm);
    if (start.getTime() - now.getTime() >= MIN_ADVANCE_MINUTES * 60_000) {
      slots.push(hhmm);
    }
  }
  return slots;
}

export function isSlotAvailable(date: string, hhmm: string, now: Date): boolean {
  return slotsFor(date, now).includes(hhmm);
}
