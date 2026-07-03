// Hide non-project session dirs from the mobile UI. These are scratch/tmp/home
// dirs that pi writes sessions into but that Nik never wants to browse on his phone.
// ponytail: substring denylist — add a pattern here if a new junk dir shows up.
const JUNK_PATTERNS = [
  "private-tmp",
  "-tmp-",
  "scratchpad",
  "codex-memories",
  "cmux-",
  "-smoke",
];

/** slug is the encoded session dir name, e.g. "--Users-nik-Projects-foo--". */
export function isJunkWorkspace(slug: string, homeSlug: string): boolean {
  if (slug.replace(/-/g, "") === "") return true; // "----" (filesystem root)
  if (slug === homeSlug) return true; // bare home dir
  const lower = slug.toLowerCase();
  return JUNK_PATTERNS.some((p) => lower.includes(p));
}
