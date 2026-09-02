const KEY = "kader.read.v1";
const LIMIT = 200;

function load(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Has this comic been read through at least once on this device? */
export function hasRead(projectId: string) {
  return load().includes(projectId);
}

export function markRead(projectId: string) {
  if (typeof localStorage === "undefined") return;
  const list = load().filter((id) => id !== projectId);
  list.unshift(projectId);
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
  } catch {
    /* a blocked store just means the hold applies again next time */
  }
}
