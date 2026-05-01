import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: {
    default: 'PKS - Home',
    template: 'PKS - %s',
  },
  description: 'Budgeting app for PKS',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
