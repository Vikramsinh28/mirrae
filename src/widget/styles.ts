/** All widget CSS lives inside shadow roots, so the store's theme can neither break it nor be broken by it. */

export const BUTTON_CSS = `
:host { all: initial; }
.btn {
  all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;
  padding: 12px 20px; border-radius: 999px; background: var(--mirrae-color); color: #fff;
  font: 600 14px/1.2 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; letter-spacing: .01em;
  box-shadow: 0 2px 10px rgba(0, 0, 0, .18); transition: transform .15s ease, box-shadow .15s ease;
}
.btn:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0, 0, 0, .22); }
.btn:focus-visible { outline: 3px solid #fff; outline-offset: -6px; box-shadow: 0 0 0 3px var(--mirrae-color); }
@media (prefers-reduced-motion: reduce) { .btn { transition: none; } .btn:hover { transform: none; } }
`;

export const MODAL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.overlay {
  position: fixed; inset: 0; z-index: 2147483600; background: rgba(0, 0, 0, .55);
  display: flex; align-items: center; justify-content: center; padding: 16px;
  font: 400 14px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a;
}
.dialog {
  position: relative; width: min(440px, 100%); max-height: calc(100dvh - 32px); overflow: auto;
  background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 20px 60px rgba(0, 0, 0, .35);
}
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.title { margin: 0; font-size: 17px; font-weight: 700; }
.x {
  all: unset; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
  font-size: 20px; line-height: 1; color: #555;
}
.x:hover { background: #f0f0f0; }
.x:focus-visible, .link:focus-visible, .thumb:focus-visible, .pick:focus-visible, .go:focus-visible, .ghost:focus-visible {
  outline: 3px solid var(--mirrae-color); outline-offset: 2px;
}
.tips { margin: 0 0 14px; color: #555; }
.consent { display: flex; gap: 10px; align-items: flex-start; margin: 14px 0; font-size: 13px; color: #333; cursor: pointer; }
.consent input { margin-top: 2px; width: 18px; height: 18px; accent-color: var(--mirrae-color); flex: none; }
.drop {
  display: grid; place-items: center; text-align: center; min-height: 180px; border: 2px dashed #cfcfcf; border-radius: 12px;
  padding: 12px; background: #fafafa; position: relative; overflow: hidden;
}
.drop img { max-width: 100%; max-height: 260px; border-radius: 8px; display: block; }
.drop .over {
  position: absolute; inset: 0; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, .85); font-weight: 600;
}
.pick, .go, .ghost {
  all: unset; box-sizing: border-box; cursor: pointer; text-align: center; border-radius: 999px; padding: 12px 20px;
  font: 600 14px/1.2 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}
.pick { background: #fff; border: 1.5px solid var(--mirrae-color); color: var(--mirrae-color); display: inline-block; margin-top: 8px; }
.go { background: var(--mirrae-color); color: #fff; width: 100%; margin-top: 16px; display: block; }
.go[aria-disabled='true'] { opacity: .4; cursor: not-allowed; }
.ghost { background: #f1f1f1; color: #222; flex: 1; }
.ok { color: #12703a; font-weight: 600; margin-top: 8px; }
.error {
  margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; background: #fdecec; color: #8a1c1c; font-size: 13px;
}
.spin {
  width: 28px; height: 28px; border-radius: 50%; border: 3px solid #ddd; border-top-color: var(--mirrae-color);
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation-duration: 2.4s; } }
.working { display: grid; place-items: center; gap: 14px; padding: 40px 8px; text-align: center; color: #333; }
.stage {
  position: relative; height: min(50dvh, 480px); aspect-ratio: 3 / 4; max-width: 100%; margin: 0 auto;
  background: #f3f3f3; border-radius: 12px; overflow: hidden;
}
.stage img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.thumbs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: min(100%, 330px); margin: 10px auto 0; }
.thumb {
  all: unset; box-sizing: border-box; position: relative; cursor: pointer; aspect-ratio: 3 / 4; border-radius: 10px; overflow: hidden;
  background: #f3f3f3; border: 2px solid transparent; display: block;
}
.thumb[aria-pressed='true'] { border-color: var(--mirrae-color); }
.thumb[disabled] { cursor: wait; }
.thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.thumb .cap {
  position: absolute; inset-inline: 0; bottom: 0; padding: 3px 0; text-align: center; font-size: 12px; font-weight: 600;
  background: rgba(255, 255, 255, .88);
}
.thumb .wait { position: absolute; inset: 0; display: grid; place-items: center; }
.note { margin: 10px 0 0; color: #555; font-size: 13px; }
.fine { margin: 10px 0 0; color: #777; font-size: 12px; }
.row { display: flex; gap: 8px; margin-top: 14px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 600px) {
  .overlay { padding: 0; align-items: flex-end; }
  .dialog { width: 100%; max-height: 100dvh; border-radius: 16px 16px 0 0; padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
}
`;
