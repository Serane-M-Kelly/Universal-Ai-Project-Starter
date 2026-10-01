import YAML from "yaml";

export interface MarkdownFrontmatter {
  attributes: Record<string, unknown>;
  body: string;
  /** Texte YAML brut du frontmatter, pour le réécrire sans re-sérialisation. */
  raw: string;
  /** Fin de ligne des délimiteurs du document, préservée à la réécriture. */
  newline: "\n" | "\r\n";
}

export function parseFrontmatter(content: string): MarkdownFrontmatter {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match?.[1] || match[2] === undefined) {
    throw new Error("Frontmatter YAML absent ou invalide.");
  }

  const attributes = YAML.parse(match[1]) as unknown;
  if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
    throw new Error("Le frontmatter doit être un objet YAML.");
  }

  return {
    attributes: attributes as Record<string, unknown>,
    body: match[2],
    raw: match[1],
    newline: content.startsWith("---\r\n") ? "\r\n" : "\n",
  };
}

export function stringifyFrontmatter(
  attributes: Record<string, unknown>,
  body: string,
): string {
  return `---\n${YAML.stringify(attributes).trimEnd()}\n---\n${body}`;
}

/**
 * Remplace uniquement le corps, en conservant le frontmatter octet à octet :
 * commentaires, quoting, ordre et mise en forme YAML sont préservés.
 */
export function replaceBody(
  rawFrontmatter: string,
  body: string,
  newline: "\n" | "\r\n" = "\n",
): string {
  return `---${newline}${rawFrontmatter}${newline}---${newline}${body}`;
}
