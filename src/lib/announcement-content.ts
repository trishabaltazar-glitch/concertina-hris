import sanitizeHtml from "sanitize-html";

const MAX_ANNOUNCEMENT_CONTENT_LENGTH = 8000;

const allowedTextAlignValues = [/^left$/, /^center$/, /^right$/, /^justify$/];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripHtml(value: string) {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/gi, " ");
}

export function hasAnnouncementContent(value: string) {
  return stripHtml(value).trim().length > 0 || /<img\b/i.test(value);
}

export function sanitizeAnnouncementContent(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.trim().slice(0, MAX_ANNOUNCEMENT_CONTENT_LENGTH) : "";

  if (!raw) {
    return "";
  }

  const sanitized = sanitizeHtml(raw.replace(/\0/g, ""), {
    allowedTags: [
      "a",
      "blockquote",
      "br",
      "code",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "hr",
      "img",
      "li",
      "ol",
      "p",
      "pre",
      "s",
      "span",
      "strong",
      "u",
      "ul",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["alt", "src", "title"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
      p: ["style"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    allowedStyles: {
      "*": {
        "text-align": allowedTextAlignValues,
      },
    },
    selfClosing: ["br", "hr", "img"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }, true),
    },
  })
    .replace(/<p>\s*<\/p>/gi, "")
    .trim();

  return hasAnnouncementContent(sanitized) ? sanitized.slice(0, MAX_ANNOUNCEMENT_CONTENT_LENGTH) : "";
}

export function getAnnouncementContentHtml(content: string) {
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    return "";
  }

  if (/<\/?[a-z][\s\S]*>/i.test(trimmedContent)) {
    return sanitizeAnnouncementContent(trimmedContent) || escapeHtml(trimmedContent);
  }

  return escapeHtml(trimmedContent).replace(/\r?\n/g, "<br />");
}
