/**
 * 텍스트에어리어 내 커서의 X, Y 좌표를 계산하는 함수
 */
export const getCursorXY = (input, selectionPoint) => {
  const { offsetLeft: inputX, offsetTop: inputY } = input;

  const div = document.createElement("div");
  const copyStyle = getComputedStyle(input);

  for (const prop of [
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "lineHeight",
    "fontFamily",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
  ]) {
    div.style[prop] = copyStyle[prop];
  }

  div.style.position = "absolute";
  div.style.top = "0px";
  div.style.left = "0px";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";

  div.textContent = input.value.substring(0, selectionPoint);

  const span = document.createElement("span");
  span.textContent = input.value.substring(selectionPoint) || ".";
  div.appendChild(span);

  document.body.appendChild(div);

  const { offsetLeft: spanX, offsetTop: spanY } = span;
  document.body.removeChild(div);

  return { x: inputX + spanX, y: inputY + spanY };
};
