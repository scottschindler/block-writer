/** Keep list edits in the browser's native editing and undo history. */
export function handleEditorListKeyDown(editor: HTMLElement, event: KeyboardEvent): boolean {
  if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return false;
  const selection = window.getSelection();
  if (!selection?.rangeCount) return false;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return false;
  const element = range.startContainer instanceof Element
    ? range.startContainer
    : range.startContainer.parentElement;
  const item = element?.closest("li");

  if (event.key === "Tab") {
    // Outside lists, retain the existing plain-text indentation behavior.
    if (!item && event.shiftKey) return false;
    event.preventDefault();
    document.execCommand(item ? (event.shiftKey ? "outdent" : "indent") : "insertText", false, item ? undefined : "    ");
    return true;
  }

  if (event.key !== " " || event.shiftKey || !range.collapsed || item) return false;
  const block = element?.closest("p, div, h1, h2, h3, blockquote");
  const line = block && editor.contains(block) ? block : editor;
  const prefix = range.cloneRange();
  prefix.selectNodeContents(line);
  prefix.setEnd(range.startContainer, range.startOffset);
  // Only a standalone leading dash is a shortcut, never a hyphen in prose.
  if (prefix.toString() !== "-" || prefix.cloneContents().querySelector("br")) return false;

  event.preventDefault();
  selection.removeAllRanges();
  selection.addRange(prefix);
  document.execCommand("delete");
  document.execCommand("insertUnorderedList");
  return true;
}
