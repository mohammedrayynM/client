import './globals.css';

export const metadata = {
  title: 'BookMyArena — Book Sports Turfs Online',
  description: 'Find and book the best sports turfs near you. Cricket, Football, Badminton, Tennis and more. Instant booking with secure payment.',
  keywords: 'sports booking, turf booking, cricket turf, football ground, badminton court, online booking',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#050b18" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
