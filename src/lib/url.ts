/** BASE_URL(저장소 이름, 예 /makerthon/)과 경로를 슬래시 하나로 합친다. 외부 URL은 그대로 둔다. */
export function withBase(path: string, base: string = import.meta.env.BASE_URL ?? '/'): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return path;
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${b}/${p}`;
}
