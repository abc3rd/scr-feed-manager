/**
 * Google Tag Manager bridge — SCR Feed (customer store)
 * =====================================================
 * The GTM container (GTM-WQ6JL96J, "scr-feed-co") is loaded in index.html.
 * This module pushes page views and business events into window.dataLayer,
 * where GTM tags (GA4 Configuration + GA4 Event tags) consume them.
 * Configure the GA4 Measurement ID and triggers inside GTM, not here.
 *
 * Event names pushed from the app:
 *   spa_page_view, add_to_cart
 * (extend with begin_checkout / purchase from the cart + order-success flow)
 */
export function pushEvent(payload) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

export function trackPageView(path) {
  pushEvent({
    event: 'spa_page_view',
    page_path: path,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
    page_location: typeof window !== 'undefined' ? window.location.href : undefined,
  });
}

export function track(event, params = {}) {
  pushEvent({ event, ...params });
}
