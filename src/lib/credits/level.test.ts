import { creditLevel, LOW_CREDIT_THRESHOLD } from './level';

describe('creditLevel', () => {
  test.each([0, 0.5, 0.99])('%p credits cannot pay for even one front view, so try-ons are out', credits => {
    expect(creditLevel(credits)).toBe('empty');
  });

  test.each([1, 5, LOW_CREDIT_THRESHOLD - 0.5])('%p credits is low: it still works but will run out soon', credits => {
    expect(creditLevel(credits)).toBe('low');
  });

  test.each([LOW_CREDIT_THRESHOLD, 50, 1000])('%p credits is fine', credits => {
    expect(creditLevel(credits)).toBe('ok');
  });

  test('says nothing until the balance is known, so a loading page never flashes a warning', () => {
    expect(creditLevel(undefined)).toBe('ok');
  });
});
