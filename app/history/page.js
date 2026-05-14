"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

const historyStorageKey = "qiaopi.generatedLetters";

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHistory(readStoredHistory());
      setIsReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <Link className={styles.backLink} href="/">← 返回寫信</Link>
        <p className={styles.kicker}>舊信匣</p>
        <h1>往日字跡</h1>
      </section>

      <section className={styles.historyStage}>
        <div className={styles.historyPanel} aria-label="生成歷史列表">
          {!isReady ? <p className={styles.empty}>正在翻找舊信……</p> : null}
          {isReady && !history.length ? <p className={styles.empty}>舊信匣尚空，待第一封海上來書入藏。</p> : null}
          {history.length ? (
            <ol className={styles.historyList}>
              {history.map((entry) => (
                <li key={entry.id}>
                  <Link href={`/history/${encodeURIComponent(entry.id)}`}>
                    <strong>{getEntryTitle(entry)}</strong>
                    <span>{formatEntrySubtitle(entry)}</span>
                    <time dateTime={entry.createdAt}>{formatHistoryTime(entry.createdAt)}</time>
                  </Link>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </section>
    </main>
  );
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

function getEntryTitle(entry) {
  const letter = entry?.letter;
  const bodyTitle = [
    letter?.letter?.greeting,
    ...(letter?.letter?.body || []),
    letter?.letter?.postscript,
  ]
    .join("")
    .replace(/\s+/g, "");
  return bodyTitle || letter?.plainText?.replace(/\s+/g, "") || "舊信";
}

function formatEntrySubtitle(entry) {
  const form = entry.form || {};
  const recipient = [form.recipientName, form.recipientRelation].filter(Boolean).join(" · ");
  const sender = [form.senderName, form.senderRelation].filter(Boolean).join(" · ");
  return [sender, recipient].filter(Boolean).join(" → ") || entry.letter?.envelope?.recipientLine || "本地保存";
}

function formatHistoryTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
