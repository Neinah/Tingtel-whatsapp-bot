function makeLimiter(max, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of hits) {
      if (now - rec.start > windowMs) hits.delete(key);
    }
  }, 10 * 60 * 1000).unref();

  return function check(key) {
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || now - rec.start > windowMs) {
      hits.set(key, { count: 1, start: now });
      return 'ok';
    }
    rec.count += 1;
    if (rec.count <= max) return 'ok';
    return rec.count === max + 1 ? 'notify' : 'silent';
  };
}

function makeDailyCap(max) {
  let day = new Date().toISOString().slice(0, 10);
  let count = 0;
  return function overCap() {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      count = 0;
    }
    count += 1;
    return count > max;
  };
}

function makeDeduper(ttlMs) {
  const seen = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [id, t] of seen) {
      if (now - t > ttlMs) seen.delete(id);
    }
  }, 10 * 60 * 1000).unref();

  return function isDuplicate(id) {
    if (!id) return false;
    if (seen.has(id)) return true;
    seen.set(id, Date.now());
    return false;
  };
}

function makeUserQueue() {
  const tails = new Map();
  return function runExclusive(key, fn) {
    const prev = tails.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    tails.set(key, next);
    next
      .finally(() => {
        if (tails.get(key) === next) tails.delete(key);
      })
      .catch(() => {});
    return next;
  };
}

module.exports = { makeLimiter, makeDailyCap, makeDeduper, makeUserQueue };
