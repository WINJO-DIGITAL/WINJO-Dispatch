'use client'

import { useSyncExternalStore } from 'react'

// Whether the phone has a connection, kept live from the browser's online and offline events.
// Server render and anything that cannot tell count as online.
function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine !== false, () => true)
}
