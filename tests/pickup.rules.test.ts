import { describe, expect, it } from 'vitest';
import { isSlotAvailable, isValidDate, localToUtc, slotsFor, weekdayOf } from '../src/services/pickup.rules.js';

// 2030-01-07 é uma segunda-feira; 2030-01-06 é domingo.
const MONDAY = '2030-01-07';
const SUNDAY = '2030-01-06';
const FAR_AWAY = new Date('2029-12-01T00:00:00Z');

describe('regras de retirada (RN003)', () => {
  it('valida datas reais no formato AAAA-MM-DD', () => {
    expect(isValidDate('2026-11-16')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('16/11/2026')).toBe(false);
  });

  it('identifica o dia da semana no calendário de Brasília', () => {
    expect(weekdayOf(SUNDAY)).toBe(0);
    expect(weekdayOf(MONDAY)).toBe(1);
  });

  it('converte horário de Brasília para UTC (UTC-3)', () => {
    expect(localToUtc(MONDAY, '08:00').toISOString()).toBe('2030-01-07T11:00:00.000Z');
  });

  it('oferece 20 slots de 30 min, das 08:00 às 17:30, de segunda a sábado', () => {
    const slots = slotsFor(MONDAY, FAR_AWAY);
    expect(slots).toHaveLength(20);
    expect(slots[0]).toBe('08:00');
    expect(slots[slots.length - 1]).toBe('17:30');
  });

  it('não oferece retirada aos domingos', () => {
    expect(slotsFor(SUNDAY, FAR_AWAY)).toEqual([]);
  });

  it('exige 2 h de antecedência no próprio dia', () => {
    // Agora são 09:00 de Brasília: o primeiro horário possível é 11:00.
    const now = new Date('2030-01-07T12:00:00Z');
    const slots = slotsFor(MONDAY, now);
    expect(slots[0]).toBe('11:00');
    expect(isSlotAvailable(MONDAY, '10:30', now)).toBe(false);
    expect(isSlotAvailable(MONDAY, '11:00', now)).toBe(true);
  });

  it('rejeita horário fora do expediente', () => {
    expect(isSlotAvailable(MONDAY, '18:00', FAR_AWAY)).toBe(false);
    expect(isSlotAvailable(MONDAY, '07:30', FAR_AWAY)).toBe(false);
  });
});
