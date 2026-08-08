import React from "react";

export const formatSmartInput = (value, prefix, inputType) => {
  // 삭제 키 입력 시에는 포맷팅 건너뛰기
  if (inputType && inputType.includes("delete")) {
    return value;
  }

  const words = value.split(" ");
  const formattedWords = words.map((word) => {
    if (word === "") return "";
    if (word.startsWith(prefix)) return word;
    return prefix + word;
  });

  let result = formattedWords.join(" ");

  // 마지막이 공백이면 프리픽스 안 붙임 (사용자가 띄어쓰기 중일 때)
  if (value.endsWith(" ") && !result.endsWith(prefix)) {
    result += prefix;
  }

  return result;
};

// 2. 날짜 포맷팅 (Date 객체 -> 문자열)
export const formatDateForPicker = (date) => {
  if (!date) return "";

  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hour = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");

  return `${year}.${month}.${day} / ${hour}:${min}`;
};

// 3. 태그 파싱 (텍스트 -> 색상 입힌 JSX 배열)
export const parseContentWithTags = (text) => {
  if (!text) return "";

  // ★ [스마트 정규식]
  // 1. [@#] : @ 또는 # 으로 시작
  // 2. (?: ... )+ : 아래 조건들이 이어지는 동안 계속 잡음
  //    a. [^\s\(\)\[\]\{\}] : 공백도 아니고, 괄호들도 아닌 일반 문자들 (예: test, 123, 가나다)
  //    b. | \([^\s\)]*\)    : OR '소괄호()' 쌍이 맞는 덩어리
  //    c. | \[[^\s\]]*\]    : OR '대괄호[]' 쌍이 맞는 덩어리
  //    d. | \{[^\s\}]*\}    : OR '중괄호{}' 쌍이 맞는 덩어리
  const regex = /([@#](?:[^\s\(\)\[\]\{\}]|\([^\s\)]*\)|\[[^\s\]]*\]|\{[^\s\}]*\})+)/g;

  const parts = text.split(regex);

  return parts.map((part, index) => {
    // 쪼개진 조각이 태그 형태인지 확인 (@나 #으로 시작하는지)
    if (part.match(regex)) {
      return (
        <span key={index} style={{ color: "#708DFF" }}>
          {part}
        </span>
      );
    }
    // 아니면 그냥 텍스트
    return part;
  });
};
