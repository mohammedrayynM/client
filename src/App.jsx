import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Providers from './components/Providers';
import OneTapLogin from './components/OneTapLogin';
import MatchNotification from './components/MatchNotification';
import AdPopupModal from './components/AdPopupModal';
import ScrollToTop from './components/ScrollToTop';
import { setJsonLd } from './lib/seo';

// Pages
import Home from './pages/Home';
import About from './pages/About';
import FounderProfile from './pages/FounderProfile';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Privacy from './pages/Privacy';
import DeleteAccount from './pages/DeleteAccount';
import Profile from './pages/Profile';
import Refund from './pages/Refund';
import Terms from './pages/Terms';
import Turfs from './pages/Turfs';
import TurfDetail from './pages/TurfDetail';
import BookingSuccess from './pages/BookingSuccess';
import PaymentResult from './pages/PaymentResult';
import MyPlans from './pages/MyPlans';
import FindPlayers from './pages/FindPlayers';
import MatchDetail from './pages/MatchDetail';
import MatchRequestPublic from './pages/MatchRequestPublic';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';

// Activities & Amusement Parks
import ActivitiesList from './pages/activities/ActivitiesList';
import ActivityDetail from './pages/activities/ActivityDetail';
import ActivityBooking from './pages/activities/ActivityBooking';
import ActivityPass from './pages/activities/ActivityPass';

// Tournaments & Players
import TournamentsList from './pages/tournaments/TournamentsList';
import TournamentDetail from './pages/tournaments/TournamentDetail';
import TournamentJoin from './pages/tournaments/TournamentJoin';
import TournamentCreate from './pages/tournaments/TournamentCreate';
import LiveMatchCenter from './pages/tournaments/LiveMatchCenter';
import PlayerProfile from './pages/players/PlayerProfile';

// Admin
import AdminRedirect from './pages/admin/AdminRedirect';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';

// Owner
import OwnerLogin from './pages/owner/OwnerLogin';
import OwnerRegister from './pages/owner/OwnerRegister';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import ActivityManagement from './pages/owner/ActivityManagement';

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  // Global (site-wide) structured data. Kept minimal and safe for SPA.
  useEffect(() => {
    setJsonLd({
      id: 'org',
      data: {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        '@id': 'https://bookarena.in/#organization',
        name: 'Book Arena',
        url: 'https://bookarena.in/',
        logo: 'https://bookarena.in/images/book-arena-logo.png',
        founder: { '@id': 'https://bookarena.in/about/founder#person' },
        contactPoint: [{
          '@type': 'ContactPoint',
          telephone: '+91 89034 95256',
          contactType: 'customer support',
          areaServed: 'IN',
          availableLanguage: ['en']
        }]
      }
    });
  }, []);

  return (
    <Providers>
      <Router>
        <ScrollToTop />
        <OneTapLogin />
        <MatchNotification />
        <AdPopupModal placement="HOME" />
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/about/founder" element={<FounderProfile />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/refund" element={<Refund />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/turfs" element={<Turfs />} />
            <Route path="/turfs/:id" element={<TurfDetail />} />
            <Route path="/booking/success" element={<BookingSuccess />} />
            <Route path="/payment-success" element={<PaymentResult />} />
            <Route path="/payment-cancelled" element={<PaymentResult />} />
            <Route path="/payment-failed" element={<PaymentResult />} />
            <Route path="/payment-pending" element={<PaymentResult />} />
            <Route path="/my-plans" element={<MyPlans />} />
            <Route path="/find-players" element={<FindPlayers />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/match/:id" element={<MatchDetail />} />
            <Route path="/match-request/:token" element={<MatchRequestPublic />} />
            <Route path="/join/:token" element={<MatchRequestPublic />} />

            {/* Amusement Parks & Activities Routes */}
            <Route path="/activities" element={<ActivitiesList />} />
            <Route path="/amusement-parks" element={<ActivitiesList />} />
            <Route path="/activities/:slug" element={<ActivityDetail />} />
            <Route path="/activities/:slug/book" element={<ActivityBooking />} />
            <Route path="/activities/:slug/checkout" element={<ActivityBooking />} />
            <Route path="/my-tickets/:id" element={<ActivityPass />} />

            {/* Tournament Routes */}
            <Route path="/tournaments" element={<TournamentsList />} />
            <Route path="/tournaments/create" element={<TournamentCreate />} />
            <Route path="/tournaments/join/:token" element={<TournamentJoin />} />
            <Route path="/tournaments/:slug" element={<TournamentDetail />} />
            <Route path="/tournaments/:slug/matches/:matchId/live" element={<LiveMatchCenter />} />
            <Route path="/players/:id" element={<PlayerProfile />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<AdminRedirect />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />

            {/* Owner Routes */}
            <Route path="/owner/login" element={<OwnerLogin />} />
            <Route path="/owner/register" element={<OwnerRegister />} />
            <Route path="/owner/dashboard" element={<OwnerDashboard />} />
            <Route path="/owner/activities" element={<ActivityManagement />} />
          </Routes>
        </ErrorBoundary>
      </Router>
    </Providers>
  );
}

export default App;
