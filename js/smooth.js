// Lenis smooth wheel scrolling for the static inner pages, with the settings of src/scroll.js and js/fx.js.
// Mouse and trackpad visitors only: phones, tablets and prefers-reduced-motion keep native scrolling and
// never download Lenis (it is a separate chunk, imported only here). These pages have no GSAP, so Lenis
// runs its own frame loop (autoRaf).
const root = document.documentElement;
if (root.dataset.smooth !== 'off' && matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  Promise.all([import('lenis'), import('lenis/dist/lenis.css')]).then(([{ default: Lenis }]) => {
    // lerp 0.15: a wheel notch settles in ~0.6 s
    const lenis = new Lenis({ lerp: 0.15, anchors: true, allowNestedScroll: true, stopInertiaOnNavigate: true, autoRaf: true });
    // keyboard, scrollbar drags and find-in-page take over from a glide at once
    const handOff = () => { if (lenis.isScrolling === 'smooth') { lenis.stop(); lenis.start(); } };
    addEventListener('keydown', handOff, { passive: true });
    addEventListener('pointerdown', handOff, { passive: true });
    window.lenis = lenis; // QA: wait for !window.lenis.isScrolling after a wheel
  });
}
