import "@fontsource/lxgw-wenkai-tc";
import "./globals.css";

export const metadata = {
  title: "漂洋過海的信",
  description: "一封有侨批质感的繁体家书生成器。",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
