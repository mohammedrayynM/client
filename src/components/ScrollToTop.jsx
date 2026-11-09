import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    // Always scroll to top on navigation (all clicks / route changes).
    // Small timeout helps when the next page has heavy layout/imagery.
    const t = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }, 0);

    return () => clearTimeout(t);
  }, [location.pathname, location.search]);

  return null;
}

