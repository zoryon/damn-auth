export function now() {
  return new Date();
}

export function secondsFromNow(seconds: number) {
  return new Date(Date.now() + seconds * 1000);
}

export function unixSeconds(date = new Date()) {
  return Math.floor(date.getTime() / 1000);
}

export function isExpired(date: Date) {
  return date.getTime() <= Date.now();
}
