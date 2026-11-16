/** The merchant's getting-started steps, worked out from their shops and a few facts from the server. */

export interface SetupFacts {
  testedTryOn: boolean;
  installed: boolean;
  shopperTryOn: boolean;
}

export type SetupStepId = 'shop' | 'test' | 'install' | 'shopper';

export interface SetupStep {
  id: SetupStepId;
  label: string;
  hint: string;
  done: boolean;
  href: string;
  action: string;
}

export interface Checklist {
  steps: SetupStep[];
  doneCount: number;
  total: number;
  /** The first step still to do (the one to highlight), or null when everything is done. */
  next: SetupStep | null;
  complete: boolean;
}

export function buildChecklist(shops: readonly { id: string }[], facts: SetupFacts | undefined): Checklist {
  const shopPage = shops[0] ? `/app/shops/${shops[0].id}` : '/app/shops';

  const steps: SetupStep[] = [
    {
      id: 'shop',
      label: 'Add your shop',
      hint: 'Tell us your website so only your site can use the button.',
      done: shops.length > 0,
      href: '/app/shops',
      action: 'Add shop',
    },
    {
      id: 'test',
      label: 'Try it on your own product',
      hint: 'See exactly what your shoppers will get, before anything goes live.',
      done: facts?.testedTryOn ?? false,
      href: '/app/try',
      action: 'Try it',
    },
    {
      id: 'install',
      label: 'Put the code on your website',
      hint: 'Paste one line. This turns green when a shopper first uses the button.',
      done: facts?.installed ?? false,
      href: shopPage,
      action: 'Get the code',
    },
    {
      id: 'shopper',
      label: 'Get your first shopper try-on',
      hint: 'Open a product page on your site and try it yourself.',
      done: facts?.shopperTryOn ?? false,
      href: shopPage,
      action: 'See how',
    },
  ];

  const doneCount = steps.filter(step => step.done).length;
  return { steps, doneCount, total: steps.length, next: steps.find(step => !step.done) ?? null, complete: doneCount === steps.length };
}
