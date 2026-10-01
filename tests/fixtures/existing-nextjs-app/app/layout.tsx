import type { ReactNode } from "react";

export const metadata = {
  title: "Fixture Next.js",
  description: "Fixture d'adoption du starter universel",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

