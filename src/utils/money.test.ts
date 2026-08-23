import { addMoney, calculateGst, mulMoney, round2, subMoney, toFormattedString } from './money';

describe('Financial Money Utilities (Decimal.js)', () => {
  it('should accurately round currency to 2 decimal places', () => {
    expect(toFormattedString(round2('10.456'))).toBe('10.46');
    expect(toFormattedString(round2('10.454'))).toBe('10.45');
    expect(toFormattedString(round2('10.455'))).toBe('10.46');
  });

  it('should add money without floating point errors', () => {
    expect(toFormattedString(addMoney(0.1, 0.2))).toBe('0.30');
    expect(toFormattedString(addMoney('100.50', '200.75'))).toBe('301.25');
  });

  it('should subtract money accurately', () => {
    expect(toFormattedString(subMoney('500.00', '125.50'))).toBe('374.50');
  });

  it('should multiply money and prices accurately', () => {
    expect(toFormattedString(mulMoney('15.50', 3))).toBe('46.50');
  });

  it('should compute GST correctly at line item level', () => {
    const { gstAmount, netAmount } = calculateGst('100.00', '18.00');
    expect(toFormattedString(gstAmount)).toBe('18.00');
    expect(toFormattedString(netAmount)).toBe('118.00');
  });
});
