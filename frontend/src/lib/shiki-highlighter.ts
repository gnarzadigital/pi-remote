type ShikiTheme = "github-light" | "github-dark";

let loadPromise: Promise<typeof import("shiki")> | null = null;

function loadShiki() {
  if (!loadPromise) {
    loadPromise = import("shiki");
  }
  return loadPromise;
}

export function resolveShikiTheme(): ShikiTheme {
  return document.documentElement.classList.contains("dark")
    ? "github-dark"
    : "github-light";
}

export async function highlightCode(
  code: string,
  language: string,
  theme?: ShikiTheme
): Promise<string> {
  const { codeToHtml } = await loadShiki();
  const resolvedTheme = theme ?? resolveShikiTheme();
  const lang = language === "plaintext" ? "text" : language;

  try {
    return await codeToHtml(code, { lang, theme: resolvedTheme });
  } catch {
    try {
      return await codeToHtml(code, { lang: "text", theme: resolvedTheme });
    } catch {
      return `<pre><code>${code.replace(/</g, "&lt;")}</code></pre>`;
    }
  }
}
