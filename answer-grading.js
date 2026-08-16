(function (global) {
  "use strict";

  // A handful of Expert-level questions have a correctAnswer like "3と4" or
  // "1、2、3、4、5" that names a *set* of choice values rather than a single
  // choice value. Detect those generically: if correctAnswer doesn't match
  // any individual choice.value, it must be a multi-value answer string.
  function isMultiSelectQuestion(question) {
    return (
      question.format === "choice" &&
      !question.choices.some((c) => String(c.value) === String(question.correctAnswer))
    );
  }

  function splitAnswerTokens(str) {
    return String(str)
      .split(/[と、]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const v of a) {
      if (!b.has(v)) return false;
    }
    return true;
  }

  // Compares the user's selected choice values against question.correctAnswer
  // by splitting correctAnswer on the "と"/"、" separators and checking the
  // resulting token set matches the selected values (order-independent).
  // Kept separate from quiz-logic.js's isCorrect, which is intentionally a
  // simple string-equality check.
  function checkMultiAnswer(question, selectedValues) {
    const userTokens = new Set(
      selectedValues
        .map((v) => String(v).trim())
        .filter((s) => s.length > 0)
    );
    const correctTokens = new Set(splitAnswerTokens(question.correctAnswer));
    return setsEqual(userTokens, correctTokens);
  }

  const AnswerGrading = {
    isMultiSelectQuestion,
    splitAnswerTokens,
    setsEqual,
    checkMultiAnswer,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = AnswerGrading;
  } else {
    global.AnswerGrading = AnswerGrading;
  }
})(typeof window !== "undefined" ? window : globalThis);
