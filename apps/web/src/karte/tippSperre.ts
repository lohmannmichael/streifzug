/**
 * A tap that skips the replay must not also choose the area under the finger (found by the browser
 * tests, 25.11.2026). The replay blocks map taps until shortly after the finger is lifted.
 */
let gesperrtBis = 0;
export const tippSperren = (ms = 700) => {
  gesperrtBis = Date.now() + ms;
};
export const tippGesperrt = () => Date.now() < gesperrtBis;
