(function (global) {
  "use strict";

  function filterByLevelsAndExams(questions, levels, examLabels) {
    return questions.filter((q) => {
      if (levels && levels.length > 0 && !levels.includes(q.level)) return false;
      if (examLabels && examLabels.length > 0 && !examLabels.includes(q.examLabel)) return false;
      return true;
    });
  }

  function filterByCategories(questions, categorySlugs) {
    if (!categorySlugs || categorySlugs.length === 0) return questions.slice();
    return questions.filter((q) => q.category.some((c) => categorySlugs.includes(c)));
  }

  function filterByIds(questions, ids) {
    const idSet = new Set(ids);
    return questions.filter((q) => idSet.has(q.id));
  }

  function shuffle(array, randomFn) {
    const rng = randomFn || Math.random;
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function buildQueue(questions, randomFn) {
    return shuffle(questions, randomFn);
  }

  function isCorrect(question, answerValue) {
    return String(question.correctAnswer) === String(answerValue);
  }

  function computeScore(results) {
    const total = results.length;
    const correct = results.filter((r) => r.correct).length;
    return { total, correct, incorrect: total - correct };
  }

  const QuizLogic = {
    filterByLevelsAndExams,
    filterByCategories,
    filterByIds,
    shuffle,
    buildQueue,
    isCorrect,
    computeScore,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = QuizLogic;
  } else {
    global.QuizLogic = QuizLogic;
  }
})(typeof window !== "undefined" ? window : globalThis);
