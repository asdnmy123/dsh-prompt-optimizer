/**
 * dsh-prompt-optimizer — client half (web bundle).
 *
 * One compact control in the composer's tool row (`conversation.input.left`):
 *
 *   click → the draft in the input box is sent to this package's host half,
 *           forged into a hard-boiled prompt, and written straight back into
 *           the editor via the composer's own `inputActions.setDraft`.
 *
 * ## Bundle shape
 *
 * A DSH web client module in the shipped format: the manifest declares
 * `dsh.client = { platform: 'web', … }`, `exports['./client']` points here, and
 * the client module system loads it with
 * `window.__ModuleLoader__.load({ id, factory })`. `id` is the package name and
 * `factory(require)` resolves `react` / `react/jsx-runtime` from the shared
 * module table — no build step, no other dependency.
 *
 * ## Where the draft comes from
 *
 * The composer slot hands every entry its standard props; two of them are the
 * whole contract this button needs:
 *
 *   - `useInput(selector)` — snapshot hook over the session's `InputState`;
 *     `state.draft` is the live editor text.
 *   - `inputActions.setDraft(text)` — replace the whole draft (what the
 *     shipped code itself calls to restore a persisted draft).
 *
 * Nothing here reaches into the DOM or the editor instance: the button renders,
 * the composer owns the text.
 *
 * ## Failure posture
 *
 * Every path degrades to a visible, harmless state: no draft → the button is
 * disabled; a route error → a short red note with the host's reason; the host
 * itself answers `engine: 'local'` when no model route works, so the user still
 * gets a hardened prompt instead of an error.
 */

window.__ModuleLoader__.load({
  id: 'dsh-prompt-optimizer',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const react = require('react');
    const jsxRuntime = require('react/jsx-runtime');
    const jsx = jsxRuntime.jsx;
    const jsxs = jsxRuntime.jsxs;

    /** Locale namespace owned by this plugin. */
    const NS = 'prompt-optimizer';
    /** Host route the button talks to (same origin). */
    const ENDPOINT = '/dsh-prompt-optimizer/optimize';
    /** Registry id of this composer entry. */
    const ENTRY_ID = 'dsh-prompt-optimizer:hard-forge';
    /** Stylesheet identity, tagged like every shipped client bundle stylesheet. */
    const CSS_TAG = 'dsh-prompt-optimizer/HardForge.css';

    // ---------------------------------------------------------------------
    // Dictionaries
    // ---------------------------------------------------------------------
    /**
     * The one visible string on the button. Pinned verbatim — never translated,
     * never re-cased, never prefixed: the ♂ is part of the label.
     */
    const LABEL = '♂harden';
    const zh = {
      'button.idle': LABEL,
      'button.busy': LABEL,
      'button.done': LABEL,
      'button.error': LABEL,
      'button.title': '把输入框里的提示词锻造成硬邦邦的肌肉版（点一下就开干）',
      'button.titleBusy': '正在锻造，别催，马上给你硬的',
      'state.empty': '输入框是空的，先写点东西哥们',
      'state.inputTooLong': '太长了，超过上限，砍短点再来',
      'state.busy': '同时锻造的人太多，等两秒再点',
      'state.network': '连不上宿主，锻造炉没点着火',
      'state.badResponse': '宿主回了一句看不懂的话',
      'state.doneLlm': '已锻造 · 模型出手',
      'state.doneLocal': '已锻造 · 本地兜底',
      'state.aborted': '收工了，没锻',
    };
    const en = {
      'button.idle': LABEL,
      'button.busy': LABEL,
      'button.done': LABEL,
      'button.error': LABEL,
      'button.title': 'Forge the draft into a hard-boiled prompt (one click, go)',
      'button.titleBusy': 'Forging — hold on, it will come out hard',
      'state.empty': 'The input is empty — write something first, buddy',
      'state.inputTooLong': 'Too long for the forge; trim it and try again',
      'state.busy': 'Too many people forging right now — try again in a second',
      'state.network': 'Cannot reach the host — the forge did not light up',
      'state.badResponse': 'The host answered something unreadable',
      'state.doneLlm': 'Hardened · model strike',
      'state.doneLocal': 'Hardened · local fallback',
      'state.aborted': 'Stopped, nothing forged',
    };

    // ---------------------------------------------------------------------
    // Stylesheet — injected once, removed with the plugin.
    // ---------------------------------------------------------------------
    const CSS = [
      '.dshPo_root{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%}',
      // ---- the pill: frosted hot tint + a flowing masked gradient ring -----
      '.dshPo_btn{',
      '--dshPo-a:#ff6a00;--dshPo-b:#ff2d55;--dshPo-c:#a855f7;--dshPo-d:#ffc400;',
      '--dshPo-surface:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#1c1d21));',
      '--dshPo-tint:linear-gradient(135deg,rgba(255,106,0,.22),rgba(255,45,85,.15) 48%,rgba(168,85,247,.20));',
      '--dshPo-ring:linear-gradient(115deg,#ff6a00,#ff2d55 30%,#a855f7 62%,#ffc400 84%,#ff6a00);',
      'position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;',
      'height:calc(24px + var(--dsh-content-font-delta,0px));padding:0 11px;border-radius:999px;',
      'border:1px solid transparent;',
      'background-image:var(--dshPo-tint),linear-gradient(var(--dshPo-surface),var(--dshPo-surface)),var(--dshPo-ring);',
      'background-origin:padding-box,padding-box,border-box;',
      'background-clip:padding-box,padding-box,border-box;',
      'background-size:100% 100%,100% 100%,300% 100%;',
      'background-position:0% 50%,0% 50%,0% 50%;',
      'animation:dshPoFlow 5.5s linear infinite;',
      'font:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-weight:600;letter-spacing:.25px;line-height:1;',
      'color:var(--dsw-alias-label-primary,inherit);white-space:nowrap;cursor:pointer;user-select:none;',
      'box-shadow:0 0 0 1px rgba(255,106,0,.10),0 1px 3px rgba(0,0,0,.14),0 0 12px rgba(255,90,0,.14);',
      'transition:transform .14s ease,box-shadow .22s ease,filter .22s ease}',
      // The ring is the third background layer, clipped to the border box; the
      // opaque raised surface under the tint hides everything but that 1px ring.
      // Motion + focus + the states that keep the pill alive while disabled.
      '.dshPo_btn:hover:not(:disabled){transform:translateY(-1px);filter:saturate(1.18) brightness(1.06);',
      'box-shadow:0 0 0 1px rgba(255,106,0,.42),0 5px 18px rgba(255,45,85,.34),0 0 26px rgba(168,85,247,.26)}',
      '.dshPo_btn:active:not(:disabled){transform:translateY(0) scale(.972);transition-duration:.05s}',
      '.dshPo_btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#ff6a00);outline-offset:2px}',
      '.dshPo_btn:disabled{opacity:.55;cursor:not-allowed}',
      // The label is the whole mark; z-index keeps it above the gloss sweep.
      '.dshPo_label{position:relative;z-index:1;display:inline-block}',
      '@supports ((-webkit-background-clip:text) or (background-clip:text)){',
      '.dshPo_btn .dshPo_label{background-image:linear-gradient(100deg,#ff6a00,#ff2d55 34%,#a855f7 68%,#ffc400);',
      'background-size:220% 100%;background-position:0% 50%;-webkit-background-clip:text;background-clip:text;',
      '-webkit-text-fill-color:transparent;color:transparent;animation:dshPoTextFlow 4.2s linear infinite}}',
      // Gloss sweep: a skewed highlight, always on hover, relentless while busy.
      '.dshPo_shine{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none;z-index:0}',
      '.dshPo_shine::after{content:"";position:absolute;top:-20%;bottom:-20%;left:-60%;width:45%;transform:skewX(-18deg);',
      'background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);opacity:0;transition:opacity .18s ease}',
      '.dshPo_btn:hover:not(:disabled) .dshPo_shine::after{opacity:1;animation:dshPoSweep 1.5s ease-in-out infinite}',
      // busy: faster ring, pulsing halo, constant sweep, still on-brand.
      '.dshPo_btn[data-phase=busy]{opacity:1;cursor:progress;',
      '--dshPo-ring:linear-gradient(115deg,#ffb020,#ff3b30 28%,#ffd60a 58%,#ff8a00);',
      '--dshPo-tint:linear-gradient(135deg,rgba(255,176,32,.26),rgba(255,59,48,.18));',
      'animation:dshPoFlow 1.15s linear infinite,dshPoPulse 1.5s ease-in-out infinite}',
      '.dshPo_btn[data-phase=busy] .dshPo_shine::after{opacity:1;animation:dshPoSweep .95s linear infinite}',
      '.dshPo_btn[data-phase=busy] .dshPo_label{animation-duration:1.6s}',
      // done: teal-green ring, one happy pop, lasting glow.
      '.dshPo_btn[data-phase=done]{opacity:1;--dshPo-ring:linear-gradient(115deg,#12b76a,#7ee2b8 45%,#0fbf7f);',
      '--dshPo-tint:linear-gradient(135deg,rgba(18,183,106,.22),rgba(126,226,184,.15));',
      'animation:dshPoFlow 2.6s linear infinite,dshPoPop .5s cubic-bezier(.2,1.5,.4,1) 1;',
      'box-shadow:0 0 0 1px rgba(18,183,106,.40),0 3px 14px rgba(18,183,106,.34),0 0 22px rgba(18,183,106,.24)}',
      '.dshPo_btn[data-phase=done] .dshPo_label{background-image:linear-gradient(100deg,#0fbf7f,#12b76a 48%,#7ee2b8)}',
      // error: ember ring, one shake, no endless blinking.
      '.dshPo_btn[data-phase=error]{opacity:1;--dshPo-ring:linear-gradient(115deg,#f04438,#ff7a59 45%,#ffb020);',
      '--dshPo-tint:linear-gradient(135deg,rgba(240,68,56,.24),rgba(255,122,89,.15));',
      'animation:dshPoShake .42s ease-in-out 1;',
      'box-shadow:0 0 0 1px rgba(240,68,56,.44),0 3px 14px rgba(240,68,56,.34),0 0 22px rgba(240,68,56,.24)}',
      '.dshPo_btn[data-phase=error] .dshPo_label{background-image:linear-gradient(100deg,#f04438,#ff7a59 55%,#ffb020)}',
      // Motion.
      '@keyframes dshPoFlow{from{background-position:0% 50%,0% 50%,0% 50%}to{background-position:0% 50%,0% 50%,100% 50%}}',
      '@keyframes dshPoTextFlow{from{background-position:0% 50%}to{background-position:100% 50%}}',
      '@keyframes dshPoSweep{from{left:-60%}to{left:120%}}',
      '@keyframes dshPoPulse{0%,100%{box-shadow:0 0 0 1px rgba(255,140,0,.40),0 0 12px rgba(255,90,0,.28)}',
      '50%{box-shadow:0 0 0 1px rgba(255,196,0,.55),0 0 26px rgba(255,120,0,.50)}}',
      '@keyframes dshPoPop{0%{transform:scale(.90)}55%{transform:scale(1.07)}100%{transform:scale(1)}}',
      '@keyframes dshPoShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}',
      '60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}',
      // The transient one-line result note beside the pill.
      '.dshPo_note{font-size:var(--dsh-content-font-size-caption,12px);color:var(--dsw-alias-label-tertiary,inherit);',
      'max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dshPo_note[data-phase=error]{color:var(--dsw-alias-state-error-primary,#f04438)}',
      '.dshPo_visuallyHidden{clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}',
      // Accessibility gates: nothing moves for reduced motion, and forced-colors
      // gets a plain system pill instead of an unreadable gradient.
      '@media (prefers-reduced-motion:reduce){.dshPo_btn,.dshPo_btn .dshPo_label,.dshPo_shine::after',
      '{animation:none!important;transition:none!important}',
      '.dshPo_btn:hover:not(:disabled){transform:none}.dshPo_shine::after{opacity:0!important}}',
      '@media (forced-colors:active){.dshPo_btn{background:ButtonFace;border-color:ButtonBorder;color:ButtonText;',
      'box-shadow:none;animation:none}',
      '.dshPo_btn .dshPo_label{background-image:none;-webkit-text-fill-color:ButtonText;color:ButtonText}',
      '.dshPo_btn .dshPo_shine{display:none}}',
    ].join('');

    /**
     * No separate glyph: the visible mark *is* the label `♂harden`, so the
     * button carries exactly one string and no decorative extras.
     */

    // ---------------------------------------------------------------------
    // Helpers (exported for the offline tests)
    // ---------------------------------------------------------------------

    /** Plain-text reader for whatever a fetch answer or an unknown failure gives. */
    function textOf(value) {
      if (typeof value === 'string') return value;
      if (value !== null && typeof value === 'object' && typeof value.message === 'string') return value.message;
      return String(value);
    }

    /**
     * Map one host answer onto the button's result.
     *
     * @param response - parsed JSON body (may be anything).
     * @param status - HTTP status.
     * @returns `{ ok, text?, engine?, error? }` with a wire-safe shape.
     */
    function readResult(response, status) {
      if (response !== null && typeof response === 'object') {
        if (response.ok === true && typeof response.text === 'string' && response.text.trim() !== '') {
          return { ok: true, text: response.text, engine: response.engine === 'local' ? 'local' : 'llm' };
        }
        const error = response.error !== null && typeof response.error === 'object' ? response.error : null;
        if (error !== null) {
          return { ok: false, error: { code: typeof error.code === 'string' ? error.code : 'OPTIMIZE_FAILED', message: textOf(error.message) } };
        }
      }
      return { ok: false, error: { code: 'BAD_RESPONSE', message: 'HTTP ' + String(status) } };
    }

    /** Locale lookup with a per-key fallback so one missing key never blanks the UI. */
    function translator(t) {
      const dict = typeof navigator !== 'undefined' && typeof navigator.language === 'string' && navigator.language.toLowerCase().startsWith('zh') ? zh : en;
      return (key) => {
        if (typeof t === 'function') {
          try {
            const value = t(key);
            if (typeof value === 'string' && value !== '' && value !== key) return value;
          } catch {
            /* fall through to the local dictionary */
          }
        }
        return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : key;
      };
    }

    /** How long a transient result note stays on screen. */
    const NOTE_MS = { done: 2600, error: 6000 };

    // ---------------------------------------------------------------------
    // The button
    // ---------------------------------------------------------------------

    /**
     * Hook-owning body. Mounted only once the standard props exist, so the hook
     * count is stable for the lifetime of the entry.
     *
     * @param props - `useInput`, `inputActions`, and the locale translator `t`.
     */
    function HardForge({ useInput, inputActions, t }) {
      const translate = translator(t);
      const draft = useInput((state) =>
        state !== null && typeof state === 'object' && typeof state.draft === 'string' ? state.draft : '',
      );
      const [phase, setPhase] = react.useState('idle');
      const [note, setNote] = react.useState('');
      const abortRef = react.useRef(null);

      // Abandon one in-flight rewrite when the entry unmounts, and clear the
      // transient note timer so a settled state cannot be overwritten later.
      react.useEffect(() => {
        return () => {
          if (abortRef.current !== null) {
            try {
              abortRef.current.abort();
            } catch {
              /* already settled */
            }
            abortRef.current = null;
          }
        };
      }, []);

      react.useEffect(() => {
        if (phase !== 'done' && phase !== 'error') return undefined;
        const timer = setTimeout(() => {
          setPhase('idle');
          setNote('');
        }, phase === 'done' ? NOTE_MS.done : NOTE_MS.error);
        return () => clearTimeout(timer);
      }, [phase]);

      const empty = typeof draft !== 'string' || draft.trim() === '';
      const busy = phase === 'busy';

      const run = react.useCallback(async () => {
        const text = typeof draft === 'string' ? draft : '';
        if (text.trim() === '' || busy) return;
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        abortRef.current = controller;
        setPhase('busy');
        setNote('');
        try {
          const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text, locale: typeof navigator !== 'undefined' ? navigator.language : undefined }),
            signal: controller === null ? undefined : controller.signal,
          });
          let body = null;
          try {
            body = await response.json();
          } catch {
            body = null;
          }
          const result = readResult(body, response.status);
          if (result.ok) {
            inputActions.setDraft(result.text);
            setNote(translate(result.engine === 'local' ? 'state.doneLocal' : 'state.doneLlm'));
            setPhase('done');
          } else {
            const code = result.error.code;
            const mapped =
              code === 'EMPTY_INPUT'
                ? translate('state.empty')
                : code === 'INPUT_TOO_LONG'
                  ? translate('state.inputTooLong')
                  : code === 'BUSY'
                    ? translate('state.busy')
                    : result.error.message;
            setNote(mapped);
            setPhase('error');
          }
        } catch (error) {
          if (error !== null && typeof error === 'object' && error.name === 'AbortError') {
            setNote(translate('state.aborted'));
          } else {
            setNote(translate('state.network'));
          }
          setPhase('error');
        } finally {
          abortRef.current = null;
        }
      }, [draft, busy, inputActions, translate]);

      // The visible text is pinned in every state: `♂harden`, verbatim.
      const label = LABEL;
      const title = busy ? translate('button.titleBusy') : empty ? translate('state.empty') : translate('button.title');

      return jsxs('span', {
        className: 'dshPo_root',
        'data-dsh-prompt-optimizer': 'button',
        children: [
          jsxs('button', {
            type: 'button',
            className: 'dshPo_btn',
            'data-phase': phase,
            disabled: empty || busy,
            title,
            'aria-label': busy ? title : label + '：' + title,
            'aria-busy': busy ? 'true' : undefined,
            onClick: run,
            children: [jsx('span', { className: 'dshPo_shine', 'aria-hidden': 'true' }), jsx('span', { className: 'dshPo_label', children: label })],
          }),
          note === ''
            ? null
            : jsx('span', {
                className: 'dshPo_note',
                'data-phase': phase,
                title: note,
                children: note,
              }),
        ],
      });
    }

    /**
     * Slot entry. Degrades to nothing when the composer's standard props are
     * missing instead of throwing inside the shell's render tree.
     */
    function HardForgeEntry(props) {
      const p = props === null || props === undefined ? {} : props;
      if (typeof p.useInput !== 'function' || p.inputActions === null || p.inputActions === undefined || typeof p.inputActions.setDraft !== 'function') {
        return null;
      }
      return jsx(HardForge, { useInput: p.useInput, inputActions: p.inputActions, t: p.t });
    }

    // ---------------------------------------------------------------------
    // Plugin face
    // ---------------------------------------------------------------------

    /** Client services this half needs: the slot registry and the dictionary. */
    const inject = ['slots', 'locale'];

    /**
     * Insert the stylesheet once, tagged like every shipped client bundle. A
     * failure here costs looks, never the button: the entry renders unstyled
     * instead of throwing.
     */
    function ensureStyle() {
      if (typeof document === 'undefined' || document === null) return null;
      try {
        if (document.querySelector('style[data-plugin-css=' + JSON.stringify(CSS_TAG) + ']') !== null) return null;
        const tag = document.createElement('style');
        tag.dataset.plugin = 'dsh-prompt-optimizer';
        tag.dataset.pluginCss = CSS_TAG;
        tag.textContent = CSS;
        document.head.appendChild(tag);
        return tag;
      } catch (error) {
        console.warn('[dsh-prompt-optimizer] stylesheet injection failed; the button renders unstyled:', error);
        return null;
      }
    }

    /**
     * Client plugin body: stylesheet, dictionaries, and the one composer entry.
     *
     * @param ctx - client root context.
     */
    function apply(ctx) {
      try {
        if (ctx.effect !== undefined && typeof ctx.effect === 'function') {
          ctx.effect(() => {
            const tag = ensureStyle();
            return () => {
              try {
                if (tag !== null && tag.parentNode !== null) tag.parentNode.removeChild(tag);
              } catch {
                /* already detached */
              }
            };
          }, 'dsh-prompt-optimizer: stylesheet');
        } else {
          ensureStyle();
        }
      } catch (error) {
        console.warn('[dsh-prompt-optimizer] stylesheet setup failed; the button renders unstyled:', error);
      }
      try {
        if (
          ctx.locale !== undefined &&
          ctx.locale !== null &&
          typeof ctx.locale.register === 'function' &&
          typeof ctx.effect === 'function'
        ) {
          ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-prompt-optimizer: dictionaries');
        }
      } catch (error) {
        console.warn('[dsh-prompt-optimizer] dictionary registration failed; falling back to built-in text:', error);
      }
      try {
        if (ctx.slots === undefined || ctx.slots === null || typeof ctx.slots.register !== 'function') {
          console.warn('[dsh-prompt-optimizer] no slot registry; the composer button is not mounted');
          return;
        }
        const register = () =>
          ctx.slots.register(
            { name: 'conversation.input.left', id: ENTRY_ID, order: 30, locale: NS },
            HardForgeEntry,
          );
        if (typeof ctx.slots.inject === 'function') ctx.slots.inject('conversation.input.left', register);
        else register();
      } catch (error) {
        console.warn('[dsh-prompt-optimizer] composer entry registration failed:', error);
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    // Test hooks: the module system reads only apply/inject.
    exports.HardForge = HardForge;
    exports.HardForgeEntry = HardForgeEntry;
    exports.NS = NS;
    exports.ENDPOINT = ENDPOINT;
    exports.ENTRY_ID = ENTRY_ID;
    exports.CSS_TAG = CSS_TAG;
    exports.CSS = CSS;
    exports.zh = zh;
    exports.en = en;
    exports.LABEL = LABEL;
    exports.readResult = readResult;
    exports.translator = translator;
    return module.exports;
  },
});
