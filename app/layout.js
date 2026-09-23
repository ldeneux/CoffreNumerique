import "./globals.css";

export const metadata = {
  title: "Coffre numérique",
  description: "Contacts et documents administratifs de la famille",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
