/* Wait until the page's finite CSS transitions and animations have finished before an axe audit. The app keeps short
   colour fades even under reduced motion (styles.js), and axe measuring a control halfway through its 100 ms fade
   reported a contrast failure that no person ever sees (flaky on main too, 2026-11-27). Infinite animations (spinners)
   are ignored; if something is still moving after 2 s the audit runs anyway, so a real problem is never hidden. */
export async function settled(page) {
  await page.waitForFunction(() => document.getAnimations().every((a) => {
    if (a.playState !== "running") return true;
    const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
    return !!t && t.iterations === Infinity;
  }), null, { timeout: 2000 }).catch(() => {});
}
