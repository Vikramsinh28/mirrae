import { createApi, WidgetApiError, type Api, type DoneStatus } from './api';
import { findCartButton, type CartButtonLike } from './cart';
import type { WidgetConfig } from './config';
import { directionOf, errorText, STRINGS, type Strings } from './i18n';
import { findProductImage } from './product-image';
import { shareImage } from './share';
import { BUTTON_CSS, MODAL_CSS } from './styles';

type Step = 'photo' | 'working' | 'result';
type PhotoState = 'none' | 'checking' | 'ready';
type ViewName = 'front' | 'side' | 'back';

interface State {
  step: Step;
  consent: boolean;
  photo: PhotoState;
  previewUrl: string | null;
  photoKey: string | null;
  error: string | null;
  result: DoneStatus | null;
  view: ViewName;
}

const INITIAL_STATE: State = {
  step: 'photo',
  consent: false,
  photo: 'none',
  previewUrl: null,
  photoKey: null,
  error: null,
  result: null,
  view: 'front',
};

// Set one property at a time: replacing the whole style attribute would wipe the host's --mirrae-color.
const FLOATING_STYLE: Record<string, string> = {
  position: 'fixed',
  bottom: '20px',
  'inset-inline-end': '20px',
  'z-index': '2147483000',
};

type Child = Node | string | null | false | undefined;

/** Builds an element. Text always goes in as text, never as HTML, so nothing from the page can inject markup. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string | boolean | ((event: Event) => void)>> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (typeof value === 'function') node.addEventListener(name.slice(2), value);
    else if (value === true) node.setAttribute(name, '');
    else if (value !== false) node.setAttribute(name, String(value));
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

function shadowHost(css: string, color: string): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('div');
  host.style.setProperty('--mirrae-color', color);
  const root = host.attachShadow({ mode: 'open' });
  root.append(el('style', {}, css));
  return { host, root };
}

function emit(name: string, detail: unknown) {
  window.dispatchEvent(new CustomEvent(`mirrae:${name}`, { detail }));
}

export function mountWidget(config: WidgetConfig): { open: () => void } {
  const strings: Strings = STRINGS[config.locale];
  const dir = directionOf(config.locale);
  const api: Api = createApi({ apiBase: config.apiBase, publicKey: config.publicKey });

  let state: State = INITIAL_STATE;
  let modal: { host: HTMLElement; root: ShadowRoot; body: HTMLElement; dialog: HTMLElement; dispose: () => void } | null = null;
  let opener: Element | null = null;
  let controller: AbortController | null = null;
  let uploadToken = 0;

  const setState = (patch: Partial<State>) => {
    state = { ...state, ...patch };
    render();
  };

  const messageFor = (error: unknown): string => {
    const known = error instanceof WidgetApiError ? error : new WidgetApiError('GENERIC');
    emit('error', { code: known.code });
    return errorText(strings, { code: known.code, problem: known.problem, retryAfterMs: known.retryAfterMs });
  };

  function revokePreview() {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  }

  async function handleFile(file: File) {
    const token = ++uploadToken;
    revokePreview();
    setState({ photo: 'checking', previewUrl: URL.createObjectURL(file), photoKey: null, error: null });
    try {
      const { photoKey } = await api.uploadPhoto(file);
      if (token === uploadToken) setState({ photo: 'ready', photoKey });
    } catch (error) {
      if (token !== uploadToken) return;
      revokePreview();
      setState({ photo: 'none', previewUrl: null, photoKey: null, error: messageFor(error) });
    }
  }

  async function start() {
    if (!state.consent || state.photo !== 'ready' || !state.photoKey) return;

    const productImageUrl = findProductImage(document, location.href, config.productImage);
    if (!productImageUrl) {
      setState({ error: strings.errors.INVALID_PRODUCT_IMAGE });
      return;
    }

    controller = new AbortController();
    setState({ step: 'working', error: null });
    try {
      const { jobId } = await api.startTryOn({ photoKey: state.photoKey, productImageUrl, views: config.views });
      const final = await api.waitForResult(jobId, {
        signal: controller.signal,
        onUpdate: progress => {
          if (progress.status !== 'done') return;
          if (state.step !== 'result') void api.sendEvent('RESULT_VIEWED');
          setState({ step: 'result', result: progress });
        },
      });
      setState({ step: 'result', result: final });
      emit('result', { frontUrl: final.resultUrl, sideUrl: final.sideUrl, backUrl: final.backUrl });
    } catch (error) {
      if (error instanceof WidgetApiError && error.code === 'ABORTED') return;
      // Front view already on screen: keep it, just stop waiting for the extra views.
      if (state.step === 'result') return;
      const photoUsedUp = error instanceof WidgetApiError && ['JOB_FAILED', 'TIMEOUT'].includes(error.code);
      if (photoUsedUp) revokePreview();
      setState({
        step: 'photo',
        error: messageFor(error),
        ...(photoUsedUp ? { photo: 'none' as const, previewUrl: null, photoKey: null } : {}),
      });
    }
  }

  function closeModal() {
    controller?.abort();
    uploadToken++;
    revokePreview();
    modal?.dispose();
    modal?.host.remove();
    modal = null;
    state = INITIAL_STATE;
    if (opener instanceof HTMLElement) opener.focus();
  }

  function addToCart(button: CartButtonLike) {
    emit('add-to-cart', {});
    void api.sendEvent('ADD_TO_CART');
    closeModal();
    // Close first: the store may open its own cart drawer, which the overlay must not cover.
    button.click();
  }

  async function saveCurrent(url: string, view: ViewName) {
    const outcome = await shareImage(url);
    emit('share', { view, outcome });
    if (outcome === 'shared' || outcome === 'downloaded') void api.sendEvent('SHARED');
  }

  function photoStep(): Child[] {
    const fileInput = el('input', {
      type: 'file',
      accept: 'image/*',
      hidden: true,
      onchange: event => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) void handleFile(file);
      },
    });
    const canGo = state.consent && state.photo === 'ready';

    return [
      el('p', { class: 'tips' }, strings.tips),
      el(
        'div',
        { class: 'drop' },
        state.previewUrl ? el('img', { src: state.previewUrl, alt: '' }) : null,
        state.photo === 'checking'
          ? el('div', { class: 'over', role: 'status' }, el('div', { class: 'spin' }), strings.checkingPhoto)
          : null,
        state.photo === 'none' ? el('div', {}, el('button', { type: 'button', class: 'pick', onclick: () => fileInput.click() }, strings.choosePhoto)) : null
      ),
      fileInput,
      state.photo === 'ready'
        ? el(
            'div',
            {},
            el('div', { class: 'ok', role: 'status' }, `✓ ${strings.photoReady}`),
            el('button', { type: 'button', class: 'pick', onclick: () => fileInput.click() }, strings.changePhoto)
          )
        : null,
      el(
        'label',
        { class: 'consent' },
        el('input', { type: 'checkbox', checked: state.consent, onchange: event => setState({ consent: (event.target as HTMLInputElement).checked, error: null }) }),
        el('span', {}, strings.consent)
      ),
      state.error ? el('p', { class: 'error', role: 'alert' }, state.error) : null,
      el('button', { type: 'button', class: 'go', 'aria-disabled': String(!canGo), onclick: () => (canGo ? void start() : setState({ error: state.consent ? null : strings.errors.CONSENT_REQUIRED })) }, strings.tryIt),
    ];
  }

  function workingStep(): Child[] {
    return [el('div', { class: 'working', role: 'status' }, el('div', { class: 'spin' }), strings.working)];
  }

  function resultStep(): Child[] {
    const { result } = state;
    if (!result) return [];
    const multi = result.viewCount > 1;
    const views: { name: ViewName; label: string; url?: string }[] = [
      { name: 'front', label: strings.front, url: result.resultUrl },
      { name: 'side', label: strings.side, url: result.sideUrl },
      { name: 'back', label: strings.back, url: result.backUrl },
    ];
    // A view that never arrived is hidden once nothing more is pending.
    const shown = views.filter(view => view.name === 'front' || (multi && (view.url || result.extrasPending)));
    const current = shown.find(view => view.name === state.view && view.url) ?? shown[0];
    // Looked up when the result appears so a product with no usable button simply gets no cart action.
    const cartButton = findCartButton(document, config.cartButton);

    return [
      el('div', { class: 'stage' }, el('img', { src: current.url ?? '', alt: `${strings.title}: ${current.label}` })),
      shown.length > 1
        ? el(
            'div',
            { class: 'thumbs', role: 'group' },
            ...shown.map(view =>
              el(
                'button',
                { type: 'button', class: 'thumb', 'aria-pressed': String(view.name === current.name), disabled: !view.url, onclick: () => setState({ view: view.name }) },
                view.url ? el('img', { src: view.url, alt: '' }) : el('span', { class: 'wait' }, el('span', { class: 'spin' })),
                el('span', { class: 'cap' }, view.label)
              )
            )
          )
        : null,
      result.extrasPending ? el('p', { class: 'note', role: 'status' }, strings.sideBackLoading) : null,
      el('p', { class: 'fine' }, strings.disclaimer),
      cartButton
        ? el('button', { type: 'button', class: 'go', onclick: () => addToCart(cartButton) }, strings.addToCart)
        : null,
      el(
        'div',
        { class: 'row' },
        el('button', { type: 'button', class: 'ghost', onclick: () => void saveCurrent(current.url ?? result.resultUrl, current.name) }, strings.saveImage),
        el('button', { type: 'button', class: 'ghost', onclick: () => { revokePreview(); setState({ ...INITIAL_STATE, consent: state.consent }); } }, strings.tryAnother)
      ),
    ];
  }

  function render() {
    if (!modal) return;
    const steps: Record<Step, () => Child[]> = { photo: photoStep, working: workingStep, result: resultStep };
    modal.body.replaceChildren(...steps[state.step]().filter((child): child is Node | string => Boolean(child)));
  }

  function trapFocus(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeModal();
      return;
    }
    if (event.key !== 'Tab' || !modal) return;
    const focusable = Array.from(modal.root.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([hidden]), [href]'));
    if (focusable.length === 0) return;
    const active = modal.root.activeElement;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open() {
    if (modal) return;
    opener = document.activeElement;
    const { host, root } = shadowHost(MODAL_CSS, config.color);
    const body = el('div', {});
    const dialog = el(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mirrae-title', dir },
      el('div', { class: 'head' }, el('h2', { class: 'title', id: 'mirrae-title' }, strings.title), el('button', { type: 'button', class: 'x', 'aria-label': strings.close, onclick: closeModal }, '×')),
      body
    );
    const overlay = el('div', { class: 'overlay', onmousedown: event => { if (event.target === overlay) closeModal(); } }, dialog);
    root.append(overlay);
    root.addEventListener('keydown', event => trapFocus(event as KeyboardEvent));
    document.body.append(host);

    // A page that overflows sideways makes the layout viewport wider than the screen, which would push a
    // fixed overlay partly off-screen: size the overlay to what the shopper can actually see.
    const viewport = window.visualViewport;
    const fitToScreen = () => {
      if (!viewport) return;
      overlay.style.inset = 'auto';
      overlay.style.left = `${viewport.offsetLeft}px`;
      overlay.style.top = `${viewport.offsetTop}px`;
      overlay.style.width = `${viewport.width}px`;
      overlay.style.height = `${viewport.height}px`;
    };
    fitToScreen();
    viewport?.addEventListener('resize', fitToScreen);
    viewport?.addEventListener('scroll', fitToScreen);
    const dispose = () => {
      viewport?.removeEventListener('resize', fitToScreen);
      viewport?.removeEventListener('scroll', fitToScreen);
    };

    modal = { host, root, body, dialog, dispose };
    state = INITIAL_STATE;
    render();
    root.querySelector<HTMLElement>('.pick, .x')?.focus();
    emit('open', {});
    void api.sendEvent('WIDGET_OPENED');
  }

  // The launcher button
  const { host: buttonHost, root: buttonRoot } = shadowHost(BUTTON_CSS, config.color);
  buttonRoot.append(el('button', { type: 'button', class: 'btn', onclick: open }, config.label ?? strings.buttonLabel));

  const target = config.target ? document.querySelector(config.target) : null;
  if (target) {
    target.append(buttonHost);
  } else {
    Object.entries(FLOATING_STYLE).forEach(([property, value]) => buttonHost.style.setProperty(property, value));
    document.body.append(buttonHost);
  }

  return { open };
}
