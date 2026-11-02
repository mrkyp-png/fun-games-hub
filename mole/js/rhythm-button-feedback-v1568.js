(function () {
  'use strict';
  function setup() {
    var root = document.getElementById('rhythm-screen');
    if (!root || root.dataset.rpButtonFeedbackReady) return;
    root.dataset.rpButtonFeedbackReady = '1';
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    function play(button) {
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') return;
      var frame = button.querySelector(':scope > .rp-button-wave');
      if (!frame) {
        frame = document.createElement('i');
        frame.className = 'rp-button-wave';
        frame.setAttribute('aria-hidden', 'true');
        frame.appendChild(document.createElement('b'));
        button.appendChild(frame);
      }
      var pulse = frame.firstElementChild;
      if (typeof pulse.animate !== 'function') return;
      if (pulse._rpWaveAnimation) pulse._rpWaveAnimation.cancel();
      var animation = pulse.animate(reduced.matches ? [
        { opacity: 0 }, { opacity: .2 }, { opacity: 0 }
      ] : [
        { transform: 'scale(.06)', opacity: 0 },
        { transform: 'scale(.5)', opacity: .4, offset: .2 },
        { transform: 'scale(2.5)', opacity: 0 }
      ], { duration: reduced.matches ? 140 : 460, easing: 'cubic-bezier(.2,.6,.3,1)' });
      pulse._rpWaveAnimation = animation;
      function clear() { if (pulse._rpWaveAnimation === animation) pulse._rpWaveAnimation = null; }
      animation.finished.then(clear, clear);
    }
    function target(event) {
      return event.target.closest && event.target.closest('.rx-btn:not(.game-back)');
    }
    root.addEventListener('pointerdown', function (event) {
      if (event.button !== 0) return;
      var button = target(event);
      if (button) play(button);
    });
    root.addEventListener('keydown', function (event) {
      if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
      var button = target(event);
      if (button) play(button);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
