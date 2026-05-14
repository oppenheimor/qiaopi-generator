"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./page.module.css";

const attachmentDefaults = {
  家用: "二百元，聊充家用",
  學費: "學費若干，望先付學塾",
  藥費: "藥費若干，望先調養身體",
  衣物: "衣料一包，望裁作冬衣",
  米糧: "米糧錢若干，望補家中用度",
  銀元: "銀元若干，聊充家用",
  物件: "家用物件一份",
  其他: "另附一份家中所需",
};

const initialForm = {
  recipientRelation: "妻",
  recipientName: "淑柔",
  senderRelation: "夫",
  senderName: "木生",
  fromPlace: "南洋",
  toPlace: "潮汕鄉里",
  tone: "思念",
  length: "普通",
  attachmentType: "家用",
  message: "你好嗎？我在外一切還算平安，只是常常想你。家中若有缺用，先拿這些錢補貼。等事情安定，我會再設法回來。",
  attachment: attachmentDefaults.家用,
};

const relationOptions = ["妻", "夫", "母", "父", "子", "女", "兄", "弟", "姊", "妹", "友人", "族親"];
const toneOptions = ["報平安", "思念", "歉疚", "托付家用", "勸慰", "祝福"];
const lengthOptions = ["短箋", "普通"];
const attachmentTypes = ["家用", "學費", "藥費", "衣物", "米糧", "銀元", "物件", "其他"];

const loadingLines = [
  "代筆先生正在研墨……",
  "銀信局正在核對姓名……",
  "老紙鋪正在裁箋……",
  "小楷字句正在斟酌……",
  "鄉音口氣正在拿捏……",
  "家用銀兩正在寫明……",
  "遠洋風信正在入紙……",
  "牽掛字眼正在收束……",
  "墨跡未乾，請稍候……",
  "信封將啟，家書將至……",
];

const loadingLineDelays = [1800, 2600, 2200, 3400, 2400, 4200, 3000];
const historyStorageKey = "qiaopi.generatedLetters";

function BrushIcon() {
  return (
    <svg className={styles.brushIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14.7 4.2 19.8 9.3" />
      <path d="M13.8 5.1 5.9 13c-.9.9-1.3 2-1.2 3.2" />
      <path d="M18.9 10.2 11 18.1c-.9.9-2 1.3-3.2 1.2" />
      <path d="M5 15.7c-1.2 1.4-1.5 3-1.1 4.4 1.4.4 3 .1 4.4-1.1" />
      <path d="M16.1 2.8 21.2 7.9" />
    </svg>
  );
}

export default function Home() {
  const [form, setForm] = useState(initialForm);
  const [phase, setPhase] = useState("form");
  const [letter, setLetter] = useState(null);
  const [error, setError] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const resultRef = useRef(null);

  const canSubmit = form.recipientName.trim() && form.senderName.trim() && form.message.trim();

  useEffect(() => {
    if (phase !== "loading") return undefined;

    let delayIndex = 0;
    let timer;

    function queueNextLine() {
      timer = window.setTimeout(() => {
        setLoadingIndex((index) => (index + 1) % loadingLines.length);
        delayIndex = (delayIndex + 1) % loadingLineDelays.length;
        queueNextLine();
      }, loadingLineDelays[delayIndex]);
    }

    queueNextLine();

    return () => window.clearTimeout(timer);
  }, [phase]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateAttachmentType(value) {
    setForm((current) => ({
      ...current,
      attachmentType: value,
      attachment: attachmentDefaults[value] ?? "",
    }));
  }

  async function generateLetter(event) {
    event.preventDefault();
    if (!canSubmit) {
      setError("請先填好姓名與心裡話。");
      return;
    }

    setError("");
    setShareNotice("");
    setPhase("loading");
    setLoadingIndex(0);

    try {
      console.info("[qiaopi] submit generate-letter", {
        phase: "request",
        recipientRelation: form.recipientRelation,
        senderRelation: form.senderRelation,
        tone: form.tone,
        length: form.length,
        attachmentType: form.attachmentType,
      });
      const response = await fetch("/qiaopi/api/generate-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      console.info("[qiaopi] generate-letter response", {
        ok: response.ok,
        status: response.status,
        debug: data?._debug,
      });
      if (!response.ok) {
        throw new Error(data.error || "生成失敗，請稍後再試。");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      saveHistoryEntry(form, data);
      setLetter(data);
      setPhase("envelope");
    } catch (err) {
      setError(err.message);
      setPhase("form");
    }
  }

  function saveHistoryEntry(input, result) {
    const entry = {
      id: createHistoryId(),
      createdAt: new Date().toISOString(),
      form: { ...input },
      letter: removeDebugData(result),
    };
    const nextHistory = [entry, ...readStoredHistory()];
    persistHistory(nextHistory);
  }

  function createHistoryId() {
    return `history-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function copyText() {
    if (!letter?.plainText) return;
    await navigator.clipboard.writeText(letter.plainText);
  }

  async function shareImage() {
    if (!resultRef.current || isSharing) return;

    setIsSharing(true);
    setShareNotice("");

    try {
      const html2canvas = (await import("html2canvas")).default;
      const exportNode = createShareImageNode(resultRef.current);
      document.body.appendChild(exportNode);
      let canvas;
      try {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        canvas = await html2canvas(exportNode, {
          backgroundColor: "#efe2c3",
          scale: Math.min(window.devicePixelRatio || 2, 3),
        });
      } finally {
        exportNode.remove();
      }
      const file = await canvasToPngFile(canvas, "漂洋過海的信.png");
      const shareData = {
        files: [file],
        title: letter?.shareTitle || letter?.envelope?.title || "一封漂洋過海的信",
        text: "我用線上銀信局寫了一封漂洋過海的信。",
      };

      if (navigator.canShare?.({ files: shareData.files })) {
        await navigator.share(shareData);
        setShareNotice("已打開分享面板。");
        return;
      }

      downloadCanvas(canvas);
      setShareNotice("此瀏覽器暫不支援直接分享圖片，已改為下載圖片。");
    } catch (err) {
      if (err?.name === "AbortError") {
        setShareNotice("已取消分享。");
        return;
      }
      setShareNotice("分享圖片失敗，請稍後再試。");
    } finally {
      setIsSharing(false);
    }
  }

  function downloadCanvas(canvas) {
    const link = document.createElement("a");
    link.download = "漂洋過海的信.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <main className={styles.shell}>
      {phase === "form" ? (
        <>
          <section className={styles.hero}>
            <p className={styles.kicker}>給阿嬤的情書 · 線上銀信局</p>
            <h1>漂洋過海的信</h1>
            <p className={styles.lede}>
              把今日說不出口的牽掛，託代筆先生寫成一封繁體侨批家書。紙短情長，伏惟珍重。
            </p>
            <p className={styles.teamCredit}>“合契 AI”團隊製作</p>
          </section>

          <section className={styles.formStage}>
            <form className={styles.formPanel} onSubmit={generateLetter}>
              <div className={styles.panelHead}>
                <span>一</span>
                <div>
                  <h2>寫信資料</h2>
                  <p>用白話寫，餘下交給代筆先生。</p>
                </div>
              </div>

              <FieldGroup title="致 · 收信人">
                <label className={styles.compactField}>
                  <Picker
                    // label="關係"
                    value={form.recipientRelation}
                    options={relationOptions}
                    onChange={(value) => updateField("recipientRelation", value)}
                  />
                </label>
                <label className={styles.field}>
                  {/* <span>姓名</span> */}
                  <input value={form.recipientName} onChange={(event) => updateField("recipientName", event.target.value)} />
                </label>
              </FieldGroup>

              <FieldGroup title="自 · 寄信人">
                <label className={styles.compactField}>
                  <Picker
                    // label="關係"
                    value={form.senderRelation}
                    options={relationOptions}
                    onChange={(value) => updateField("senderRelation", value)}
                  />
                </label>
                <label className={styles.field}>
                  {/* <span>姓名</span> */}
                  <input value={form.senderName} onChange={(event) => updateField("senderName", event.target.value)} />
                </label>
              </FieldGroup>

              <div className={styles.twoCols}>
                <label className={styles.field}>
                  <span>寄信地</span>
                  <input value={form.fromPlace} onChange={(event) => updateField("fromPlace", event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>收信地</span>
                  <input value={form.toPlace} onChange={(event) => updateField("toPlace", event.target.value)} />
                </label>
              </div>

              <div className={styles.twoCols}>
                <label className={styles.field}>
                  <Picker
                    label="語氣"
                    value={form.tone}
                    options={toneOptions}
                    onChange={(value) => updateField("tone", value)}
                  />
                </label>
                <label className={styles.field}>
                  <Picker
                    label="長短"
                    value={form.length}
                    options={lengthOptions}
                    onChange={(value) => updateField("length", value)}
                  />
                </label>
              </div>

              <label className={styles.textareaField}>
                <span>心裡話 · 用大白話寫</span>
                <textarea value={form.message} onChange={(event) => updateField("message", event.target.value)} />
              </label>

              <FieldGroup title="隨信寄上">
                <label className={styles.compactField}>
                  <Picker
                    // label="類型"
                    value={form.attachmentType}
                    options={attachmentTypes}
                    onChange={updateAttachmentType}
                  />
                </label>
                <label className={styles.field}>
                  {/* <span>內容</span> */}
                  <input value={form.attachment} onChange={(event) => updateField("attachment", event.target.value)} />
                </label>
              </FieldGroup>

              {error ? <p className={styles.error}>{error}</p> : null}

              <button className={styles.submitButton} type="submit" disabled={!canSubmit || phase === "loading"}>
                {phase === "loading" ? (
                  "正在代筆"
                ) : (
                  <>
                    <span>請銀信局先生代筆</span>
                    <BrushIcon />
                  </>
                )}
              </button>
              <Link className={styles.historyLink} href="/history">
                查看生成歷史 →
              </Link>
            </form>
          </section>
        </>
      ) : null}

      {phase === "loading" ? (
        <section className={styles.stagePanel}>
          <LoadingView line={loadingLines[loadingIndex]} />
        </section>
      ) : null}

      {phase === "envelope" && letter ? (
        <section className={styles.stagePanel}>
          <Envelope letter={letter} onOpen={() => setPhase("letter")} />
        </section>
      ) : null}

      {phase === "letter" && letter ? (
        <section className={styles.stagePanel}>
          <div className={styles.resultStack}>
            <LetterPaper letter={letter} resultRef={resultRef} />
            <div className={styles.actions}>
              <button type="button" onClick={() => setPhase("form")}>重寫資料</button>
              <Link className={styles.actionLink} href="/history">生成歷史</Link>
              <button type="button" onClick={shareImage} disabled={isSharing}>
                {isSharing ? "準備分享…" : "分享圖片"}
              </button>
            </div>
            {shareNotice ? <p className={styles.shareNotice}>{shareNotice}</p> : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function FieldGroup({ title, children }) {
  return (
    <fieldset className={styles.fieldGroup}>
      <legend>{title}</legend>
      <div>{children}</div>
    </fieldset>
  );
}

function Picker({ label, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);
  const labelId = useId();
  const hasLabel = Boolean(label);

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (!pickerRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function selectOption(option) {
    onChange(option);
    setIsOpen(false);
  }

  return (
    <div className={hasLabel ? styles.picker : styles.pickerNoLabel} ref={pickerRef}>
      {hasLabel ? <span id={labelId}>{label}</span> : null}
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={hasLabel ? undefined : "選擇項目"}
        aria-labelledby={hasLabel ? labelId : undefined}
        className={styles.pickerTrigger}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{value}</span>
        <span aria-hidden="true" className={styles.pickerChevron} />
      </button>

      {isOpen ? (
        <div className={styles.pickerLayer}>
          <button
            aria-label="關閉選單"
            className={styles.pickerBackdrop}
            type="button"
            onClick={() => setIsOpen(false)}
          />
          <div
            aria-label={hasLabel ? undefined : "選擇項目"}
            aria-labelledby={hasLabel ? labelId : undefined}
            className={styles.pickerMenu}
            role="listbox"
            tabIndex={-1}
          >
            <div className={styles.pickerSheetHead}>
              <strong>{label || "請選擇"}</strong>
              <button type="button" onClick={() => setIsOpen(false)}>完成</button>
            </div>
            <div className={styles.pickerOptions}>
              {options.map((option) => (
                <button
                  aria-selected={option === value}
                  className={option === value ? styles.pickerOptionActive : styles.pickerOption}
                  key={option}
                  role="option"
                  type="button"
                  onClick={() => selectOption(option)}
                >
                  <span>{option}</span>
                  {option === value ? <span aria-hidden="true">✓</span> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LoadingView({ line }) {
  return (
    <div className={styles.loadingCard}>
      <div className={styles.sealMark}>銀信</div>
      <h2>{line}</h2>
      <p>侨批 · 海外華僑通過民間渠道寄回國內的書信與匯款</p>
      <div className={styles.inkBar}><span /></div>
    </div>
  );
}

function Envelope({ letter, onOpen }) {
  return (
    <article className={styles.envelope}>
      <div className={styles.envelopeTop}>信封</div>
      <div className={styles.stamp}>{letter.envelope.bureauName}</div>
      <div className={styles.redBand} />
      <p className={styles.envelopeRecipient}>{letter.envelope.recipientLine}</p>
      <h2>{letter.envelope.title}</h2>
      <p className={styles.envelopeSender}>{letter.envelope.senderLine}</p>
      <p className={styles.envelopeMotto}>{letter.envelope.sideMotto}</p>
      <p className={styles.serial}>{letter.envelope.serialNo}</p>
      <button type="button" onClick={onOpen}>拆信</button>
    </article>
  );
}

function LetterPaper({ letter, resultRef }) {
  const letterContent = [
    letter.letter.greeting,
    ...letter.letter.body,
    letter.letter.postscript,
  ].join("");
  const columns = splitIntoColumns(letterContent, 18, 5);

  return (
    <article ref={resultRef} className={styles.letterPaper}>
      <div className={styles.paperHeader}>信紙</div>
      <div className={styles.paperBody}>
        <section className={styles.letterText} aria-label="信件正文">
          {columns.map((column, index) => (
            <p key={`${column}-${index}`}>{column}</p>
          ))}
        </section>
        <aside className={styles.paperMeta}>
          <VerticalText text={letter.letter.signature} />
          <VerticalText text={letter.letter.date} />
        </aside>
      </div>
      <footer>{letter.safetyNote}</footer>
    </article>
  );
}

function VerticalText({ text }) {
  return (
    <span className={styles.verticalText}>
      {splitVerticalMarks(text).map((mark, index) => (
        <i key={`${mark}-${index}`}>{mark}</i>
      ))}
    </span>
  );
}

function splitIntoColumns(text, columnSize, maxColumns) {
  const cleanText = String(text || "")
    .replace(/\s+/g, "")
    .replace(/。/g, "。")
    .slice(0, columnSize * maxColumns);
  const columns = [];
  for (let index = 0; index < cleanText.length; index += columnSize) {
    columns.push(cleanText.slice(index, index + columnSize));
  }
  return columns;
}

function splitVerticalMarks(text) {
  return String(text || "")
    .replace(/\s+/g, "")
    .split("");
}

function readStoredHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry?.id && entry?.letter);
  } catch {
    return [];
  }
}

function persistHistory(history) {
  try {
    localStorage.setItem(historyStorageKey, JSON.stringify(history));
  } catch {
    const trimmedHistory = history.slice(0, Math.max(1, history.length - 1));
    if (trimmedHistory.length === history.length) return;
    persistHistory(trimmedHistory);
  }
}

function canvasToPngFile(canvas, fileName) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("無法生成圖片。"));
        return;
      }
      resolve(new File([blob], fileName, { type: "image/png" }));
    }, "image/png");
  });
}

function createShareImageNode(sourceNode) {
  const exportWidth = Math.round(
    window.visualViewport?.width ||
    window.innerWidth ||
    document.documentElement.clientWidth ||
    sourceNode.getBoundingClientRect().width
  );
  const clone = sourceNode.cloneNode(true);

  clone.style.position = "fixed";
  clone.style.left = "-10000px";
  clone.style.top = "0";
  clone.style.width = `${exportWidth}px`;
  clone.style.maxWidth = "none";
  clone.style.margin = "0";
  clone.style.boxSizing = "border-box";

  return clone;
}

function removeDebugData(letter) {
  const rest = { ...(letter || {}) };
  delete rest._debug;
  return rest;
}
