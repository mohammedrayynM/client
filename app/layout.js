import './globals.css';
import Providers from '@/components/Providers';
import OneTapLogin from '@/components/OneTapLogin';

export const metadata = {
  title: 'Book Arena — Book Sports Turfs Online',
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
        <script src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`} async defer></script>
      </head>
      <body>
        <Providers>
          <OneTapLogin />
          {children}
        </Providers>
      </body>
    </html>
  );
}
