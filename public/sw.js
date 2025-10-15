self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch {}
  const title = data.title || 'MealLog'
  const body = data.body || '通知があります'
  const url = data.url || '/'
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { url },
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of all) {
      if (client.url === url && 'focus' in client) return client.focus()
    }
    if (clients.openWindow) return clients.openWindow(url)
  })())
})
