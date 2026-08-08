import { formatSmartInput, formatDateForPicker } from "../utils/formatUtils";

export const useInputLogic = (updateCurrentPage, textAreaRef) => {
  const handleSmartInput = (e, key, prefix) => {
    const val = e.target.value;
    const inputType = e.nativeEvent.inputType;
    const result = formatSmartInput(val, prefix, inputType);
    updateCurrentPage(key, result);
  };

  const handleDateSelect = (date) => {
    const formatted = formatDateForPicker(date);
    updateCurrentPage("uploadDate", formatted);
  };

  const onEmojiClick = (emojiObject) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const currentText = textarea.value;
    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const newText =
      currentText.substring(0, startPos) +
      emojiObject.emoji +
      currentText.substring(endPos);

    updateCurrentPage("content", newText);

    const newCursorPos = startPos + emojiObject.emoji.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return {
    handleSmartInput,
    handleDateSelect,
    onEmojiClick,
  };
};
