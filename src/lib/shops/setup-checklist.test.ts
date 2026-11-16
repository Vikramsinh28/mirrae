import { buildChecklist } from './setup-checklist';

const SHOP = { id: 'shop-1' };
const none = { testedTryOn: false, installed: false, shopperTryOn: false };

const stepOf = (steps: ReturnType<typeof buildChecklist>['steps'], id: string) => steps.find(step => step.id === id);

describe('buildChecklist', () => {
  test('a new merchant starts at "add your shop" with nothing done', () => {
    const { steps, doneCount, next } = buildChecklist([], none);

    expect(steps.map(step => step.id)).toEqual(['shop', 'test', 'install', 'shopper']);
    expect(doneCount).toBe(0);
    expect(next?.id).toBe('shop');
    expect(stepOf(steps, 'shop')?.href).toBe('/app/shops');
  });

  test('points the install steps at the first shop once there is one', () => {
    const { steps, next } = buildChecklist([SHOP], none);

    expect(stepOf(steps, 'shop')?.done).toBe(true);
    expect(stepOf(steps, 'install')?.href).toBe('/app/shops/shop-1');
    expect(next?.id).toBe('test');
  });

  test('the next step is the first one not done, even if a later one is', () => {
    const { next, doneCount } = buildChecklist([SHOP], { testedTryOn: false, installed: true, shopperTryOn: false });

    expect(next?.id).toBe('test');
    expect(doneCount).toBe(2);
  });

  test('is complete, with no next step, when every step is done', () => {
    const { complete, next, doneCount, total } = buildChecklist([SHOP], { testedTryOn: true, installed: true, shopperTryOn: true });

    expect(complete).toBe(true);
    expect(next).toBeNull();
    expect(doneCount).toBe(total);
  });

  test('treats missing setup facts (still loading) as not done rather than guessing', () => {
    const { steps } = buildChecklist([SHOP], undefined);

    expect(steps.filter(step => step.done).map(step => step.id)).toEqual(['shop']);
  });
});
