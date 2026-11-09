/**
 * ScribeX Service Worker for Web Push & Offline Reminders
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const payload = event.notification.data || {};
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (payload.targetType === 'note' && payload.noteId) {
            client.navigate(`/note/${payload.noteId}`);
          } else if (payload.targetId) {
            client.navigate(`/home?tab=tasks&taskId=${payload.targetId}`);
          } else {
            client.navigate('/home?tab=tasks');
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        const destination = payload.targetType === 'note' && payload.noteId 
          ? `/note/${payload.noteId}` 
          : (payload.targetId ? `/home?tab=tasks&taskId=${payload.targetId}` : '/home?tab=tasks');
        return self.clients.openWindow(destination);
      }
    })
  );
});

