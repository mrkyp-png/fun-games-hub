(function (root) {
  'use strict';

  // 몸통은 "머리가 지나온 궤적(trail)을 일정 간격으로 따라가는" 방식으로 구현한다 —
  // 격자 기반 고전 스네이크가 아니라 슬리더리오류 자유이동 지렁이(스펙 §8.2가 "드래그로
  // 진행 방향 전환 + 지속 이동"을 명시하므로 격자 이동이 아님)에 표준적인 기법.
  class Worm {
    constructor(x, y, opts) {
      this.trail = [{ x, y }];
      this.direction = { x: 1, y: 0 };
      this.speed = opts.speed;
      this.length = opts.initialLength || 3;
      this.maxLength = opts.maxLength;
      this.segmentSpacing = opts.segmentSpacing || 14;
    }

    get head() { return this.trail[0]; }

    setDirection(x, y) {
      const len = Math.hypot(x, y) || 1;
      this.direction = { x: x / len, y: y / len };
    }

    update(dt) {
      const h = this.head;
      const nx = h.x + this.direction.x * this.speed * dt;
      const ny = h.y + this.direction.y * this.speed * dt;
      this.trail.unshift({ x: nx, y: ny });

      // trail이 몸길이가 필요로 하는 거리보다 훨씬 길어지지 않도록 잘라낸다
      // (메모리/연산량이 무한히 늘어나는 것 방지).
      const neededDist = this.segmentSpacing * (this.maxLength + 2);
      let dist = 0;
      for (let i = 1; i < this.trail.length; i++) {
        dist += Math.hypot(
          this.trail[i].x - this.trail[i - 1].x,
          this.trail[i].y - this.trail[i - 1].y
        );
        if (dist > neededDist) {
          this.trail.length = i + 1;
          break;
        }
      }
    }

    grow(amount) {
      this.length = Math.min(this.maxLength, this.length + amount);
    }

    getSegments() {
      const segs = [this.head];
      let dist = 0;
      let idx = 0;
      for (let s = 1; s < this.length; s++) {
        const targetDist = s * this.segmentSpacing;
        while (idx < this.trail.length - 1 && dist < targetDist) {
          idx++;
          dist += Math.hypot(
            this.trail[idx].x - this.trail[idx - 1].x,
            this.trail[idx].y - this.trail[idx - 1].y
          );
        }
        segs.push(this.trail[Math.min(idx, this.trail.length - 1)]);
      }
      return segs;
    }
  }

  const api = { Worm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.SnakeGame = root.SnakeGame || {}; root.SnakeGame.Worm = Worm; }
})(typeof window !== 'undefined' ? window : null);
