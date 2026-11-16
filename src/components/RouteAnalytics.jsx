import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';

/**
 * Sends a GTM page_view on every client-side route change. This app uses real
 * (non-hash) routing, so without this only the first load would be counted.
 * Rendered inside <Router>.
 */
export default function RouteAnalytics() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}
