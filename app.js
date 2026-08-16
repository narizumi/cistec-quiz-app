(function () {
  "use strict";

  const appEl = document.getElementById("app");
  const storage = window.localStorage;

  const LEVEL_ORDER = ["Expert", "Advanced", "Associate"];
  const LEVELS = LEVEL_ORDER.filter((level) => QUESTIONS.some((q) => q.level === level));

  // Mirrors CATEGORIES in cistec-quiz-app/scripts/taxonomy.py (same 12 slugs / labels).
  const CATEGORY_LABELS = {
    classification: "該非判定・リスト規制",
    catch_all: "キャッチオール規制",
    license_types: "許可の種類(個別・包括・特別)",
    exemptions: "少額特例等の特例",
    service_transactions: "役務取引・技術提供(みなし輸出含む)",
    end_user_use: "需要者・用途確認(エンドユース/エンドユーザー)",
    documents_pledge: "誓約書・提出書類",
    compliance_program: "輸出者等遵守基準・社内管理体制(該非確認責任者等)",
    penalties_law_structure: "罰則・法令構成",
    brokering: "仲介貿易",
    foreign_regulations: "米国等外国規制(EAR等)",
    other: "その他",
  };

  const state = {
    screen: "home",
    filters: { levels: [], examLabels: [], categories: [] },
    pendingQuestions: [], // 絞り込み後・問題選択画面に表示する候補
    selectedIds: new Set(), // 問題選択画面でチェックが入っている問題id
    queue: [],
    queueIndex: 0,
    results: [],
    answered: null, // single-select: chosen value string. multi-select: array of chosen value strings.
    multiSelected: [], // multi-select: values currently toggled on, before submit.
    marks: {}, // choice value -> "○"|"×"|"△"、検討中の一時メモ。保存せず問題移動時にリセット。
  };

  function examLabelsForLevels(levels) {
    const set = new Set();
    QUESTIONS.filter((q) => levels.includes(q.level)).forEach((q) => set.add(q.examLabel));
    return Array.from(set);
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    (children || []).forEach((c) => {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function renderTextWithUnderlines(text, ranges) {
    const segments = TextRender.splitTextByRanges(text, ranges);
    if (segments.length === 0) return document.createTextNode(text || "");
    const frag = document.createDocumentFragment();
    segments.forEach((seg) => {
      if (seg.underline) {
        const u = document.createElement("u");
        u.textContent = seg.text;
        frag.appendChild(u);
      } else {
        frag.appendChild(document.createTextNode(seg.text));
      }
    });
    return frag;
  }

  // Multi-select ("select all that apply") grading logic — detection,
  // separator parsing, and set comparison — lives in answer-grading.js
  // (loaded before this script) so it can be unit tested without a DOM.
  const isMultiSelectQuestion = AnswerGrading.isMultiSelectQuestion;
  const splitAnswerTokens = AnswerGrading.splitAnswerTokens;
  const checkMultiAnswer = AnswerGrading.checkMultiAnswer;

  function render() {
    appEl.innerHTML = "";
    if (state.screen === "home") renderHome();
    else if (state.screen === "levelSelect") renderLevelSelect();
    else if (state.screen === "categorySelect") renderCategorySelect();
    else if (state.screen === "questionPicker") renderQuestionPicker();
    else if (state.screen === "quiz") renderQuiz();
    else if (state.screen === "result") renderResult();
  }

  function openQuestionPicker(questions) {
    state.pendingQuestions = questions;
    state.selectedIds = new Set(questions.map((q) => q.id));
    state.screen = "questionPicker";
    render();
  }

  function goHome() {
    state.screen = "home";
    state.filters = { levels: [], examLabels: [], categories: [] };
    state.pendingQuestions = [];
    state.selectedIds = new Set();
    render();
  }

  function renderBackToHomeButton() {
    return el("button", { class: "link-button", onclick: goHome }, ["トップへ戻る"]);
  }

  function startQueue(questions) {
    state.queue = QuizLogic.buildQueue(questions);
    state.queueIndex = 0;
    state.results = [];
    state.answered = null;
    state.multiSelected = [];
    state.marks = {};
    state.screen = "quiz";
    render();
  }

  function renderHome() {
    const wrongCount = QuizStorage.loadWrongIds(storage).length;
    const savedCount = QuizStorage.getSavedIds(storage).length;
    appEl.appendChild(el("h1", {}, ["CISTEC過去問一問一答"]));
    appEl.appendChild(
      el("div", { class: "mode-list" }, [
        el("button", { class: "mode-button", onclick: () => { state.screen = "levelSelect"; render(); } }, [
          "レベル・回を選んで出題",
        ]),
        el("button", { class: "mode-button", onclick: () => { state.screen = "categorySelect"; render(); } }, [
          "カテゴリを選んで出題",
        ]),
        el(
          "button",
          {
            class: "mode-button",
            onclick: () => {
              const wrongIds = QuizStorage.loadWrongIds(storage);
              const questions = QuizLogic.filterByIds(QUESTIONS, wrongIds);
              if (questions.length === 0) {
                alert("復習する誤答問題がありません。");
                return;
              }
              openQuestionPicker(questions);
            },
          },
          [`誤答復習 (${wrongCount}問)`]
        ),
        el(
          "button",
          {
            class: "mode-button",
            onclick: () => {
              const savedIds = QuizStorage.getSavedIds(storage);
              const questions = QuizLogic.filterByIds(QUESTIONS, savedIds);
              if (questions.length === 0) {
                alert("保存した問題がありません。");
                return;
              }
              openQuestionPicker(questions);
            },
          },
          [`保存した問題を復習 (${savedCount}問)`]
        ),
      ])
    );
    appEl.appendChild(
      el(
        "button",
        {
          class: "link-button",
          onclick: () => {
            if (confirm("回答回数をリセットしますか？")) {
              QuizStorage.resetAnswerCounts(storage);
              render();
            }
          },
        },
        ["回答回数をリセット"]
      )
    );
  }

  function renderLevelSelect() {
    const selectedLevels = state.filters.levels;
    appEl.appendChild(renderBackToHomeButton());
    appEl.appendChild(el("h2", {}, ["レベル・回を選ぶ"]));
    appEl.appendChild(
      el(
        "div",
        { class: "choice-list" },
        LEVELS.map((level) =>
          el(
            "button",
            {
              class: "filter-button" + (selectedLevels.includes(level) ? " selected" : ""),
              onclick: () => {
                const idx = selectedLevels.indexOf(level);
                if (idx >= 0) selectedLevels.splice(idx, 1);
                else selectedLevels.push(level);
                render();
              },
            },
            [level]
          )
        )
      )
    );

    const exams = examLabelsForLevels(selectedLevels.length ? selectedLevels : LEVELS);
    appEl.appendChild(el("h3", {}, ["回(未選択の場合は全て)"]));
    appEl.appendChild(
      el(
        "div",
        { class: "choice-list" },
        exams.map((label) =>
          el(
            "button",
            {
              class: "filter-button" + (state.filters.examLabels.includes(label) ? " selected" : ""),
              onclick: () => {
                const idx = state.filters.examLabels.indexOf(label);
                if (idx >= 0) state.filters.examLabels.splice(idx, 1);
                else state.filters.examLabels.push(label);
                render();
              },
            },
            [label]
          )
        )
      )
    );

    appEl.appendChild(
      el(
        "button",
        {
          class: "primary-button",
          onclick: () => {
            const questions = QuizLogic.filterByLevelsAndExams(
              QUESTIONS,
              selectedLevels,
              state.filters.examLabels
            );
            if (questions.length === 0) {
              alert("条件に一致する問題がありません。");
              return;
            }
            openQuestionPicker(questions);
          },
        },
        ["出題開始"]
      )
    );
  }

  function renderCategorySelect() {
    const categories = Array.from(new Set(QUESTIONS.flatMap((q) => q.category)));
    const countByCategory = new Map();
    categories.forEach((cat) => {
      countByCategory.set(cat, QUESTIONS.filter((q) => q.category.includes(cat)).length);
    });
    appEl.appendChild(renderBackToHomeButton());
    appEl.appendChild(el("h2", {}, ["カテゴリを選ぶ"]));
    appEl.appendChild(
      el(
        "div",
        { class: "choice-list" },
        categories.map((cat) =>
          el(
            "button",
            {
              class: "filter-button" + (state.filters.categories.includes(cat) ? " selected" : ""),
              onclick: () => {
                const idx = state.filters.categories.indexOf(cat);
                if (idx >= 0) state.filters.categories.splice(idx, 1);
                else state.filters.categories.push(cat);
                render();
              },
            },
            [`${CATEGORY_LABELS[cat] || cat} (${countByCategory.get(cat)}問)`]
          )
        )
      )
    );
    appEl.appendChild(
      el(
        "button",
        {
          class: "primary-button",
          onclick: () => {
            const questions = QuizLogic.filterByCategories(QUESTIONS, state.filters.categories);
            if (questions.length === 0) {
              alert("条件に一致する問題がありません。");
              return;
            }
            openQuestionPicker(questions);
          },
        },
        ["出題開始"]
      )
    );
  }

  function renderQuestionPicker() {
    appEl.appendChild(renderBackToHomeButton());
    appEl.appendChild(el("h2", {}, ["出題する問題を選ぶ"]));
    appEl.appendChild(
      el("p", { class: "hint" }, [`${state.selectedIds.size} / ${state.pendingQuestions.length} 問選択中`])
    );
    appEl.appendChild(
      el(
        "button",
        {
          class: "link-button",
          onclick: () => {
            state.selectedIds = new Set();
            render();
          },
        },
        ["全て選択解除"]
      )
    );

    const groups = new Map(); // category slug -> questions[]
    state.pendingQuestions.forEach((q) => {
      const cat = (q.category && q.category[0]) || "other";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(q);
    });

    groups.forEach((questionsInGroup, cat) => {
      const groupEl = el("div", { class: "card" }, []);
      const headingRow = el("div", { class: "category-group-heading" }, [
        el("h3", {}, [`${CATEGORY_LABELS[cat] || cat} (${questionsInGroup.length}問)`]),
      ]);
      const allSelected = questionsInGroup.every((q) => state.selectedIds.has(q.id));
      headingRow.appendChild(
        el(
          "button",
          {
            class: "link-button",
            onclick: () => {
              if (allSelected) {
                questionsInGroup.forEach((q) => state.selectedIds.delete(q.id));
              } else {
                questionsInGroup.forEach((q) => state.selectedIds.add(q.id));
              }
              render();
            },
          },
          [allSelected ? "全解除" : "全選択"]
        )
      );
      groupEl.appendChild(headingRow);

      questionsInGroup.forEach((q) => {
        const row = el("label", { class: "question-picker-item" }, []);
        const checkbox = el("input", { type: "checkbox" }, []);
        // checked はel()の汎用setAttributeパス経由だと常にtrue扱いになりうる
        // (disabledと同じ落とし穴)ため、IDLプロパティとして直接設定する。
        checkbox.checked = state.selectedIds.has(q.id);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) state.selectedIds.add(q.id);
          else state.selectedIds.delete(q.id);
          render();
        });
        row.appendChild(checkbox);
        const answerCount = QuizStorage.getAnswerCount(storage, q.id);
        row.appendChild(
          el("span", {}, [
            `${q.title}(${q.level} / ${q.examLabel} / 問題${q.questionNumber} / 回答回数: ${answerCount})`,
          ])
        );
        groupEl.appendChild(row);
      });

      appEl.appendChild(groupEl);
    });

    const startBtn = el(
      "button",
      {
        class: "primary-button",
        onclick: () => {
          const selected = state.pendingQuestions.filter((q) => state.selectedIds.has(q.id));
          startQueue(selected);
        },
      },
      ["出題開始"]
    );
    startBtn.disabled = state.selectedIds.size === 0;
    appEl.appendChild(startBtn);
  }

  function renderQuiz() {
    const question = state.queue[state.queueIndex];
    const multi = isMultiSelectQuestion(question);

    const headerRow = el("div", { class: "quiz-header-row" }, [
      el("div", { class: "progress" }, [`${state.queueIndex + 1} / ${state.queue.length}`]),
      el(
        "button",
        {
          class: "link-button",
          onclick: () => {
            state.screen = "result";
            render();
          },
        },
        ["終了する"]
      ),
    ]);
    appEl.appendChild(headerRow);
    appEl.appendChild(el("div", { class: "title" }, [question.title]));
    const answerCount = QuizStorage.getAnswerCount(storage, question.id);
    appEl.appendChild(
      el("div", { class: "meta" }, [
        `${question.level} / ${question.examLabel} / 問題${question.questionNumber} / 回答回数: ${answerCount}`,
      ])
    );
    appEl.appendChild(renderSavePanel(question));

    const card = el("div", { class: "card" }, []);
    if (question.lead) {
      const p = document.createElement("p");
      p.appendChild(renderTextWithUnderlines(question.lead, question.leadUnderlines));
      card.appendChild(p);
    }
    (question.statements || []).forEach((s) => {
      const p = document.createElement("p");
      p.appendChild(document.createTextNode(`${s.label}　`));
      p.appendChild(renderTextWithUnderlines(s.text, s.underline));
      card.appendChild(p);
    });
    appEl.appendChild(card);

    if (multi) {
      appEl.appendChild(el("p", { class: "hint" }, ["該当するものを全て選んでください。"]));
      appEl.appendChild(renderMultiChoiceList(question));
      if (state.answered === null) {
        const submitBtn = el(
          "button",
          {
            class: "primary-button",
            onclick: () => answerMulti(question),
          },
          ["回答する"]
        );
        // Set the boolean IDL property directly rather than passing "disabled"
        // through el()'s generic setAttribute path, since setAttribute("disabled", ...)
        // would make the button disabled regardless of the value passed.
        submitBtn.disabled = state.multiSelected.length === 0;
        appEl.appendChild(submitBtn);
      }
    } else {
      appEl.appendChild(renderSingleChoiceList(question));
    }

    if (state.answered !== null) {
      appEl.appendChild(renderFeedback(question));
      appEl.appendChild(
        el(
          "button",
          {
            class: "primary-button",
            onclick: () => {
              state.answered = null;
              state.multiSelected = [];
              state.marks = {};
              if (state.queueIndex + 1 < state.queue.length) {
                state.queueIndex += 1;
              } else {
                state.screen = "result";
              }
              render();
            },
          },
          [state.queueIndex + 1 < state.queue.length ? "次の問題へ" : "結果を見る"]
        )
      );
    }
  }

  function renderSavePanel(question) {
    const saved = QuizStorage.isQuestionSaved(storage, question.id);
    const panel = el("div", { class: "saved-panel" }, []);
    const memoInput = el("textarea", { class: "memo-input", placeholder: "メモ(任意)" }, []);
    memoInput.value = QuizStorage.getMemo(storage, question.id);
    panel.appendChild(memoInput);
    panel.appendChild(
      el(
        "button",
        {
          class: "save-button" + (saved ? " selected" : ""),
          onclick: () => {
            if (saved) {
              QuizStorage.unsaveQuestion(storage, question.id);
            } else {
              QuizStorage.saveQuestion(storage, question.id, memoInput.value);
            }
            render();
          },
        },
        [saved ? "保存を解除" : "復習リストに追加"]
      )
    );
    return panel;
  }

  const MARKS = ["○", "×", "△"];

  function renderMarkGroup(value) {
    const group = el("div", { class: "mark-group" }, []);
    MARKS.forEach((mark) => {
      const active = state.marks[value] === mark;
      const btn = el(
        "button",
        {
          class: "mark-button" + (active ? " active" : ""),
          onclick: (e) => {
            e.stopPropagation();
            if (active) delete state.marks[value];
            else state.marks[value] = mark;
            render();
          },
        },
        [mark]
      );
      group.appendChild(btn);
    });
    return group;
  }

  function renderSingleChoiceList(question) {
    const choiceList = el("div", { class: "choice-list" }, []);
    question.choices.forEach((choice) => {
      const value = String(choice.value);
      const btn = el(
        "button",
        {
          class: "choice-button",
          onclick: () => answer(question, choice.value),
        },
        [choice.text || choice.value]
      );
      if (state.answered !== null) {
        btn.disabled = true;
        if (String(choice.value) === String(question.correctAnswer)) btn.classList.add("correct");
        else if (String(choice.value) === String(state.answered)) btn.classList.add("incorrect");
      }
      if (state.answered === null) {
        const row = el("div", { class: "choice-row" }, [btn, renderMarkGroup(value)]);
        choiceList.appendChild(row);
      } else {
        choiceList.appendChild(btn);
      }
    });
    return choiceList;
  }

  function renderMultiChoiceList(question) {
    const correctTokens = state.answered !== null ? new Set(splitAnswerTokens(question.correctAnswer)) : null;
    const userTokens = state.answered !== null ? new Set(state.answered.map(String)) : null;

    const choiceList = el("div", { class: "choice-list" }, []);
    question.choices.forEach((choice) => {
      const value = String(choice.value);
      const isSelected = state.multiSelected.includes(value);
      let classes = "choice-button filter-button" + (isSelected ? " selected" : "");
      if (state.answered !== null) {
        if (correctTokens.has(value)) classes += " correct";
        else if (userTokens.has(value)) classes += " incorrect";
      }
      const btn = el(
        "button",
        {
          class: classes,
          onclick: () => {
            if (state.answered !== null) return;
            const idx = state.multiSelected.indexOf(value);
            if (idx >= 0) state.multiSelected.splice(idx, 1);
            else state.multiSelected.push(value);
            render();
          },
        },
        [choice.text || choice.value]
      );
      if (state.answered !== null) btn.disabled = true;
      if (state.answered === null) {
        const row = el("div", { class: "choice-row" }, [btn, renderMarkGroup(value)]);
        choiceList.appendChild(row);
      } else {
        choiceList.appendChild(btn);
      }
    });
    return choiceList;
  }

  function renderFeedback(question) {
    const multi = isMultiSelectQuestion(question);
    const correct = multi
      ? checkMultiAnswer(question, state.answered)
      : QuizLogic.isCorrect(question, state.answered);
    const wrap = el("div", { class: "explanation" }, []);
    wrap.appendChild(
      el("p", { class: correct ? "verdict-correct" : "verdict-incorrect" }, [
        correct ? "正解" : "不正解",
      ])
    );
    if (multi) {
      wrap.appendChild(el("p", {}, [`正解: ${question.correctAnswer}`]));
    }
    if (question.correctRate) {
      wrap.appendChild(el("p", {}, [`正解率: ${question.correctRate}`]));
    }
    if (question.statementAnswers) {
      const text = Object.entries(question.statementAnswers)
        .map(([label, mark]) => `${label}${mark}`)
        .join(" ");
      wrap.appendChild(el("p", {}, [text]));
    }
    (question.explanation || []).forEach((e) => {
      wrap.appendChild(
        el("p", {}, [
          `${e.label}は${e.verdict}。${e.text}`,
        ])
      );
    });
    return wrap;
  }

  function answer(question, value) {
    if (state.answered !== null) return;
    const correct = QuizLogic.isCorrect(question, value);
    state.answered = value;
    state.results.push({ id: question.id, correct });
    QuizStorage.recordResult(storage, question.id, correct);
    QuizStorage.incrementAnswerCount(storage, question.id);
    render();
  }

  function answerMulti(question) {
    if (state.answered !== null || state.multiSelected.length === 0) return;
    const correct = checkMultiAnswer(question, state.multiSelected);
    state.answered = state.multiSelected.slice();
    state.results.push({ id: question.id, correct });
    QuizStorage.incrementAnswerCount(storage, question.id);
    QuizStorage.recordResult(storage, question.id, correct);
    render();
  }

  function renderResult() {
    const score = QuizLogic.computeScore(state.results);
    appEl.appendChild(el("h2", {}, ["結果"]));
    appEl.appendChild(el("p", {}, [`${score.correct} / ${score.total} 問正解`]));

    const wrongInThisSession = state.queue.filter((_, i) => state.results[i] && !state.results[i].correct);
    if (wrongInThisSession.length > 0) {
      appEl.appendChild(el("h3", {}, ["誤答した問題"]));
      const list = el("div", { class: "choice-list" }, []);
      wrongInThisSession.forEach((q) => {
        list.appendChild(el("div", { class: "card" }, [q.title]));
      });
      appEl.appendChild(list);
    }

    appEl.appendChild(
      el("button", { class: "primary-button", onclick: goHome }, ["ホームへ戻る"])
    );
  }

  render();
})();
