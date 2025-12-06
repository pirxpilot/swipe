import events from '@pirxpilot/events';
import Emitter from 'component-emitter';

/**
 * Turn `el` into a swipeable list.
 *
 * @param {Element} el
 * @api public
 */

export default class Swipe extends Emitter {
  #duration = 300;
  #interval = 5000;
  #threshold = 0.5;
  #fastThreshold = 200;

  constructor(el) {
    super();
    if (!el) throw new TypeError('Swipe() requires an element');
    this.child = el.children[0];
    this.touchAction('none');
    this.currentEl = this.children().visible[0];
    this.currentVisible = 0;
    this.current = 0;
    this.el = el;
    this.refresh();
    this.show(0, 0, { silent: true });
    this.bind();
  }

  /**
   * Set the swipe threshold to `n`.
   *
   * This is the factor required for swipe
   * to detect when a slide has passed the
   * given threshold, and may display the next
   * or previous slide. For example the default
   * of `.5` means that the user must swipe _beyond_
   * half of the side width.
   *
   * @param {Number} n
   * @api public
   */

  threshold(n) {
    this.#threshold = n;
  }

  /**
   * Set the "fast" swipe threshold to `ms`.
   *
   * This is the amount of time in milliseconds
   * which determines if a swipe was "fast" or not. When
   * the swipe's duration is less than `ms` only 1/10th of
   * the slide's width must be exceeded to display the previous
   * or next slide.
   *
   * @param {Number} n
   * @api public
   */

  fastThreshold(ms) {
    this.#fastThreshold = ms;
  }

  /**
   * Refresh sizing data.
   *
   * @api public
   */

  refresh() {
    const children = this.children();
    const visible = children.visible.length;
    const prev = this.visible || visible;

    const i = indexOf(children.visible, this.currentEl);

    // we removed/added item(s), update current
    if (visible < prev && i <= this.currentVisible && i >= 0) {
      this.currentVisible = i;
    } else if (visible > prev && i > this.currentVisible) {
      this.currentVisible = i;
    }

    this.visible = visible;
    this.childWidth = this.el.getBoundingClientRect().width;
    this.width = Math.ceil(this.childWidth * visible);
    this.child.style.width = `${this.width}px`;
    this.child.style.height = `${this.height}px`;
    this.show(this.currentVisible, 0, { silent: true });
  }

  /**
   * Bind event handlers.
   *
   * @api public
   */

  bind() {
    this.events = events(this.child, this);

    this.events.bind('pointerdown', 'ontouchstart');
    this.events.bind('pointermove', 'ontouchmove');
    this.events.bind('pointerup', 'ontouchend');
    this.events.bind('pointercancel', 'ontouchend');
  }

  /**
   * Unbind event handlers.
   *
   * @api public
   */

  unbind() {
    this.events.unbind();
  }

  /**
   * Handle touchstart.
   *
   * @api private
   */

  ontouchstart(e) {
    this.transitionDuration(0);
    this.dx = 0;
    this.updown = null;

    e.target.setPointerCapture(e.pointerId);
    this.down = {
      x: e.pageX,
      y: e.pageY,
      at: new Date()
    };
  }

  /**
   * Handle touchmove.
   *
   * For the first and last slides
   * we apply some resistence to help
   * indicate that you're at the edges.
   *
   * @api private
   */

  ontouchmove(e) {
    if (!this.down || this.updown) return;

    // TODO: ignore more than one finger
    if (!e) return;

    const down = this.down;
    const x = e.pageX;
    const w = this.childWidth;
    const i = this.currentVisible;
    this.dx = x - down.x;

    // determine dy and the slope
    if (null == this.updown) {
      const y = e.pageY;
      const dy = y - down.y;
      const slope = dy / this.dx;

      // if is greater than 1 or -1, we're swiping up/down
      if (slope > 1 || slope < -1) {
        this.updown = true;
        return;
      }
      this.updown = false;
    }

    e.preventDefault();

    const dir = this.dx < 0 ? 1 : 0;
    if (this.isFirst() && 0 === dir) this.dx /= 2;
    if (this.isLast() && 1 === dir) this.dx /= 2;
    this.translate(i * w + -this.dx);
  }

  /**
   * Handle touchend.
   *
   * @api private
   */

  ontouchend(e) {
    e.stopPropagation();
    if (!this.down) return;

    e.target.releasePointerCapture(e.pointerId);

    // setup
    const dx = this.dx;
    const w = this.childWidth;

    // < 200ms swipe
    const ms = Date.now() - this.down.at;
    const threshold = ms < this.#fastThreshold ? w / 10 : w * this.#threshold;
    const dir = dx < 0 ? 1 : 0;
    const half = Math.abs(dx) >= threshold;

    // clear
    this.down = null;

    // first -> next
    if (this.isFirst() && 1 === dir && half) return this.next();

    // first -> first
    if (this.isFirst()) return this.prev();

    // last -> last
    if (this.isLast() && 1 === dir) return this.next();

    // N -> N + 1
    if (1 === dir && half) return this.next();

    // N -> N - 1
    if (0 === dir && half) return this.prev();

    // N -> N
    this.show(this.currentVisible);
  }

  /**
   * Set transition duration to `ms`.
   *
   * @param {Number} ms
   * @return {Swipe} self
   * @api public
   */

  duration(ms) {
    this.#duration = ms;
    return this;
  }

  /**
   * Set cycle interval to `ms`.
   *
   * @param {Number} ms
   * @return {Swipe} self
   * @api public
   */

  interval(ms) {
    this.#interval = ms;
    return this;
  }

  /**
   * Play through all the elements.
   *
   * @return {Swipe} self
   * @api public
   */

  play() {
    if (this.timer) return;
    this.timer = setInterval(this.cycle.bind(this), this.#interval);
    return this;
  }

  /**
   * Stop playing.
   *
   * @return {Swipe} self
   * @api public
   */

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    return this;
  }

  /**
   * Show the next slide, when the end
   * is reached start from the beginning.
   *
   * @api public
   */

  cycle() {
    if (this.isLast()) {
      this.currentVisible = -1;
      this.next();
    } else {
      this.next();
    }
  }

  /**
   * Check if we're on the first visible slide.
   *
   * @return {Boolean}
   * @api public
   */

  isFirst() {
    return this.currentVisible === 0;
  }

  /**
   * Check if we're on the last visible slide.
   *
   * @return {Boolean}
   * @api public
   */

  isLast() {
    return this.currentVisible === this.visible - 1;
  }

  /**
   * Show the previous slide, if any.
   *
   * @return {Swipe} self
   * @api public
   */

  prev() {
    this.show(this.currentVisible - 1);
    return this;
  }

  /**
   * Show the next slide, if any.
   *
   * @return {Swipe} self
   * @api public
   */

  next() {
    this.show(this.currentVisible + 1);
    return this;
  }

  /**
   * Show slide `i`.
   *
   * Emits `show `event
   *
   * @param {Number} i
   * @return {Swipe} self
   * @api public
   */

  show(i, ms = this.#duration, { silent } = {}) {
    const children = this.children();
    i = Math.max(0, Math.min(i, children.visible.length - 1));
    this.currentVisible = i;
    this.currentEl = children.visible[i];
    this.current = indexOf(children.all, this.currentEl);
    this.transitionDuration(ms);
    this.translate(this.childWidth * i);

    if (!silent) {
      this.emit('showing', this.current, this.currentEl);
      if (!ms) return this;
      this.child.addEventListener(
        'transitionend',
        () => {
          if (this.current === i) this.emit('show', this.current, this.currentEl);
        },
        { once: true }
      );
    }
    return this;
  }

  /**
   * Return children categorized by visibility.
   *
   * @return {Object}
   * @api private
   */

  children() {
    const els = this.child.children;

    const ret = {
      all: els,
      visible: [],
      hidden: []
    };

    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (visible(el)) {
        ret.visible.push(el);
      } else {
        ret.hidden.push(el);
      }
    }

    return ret;
  }

  /**
   * Set transition duration.
   *
   * @api private
   */

  transitionDuration(ms) {
    this.child.style.transition = `${ms}ms transform`;
  }

  /**
   * Translate to `x`.
   *
   * TODO: use translate component
   *
   * @api private
   */

  translate(x) {
    this.child.style.transform = `translate3d(${-x}px, 0, 0)`;
  }

  /**
   * Sets the "touchAction" CSS style property to `value`.
   *
   * @api private
   */

  touchAction(value) {
    this.child.style.touchAction = value;
  }
}

/**
 * Return index of `el` in `els`.
 *
 * @param {Array} els
 * @param {Element} el
 * @return {Number}
 */

function indexOf(els, el) {
  for (let i = 0; i < els.length; i++) {
    if (els[i] === el) return i;
  }
  return -1;
}

/**
 * Check if `el` is visible.
 *
 * @param {Element} el
 * @return {Boolean}
 */

function visible(el) {
  return getComputedStyle(el).display !== 'none';
}
