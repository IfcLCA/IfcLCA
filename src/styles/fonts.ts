import localFont from "next/font/local";

export const nunitoSans = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource/nunito-sans/files/nunito-sans-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/nunito-sans/files/nunito-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/nunito-sans/files/nunito-sans-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource/nunito-sans/files/nunito-sans-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-nunito-sans",
});
