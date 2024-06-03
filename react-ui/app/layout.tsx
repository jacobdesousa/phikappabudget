import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Phi Kappa Budget",
  description: "Budgeting app for PKS",
};

const axios = require("axios").default;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  axios.defaults.baseURL = "http://localhost:8080";
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
