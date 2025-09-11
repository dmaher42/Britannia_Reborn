export function getSelectedText(selection) {
  if (!selection) return '';
  if (typeof selection.selectedText !== 'undefined') {
    return selection.selectedText;
  }
  if (typeof selection.toString === 'function') {
    return selection.toString();
  }
  return '';
}
