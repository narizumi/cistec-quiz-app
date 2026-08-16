(function (global) {
  "use strict";

  const STORAGE_KEY = "cistec-quiz-wrong-answers";
  const SAVED_KEY = "cistec-quiz-saved-questions";
  const ANSWER_COUNTS_KEY = "cistec-quiz-answer-counts";

  function loadWrongIds(storage) {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveWrongIds(storage, ids) {
    storage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  function recordResult(storage, questionId, correct) {
    const wrongIds = new Set(loadWrongIds(storage));
    if (correct) {
      wrongIds.delete(questionId);
    } else {
      wrongIds.add(questionId);
    }
    saveWrongIds(storage, Array.from(wrongIds));
  }

  function loadSaved(storage) {
    const raw = storage.getItem(SAVED_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveSaved(storage, saved) {
    storage.setItem(SAVED_KEY, JSON.stringify(saved));
  }

  function saveQuestion(storage, questionId, memo) {
    const saved = loadSaved(storage);
    saved[questionId] = memo || "";
    saveSaved(storage, saved);
  }

  function unsaveQuestion(storage, questionId) {
    const saved = loadSaved(storage);
    delete saved[questionId];
    saveSaved(storage, saved);
  }

  function isQuestionSaved(storage, questionId) {
    return Object.prototype.hasOwnProperty.call(loadSaved(storage), questionId);
  }

  function getSavedIds(storage) {
    return Object.keys(loadSaved(storage));
  }

  function getMemo(storage, questionId) {
    return loadSaved(storage)[questionId] || "";
  }

  function loadAnswerCounts(storage) {
    const raw = storage.getItem(ANSWER_COUNTS_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveAnswerCounts(storage, counts) {
    storage.setItem(ANSWER_COUNTS_KEY, JSON.stringify(counts));
  }

  function incrementAnswerCount(storage, questionId) {
    const counts = loadAnswerCounts(storage);
    counts[questionId] = (counts[questionId] || 0) + 1;
    saveAnswerCounts(storage, counts);
  }

  function getAnswerCount(storage, questionId) {
    return loadAnswerCounts(storage)[questionId] || 0;
  }

  function resetAnswerCounts(storage) {
    storage.removeItem(ANSWER_COUNTS_KEY);
  }

  function createMemoryStorage() {
    const map = new Map();
    return {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => map.set(key, String(value)),
      removeItem: (key) => map.delete(key),
    };
  }

  const QuizStorage = {
    STORAGE_KEY,
    SAVED_KEY,
    ANSWER_COUNTS_KEY,
    loadWrongIds,
    saveWrongIds,
    recordResult,
    loadSaved,
    saveQuestion,
    unsaveQuestion,
    isQuestionSaved,
    getSavedIds,
    getMemo,
    loadAnswerCounts,
    saveAnswerCounts,
    incrementAnswerCount,
    getAnswerCount,
    resetAnswerCounts,
    createMemoryStorage,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = QuizStorage;
  } else {
    global.QuizStorage = QuizStorage;
  }
})(typeof window !== "undefined" ? window : globalThis);
