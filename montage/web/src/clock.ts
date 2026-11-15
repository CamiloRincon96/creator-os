// Playback time outside React: the playhead and the timecode update 60 times per
// second without re-rendering components. Whoever needs it subscribes and touches the DOM directly.

type Listener = (t: number) => void;

class Clock {
  t = 0;
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.t);
    return () => {
      this.listeners.delete(fn);
    };
  }

  set(t: number) {
    if (t === this.t) return;
    this.t = t;
    for (const fn of this.listeners) fn(t);
  }
}

export const clock = new Clock();
