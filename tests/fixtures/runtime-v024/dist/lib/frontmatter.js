import YAML from "yaml";
export function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match?.[1] || match[2] === undefined) {
        throw new Error("Frontmatter YAML absent ou invalide.");
    }
    const attributes = YAML.parse(match[1]);
    if (!attributes || typeof attributes !== "object" || Array.isArray(attributes)) {
        throw new Error("Le frontmatter doit être un objet YAML.");
    }
    return {
        attributes: attributes,
        body: match[2],
        raw: match[1],
        newline: content.startsWith("---\r\n") ? "\r\n" : "\n",
    };
}
export function stringifyFrontmatter(attributes, body) {
    return `---\n${YAML.stringify(attributes).trimEnd()}\n---\n${body}`;
}
/**
 * Remplace uniquement le corps, en conservant le frontmatter octet à octet :
 * commentaires, quoting, ordre et mise en forme YAML sont préservés.
 */
export function replaceBody(rawFrontmatter, body, newline = "\n") {
    return `---${newline}${rawFrontmatter}${newline}---${newline}${body}`;
}
//# sourceMappingURL=frontmatter.js.map