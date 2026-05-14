"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

const historyStorageKey = "qiaopi.generatedLetters";

export default function HistoryDetailPage({ params }) {
  const { id } = use(params);
  const [entry, setEntry] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const resultRef = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const history = readStoredHistory();
      setEntry(history.find((item) => item.id === id) || null);
      setIsReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [id]);

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
        title: entry?.letter?.shareTitle || entry?.letter?.envelope?.title || "一封漂洋過海的信",
        text: "我用線上銀信局寫了一封漂洋過海的信。",
      };

      if (navigator.canShare?.({ files: shareData.files })) {
        await navigator.share(shareData);
        setShareNotice("已打開分享面板。");
        return;
      }

      downloadCanvas(canvas);
      setShareNotice("此瀏覽器暫不支援直接分享圖片，已改為下載圖片。");
    } catch (error) {
      if (error?.name === "AbortError") {
        setShareNotice("已取消分享。");
        return;
      }
      setShareNotice("分享圖片失敗，請稍後再試。");
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <Link className={styles.backLink} href="/history">← 返回歷史</Link>
      </section>

      <section className={styles.detailStage}>
        {!isReady ? <p className={styles.empty}>正在取出舊信……</p> : null}
        {isReady && !entry ? (
          <div className={styles.emptyPanel}>
            <p>可能是這台設備沒有這條 localStorage 記錄，或瀏覽器資料已被清理。</p>
            <Link href="/history">回到歷史列表</Link>
          </div>
        ) : null}
        {entry ? (
          <div className={styles.resultStack}>
            <LetterPaper letter={entry.letter} resultRef={resultRef} />
            <div className={styles.actions}>
              <Link href="/">繼續寫信</Link>
              <button type="button" onClick={shareImage} disabled={isSharing}>
                {isSharing ? "準備分享…" : "分享圖片"}
              </button>
            </div>
            {shareNotice ? <p className={styles.shareNotice}>{shareNotice}</p> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function LetterPaper({ letter, resultRef }) {
  const letterContent = [
    letter?.letter?.greeting,
    ...(letter?.letter?.body || []),
    letter?.letter?.postscript,
  ].join("");
  const columns = splitIntoColumns(letterContent, 18, 5);

  return (
    <article className={styles.letterPaper} ref={resultRef}>
      <div className={styles.paperHeader}>信紙</div>
      <div className={styles.paperBody}>
        <section className={styles.letterText} aria-label="信件正文">
          {columns.map((column, index) => (
            <p key={`${column}-${index}`}>{column}</p>
          ))}
        </section>
        <aside className={styles.paperMeta}>
          <VerticalText text={letter?.letter?.signature} />
          <VerticalText text={letter?.letter?.date} />
        </aside>
      </div>
      <footer>{letter?.safetyNote}</footer>
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

function readStoredHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.id && item?.letter);
  } catch {
    return [];
  }
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

function downloadCanvas(canvas) {
  const link = document.createElement("a");
  link.download = "漂洋過海的信.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}
