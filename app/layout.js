import './globals.css'

export const metadata = {
  title: 'Ekip Panosu',
  description: 'Ekip görev takip panosu',
}

export default function RootLayout({ children }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  )
}
