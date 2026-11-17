'use client'

import { useState, useSyncExternalStore } from 'react'
import { pushState, type PushState } from '@/lib/push'

const noSubscribe = () => () => {}

/**
 * This phone's notification state. It is read from the browser (null while rendering on the server),
 * and the second value lets a screen update it after the driver turns notifications on.
 */
export function usePushState(): [PushState | null, (next: PushState) => void] {
  const detected = useSyncExternalStore<PushState | null>(noSubscribe, pushState, () => null)
  const [changed, setChanged] = useState<PushState | null>(null)
  return [changed ?? detected, setChanged]
}
