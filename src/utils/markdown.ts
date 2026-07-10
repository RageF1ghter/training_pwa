import MarkdownIt from "markdown-it";

// One shared instance — markdown-it is stateful per call but the instance
// itself is reusable and cheap. Configured for chat bubbles: no raw HTML
// (defense against XSS from model output), compact output, line breaks render.
const md: MarkdownIt = MarkdownIt({
  html: false, // never allow raw HTML from AI output (XSS protection)
  breaks: true, // single \n becomes <br> — matches chat expectations
  linkify: true, // auto-link bare URLs
  typographer: false, // keep punctuation plain
});

// Disable image rendering — AI fitness advice has no useful images, and a
// stray ![]() would render an empty box in the bubble. markdown-it exposes
// the inline image rule simply as "image" (block images use the same name).
md.disable("image");

export function renderMarkdown(text: string): string {
  if (!text) return "";
  return md.render(text);
}
