/**
 * Privacy Model, residual risk "writing style": the system hides who wrote an evaluation, but a
 * comment signed with the writer's own name gives it away. This finds such mentions so the form
 * can warn (it never blocks: the writer decides).
 */

const MIN_LENGTH = 3;

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface OwnNames {
  first_name: string;
  last_name: string;
  display_name: string;
  username: string;
}

/** Which of the writer's own names appear as whole words in `text` (case/accent-insensitive). */
export function ownNameMentions(text: string, me: OwnNames | null | undefined): string[] {
  if (!me || !text.trim()) return [];
  const haystack = fold(text);
  const names = [me.first_name, me.last_name, me.display_name, me.username]
    .map((n) => n.trim())
    .filter((n, i, all) => n.length >= MIN_LENGTH && all.indexOf(n) === i);
  return names.filter((name) =>
    new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(fold(name))}($|[^\\p{L}\\p{N}])`, "u").test(
      haystack,
    ),
  );
}
