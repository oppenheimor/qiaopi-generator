import prisma from "@/lib/prisma";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const pageSize = 20;

export const metadata = {
  title: "侨批生成统计",
};

export default async function AdminPage({ searchParams }) {
  const params = await searchParams;
  const currentPage = normalizePage(params?.page);
  const total = await prisma.generationLog.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(currentPage, totalPages);
  const logs = await prisma.generationLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  const stats = buildStats(logs, total);

  return (
    <main className={styles.adminShell}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Qiaopi Admin</p>
          <h1>生成数据统计</h1>
        </div>
        <p>共 {total} 条记录，第 {page} / {totalPages} 页</p>
      </header>

      <section className={styles.statsGrid} aria-label="统计摘要">
        <StatCard label="总生成量" value={total} />
        <StatCard label="本页平均耗时" value={`${stats.averageDurationMs} ms`} />
        <StatCard label="DeepSeek 成功" value={stats.deepseekCount} />
        <StatCard label="失败记录" value={stats.errorCount} />
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.tableScroller}>
          <table>
            <thead>
              <tr>
                <th>时间1</th>
                <th>来源</th>
                <th>耗时</th>
                <th>用户输入</th>
                <th>生成结果</th>
                <th>身份线索</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <time dateTime={log.createdAt.toISOString()}>{formatDate(log.createdAt)}</time>
                    <span className={styles.muted}>{log.requestId}</span>
                  </td>
                  <td>
                    <span className={sourceClassName(log.source)}>{log.source}</span>
                    {log.model ? <span className={styles.muted}>{log.model}</span> : null}
                  </td>
                  <td>{log.durationMs} ms</td>
                  <td>
                    <div className={styles.inputBlock}>
                      <strong>{log.senderRelation || "-"} {log.senderName || "-"}</strong>
                      <span>致 {log.recipientRelation || "-"} {log.recipientName || "-"}</span>
                      <span>寄信地：{log.input?.fromPlace || "-"}</span>
                      <span>收信地：{log.input?.toPlace || "-"}</span>
                      <span>语气/长短：{log.tone || "-"} · {log.length || "-"}</span>
                      <span>随信寄上：{log.attachmentType || "-"} · {log.input?.attachment || "-"}</span>
                      <p>{log.input?.message || "-"}</p>
                    </div>
                  </td>
                  <td>
                    <div className={styles.resultBlock}>
                      {log.error ? <p className={styles.errorText}>{log.error}</p> : null}
                      <p>{log.result?.plainText || "-"}</p>
                    </div>
                  </td>
                  <td>
                    <div className={styles.identityBlock}>
                      <span>{log.ipAddress || "IP 未记录"}</span>
                      <span>{[log.country, log.city].filter(Boolean).join(" / ") || "地区未记录"}</span>
                      <span>{log.acceptLanguage || "语言未记录"}</span>
                      <span title={log.userAgent || ""}>{log.userAgent || "UA 未记录"}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.empty}>还没有生成记录。</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <nav className={styles.pagination} aria-label="分页">
        <a aria-disabled={page <= 1} href={`/qiaopi/admin?page=${Math.max(1, page - 1)}`}>上一页</a>
        <span>{page} / {totalPages}</span>
        <a aria-disabled={page >= totalPages} href={`/qiaopi/admin?page=${Math.min(totalPages, page + 1)}`}>下一页</a>
      </nav>
    </main>
  );
}

function normalizePage(value) {
  const page = Number.parseInt(String(value || "1"), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildStats(logs, total) {
  const averageDurationMs = logs.length
    ? Math.round(logs.reduce((sum, log) => sum + log.durationMs, 0) / logs.length)
    : 0;

  return {
    averageDurationMs,
    deepseekCount: logs.filter((log) => log.source === "deepseek").length,
    errorCount: logs.filter((log) => log.error).length,
    total,
  };
}

function StatCard({ label, value }) {
  return (
    <article className={styles.statCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "medium",
    hour12: false,
  }).format(date);
}

function sourceClassName(source) {
  return source === "deepseek" ? styles.sourceOk : styles.sourceWarn;
}
