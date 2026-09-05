import { useCallback, useEffect, useRef, useState } from 'react';
import { analyticsDisabled, getStorefrontVisitorId } from '../analytics';
import { useCart } from '../context/CartContext';
import { addCouponToCheckoutPath, PENDING_COUPON_STORAGE_KEY } from '../checkoutIntent';
import './StorefrontNotifications.css';

const PUSH_SYNC_STORAGE_KEY = 'geelark_push_sync_at';

function base64UrlToUint8Array(value) {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function timeAgo(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export default function StorefrontNotifications() {
  const { navigateTo, cartItemCount } = useCart();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [pushState, setPushState] = useState('checking');
  const rootRef = useRef(null);
  const visitorIdRef = useRef(null);
  const initialFetchRef = useRef(true);
  const pushRegistrationRef = useRef(null);
  const pushSubscriptionRef = useRef(null);
  const vapidPublicKeyRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    const visitorId = getStorefrontVisitorId();
    if (!visitorId) return;
    visitorIdRef.current = visitorId;
    try {
      const response = await fetch(`/api/notifications?visitor_id=${encodeURIComponent(visitorId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) return;
      const nextNotifications = Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications(nextNotifications);
      if (!initialFetchRef.current && Number(data.unread_count || 0) > 0) {
        setAnnouncement(`${data.unread_count} unread site notification${data.unread_count === 1 ? '' : 's'} available.`);
      }
      initialFetchRef.current = false;
    } catch {
      // The notification feed is supplementary; storefront actions stay available.
    }
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(fetchNotifications, 900);
    const pollTimer = window.setInterval(() => {
      if (!document.hidden) fetchNotifications();
    }, 60000);
    const onVisibilityChange = () => {
      if (!document.hidden) fetchNotifications();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const cartRefreshTimer = window.setTimeout(fetchNotifications, 1200);
    return () => window.clearTimeout(cartRefreshTimer);
  }, [cartItemCount, fetchNotifications]);

  useEffect(() => {
    let cancelled = false;
    const preparePush = async () => {
      if (analyticsDisabled()) {
        setPushState('privacy');
        return;
      }
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setPushState('unsupported');
        return;
      }
      try {
        const configResponse = await fetch('/api/push/config', { cache: 'no-store' });
        const config = await configResponse.json();
        if (!configResponse.ok || !config.enabled || !config.public_key) {
          setPushState('unconfigured');
          return;
        }
        vapidPublicKeyRef.current = config.public_key;
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        const readyRegistration = await navigator.serviceWorker.ready;
        const subscription = await readyRegistration.pushManager.getSubscription();
        if (cancelled) return;
        pushRegistrationRef.current = registration;
        pushSubscriptionRef.current = subscription;
        if (subscription && Notification.permission === 'granted') {
          setPushState('subscribed');
          const visitorId = getStorefrontVisitorId();
          const lastSync = Number(localStorage.getItem(PUSH_SYNC_STORAGE_KEY) || 0);
          if (visitorId && Date.now() - lastSync > 86400000) {
            fetch('/api/push/subscribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ visitor_id: visitorId, subscription: subscription.toJSON() }),
            }).then((response) => {
              if (response.ok) localStorage.setItem(PUSH_SYNC_STORAGE_KEY, String(Date.now()));
            }).catch(() => {});
          }
        } else {
          setPushState(Notification.permission === 'denied' ? 'denied' : 'available');
        }
      } catch {
        if (!cancelled) setPushState('error');
      }
    };
    preparePush();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (isOpen && !rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const postReceipt = useCallback(async (notificationId, action) => {
    const visitorId = visitorIdRef.current;
    if (!visitorId) return;
    fetch(`/api/notifications/${encodeURIComponent(notificationId)}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor_id: visitorId }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  const markUnreadAsRead = useCallback(() => {
    const unread = notifications.filter((notification) => !notification.is_read);
    if (unread.length === 0) return;
    unread.forEach((notification) => postReceipt(notification.id, 'read'));
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
  }, [notifications, postReceipt]);

  const togglePanel = () => {
    setIsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) markUnreadAsRead();
      return nextOpen;
    });
  };

  const dismissNotification = (notificationId) => {
    postReceipt(notificationId, 'dismiss');
    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
    setAnnouncement('Notification dismissed.');
  };

  const activateNotification = (notification) => {
    postReceipt(notification.id, 'read');
    let destination = notification.cta_url || (notification.coupon_code ? '/checkout' : '/');
    if (notification.coupon_code) {
      try {
        localStorage.setItem(PENDING_COUPON_STORAGE_KEY, notification.coupon_code);
      } catch {
        // Coupon remains visible in the notification if storage is unavailable.
      }
      destination = addCouponToCheckoutPath(destination, notification.coupon_code);
    }
    setIsOpen(false);
    navigateTo(destination);
  };

  const enableBrowserPush = async () => {
    if (!vapidPublicKeyRef.current || pushState === 'enabling') return;
    setPushState('enabling');
    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState(permission === 'denied' ? 'denied' : 'available');
        return;
      }
      const registration = pushRegistrationRef.current || await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(vapidPublicKeyRef.current),
        });
      }
      const visitorId = getStorefrontVisitorId();
      if (!visitorId) throw new Error('Anonymous visitor identifier unavailable.');
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitor_id: visitorId, subscription: subscription.toJSON() }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Browser alerts could not be enabled.');
      pushSubscriptionRef.current = subscription;
      localStorage.setItem(PUSH_SYNC_STORAGE_KEY, String(Date.now()));
      setPushState('subscribed');
      setAnnouncement('Browser alerts enabled.');
    } catch {
      setPushState(Notification.permission === 'denied' ? 'denied' : 'error');
      setAnnouncement('Browser alerts could not be enabled.');
    }
  };

  const disableBrowserPush = async () => {
    if (pushState === 'disabling') return;
    setPushState('disabling');
    try {
      const registration = pushRegistrationRef.current || await navigator.serviceWorker.ready;
      const subscription = pushSubscriptionRef.current || await registration.pushManager.getSubscription();
      const visitorId = getStorefrontVisitorId();
      if (subscription && visitorId) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitor_id: visitorId, endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      pushSubscriptionRef.current = null;
      localStorage.removeItem(PUSH_SYNC_STORAGE_KEY);
      setPushState('available');
      setAnnouncement('Browser alerts disabled.');
    } catch {
      setPushState('error');
      setAnnouncement('Browser alerts could not be disabled.');
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div className="site-notifications" ref={rootRef}>
      <button
        type="button"
        className={`notification-bell-button ${unreadCount ? 'has-unread' : ''}`}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        aria-controls="storefront-notification-panel"
        onClick={togglePanel}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 8.5h18C21 15 18 15 18 8ZM10 20h4" />
        </svg>
        {unreadCount > 0 && <span className="notification-unread-badge">{Math.min(unreadCount, 9)}{unreadCount > 9 ? '+' : ''}</span>}
      </button>

      {isOpen && (
        <section id="storefront-notification-panel" className="notification-panel" aria-label="Site notifications">
          <header className="notification-panel-header">
            <div><span>Updates</span><strong>Notifications</strong></div>
            <small>{notifications.length} available</small>
          </header>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <span aria-hidden="true">✓</span>
                <strong>You’re all caught up</strong>
                <p>New store updates and relevant cart offers will appear here.</p>
              </div>
            ) : notifications.map((notification) => (
              <article className="notification-item" key={notification.id}>
                <span className="notification-avatar" aria-hidden="true"><img src="/logo-mark.svg" alt="" /></span>
                <div className="notification-copy">
                  <div className="notification-title-line"><strong>{notification.title}</strong><time>{timeAgo(notification.created_at)}</time></div>
                  <p>{notification.message}</p>
                  {notification.coupon_code && <span className="notification-coupon">Code: <b>{notification.coupon_code}</b></span>}
                  {(notification.cta_label || notification.coupon_code) && (
                    <button type="button" className="notification-cta" onClick={() => activateNotification(notification)}>
                      {notification.cta_label || 'Use coupon'} <span aria-hidden="true">→</span>
                    </button>
                  )}
                </div>
                <button type="button" className="notification-dismiss" aria-label={`Dismiss ${notification.title}`} onClick={() => dismissNotification(notification.id)}>×</button>
              </article>
            ))}
          </div>
          <footer className="notification-panel-footer">
            <div className="push-control-copy">
              <strong>Browser alerts</strong>
              {pushState === 'subscribed' && <span><i /> On — alerts can arrive when this site is closed.</span>}
              {pushState === 'available' && <span>Optional alerts for important updates and relevant cart offers. No email required.</span>}
              {pushState === 'denied' && <span>Blocked in browser settings. Change the site notification permission to enable.</span>}
              {pushState === 'unsupported' && <span>Not available here. On iPhone or iPad, add this site to the Home Screen first.</span>}
              {pushState === 'privacy' && <span>Unavailable while Global Privacy Control or Do Not Track is enabled.</span>}
              {pushState === 'unconfigured' && <span>Browser alerts are temporarily unavailable.</span>}
              {pushState === 'error' && <span>Could not update browser alerts. You can retry.</span>}
              {['checking', 'enabling', 'disabling'].includes(pushState) && <span>Checking browser notification status…</span>}
            </div>
            {['available', 'error'].includes(pushState) && <button type="button" className="push-control-button" onClick={enableBrowserPush}>Enable</button>}
            {pushState === 'subscribed' && <button type="button" className="push-control-button is-on" onClick={disableBrowserPush}>Turn off</button>}
          </footer>
        </section>
      )}
      <span className="notification-live-region" aria-live="polite" aria-atomic="true">{announcement}</span>
    </div>
  );
}
