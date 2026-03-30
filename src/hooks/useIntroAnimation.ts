import { useLayoutEffect, useRef } from 'react'
import { onChange } from '@theatre/core'
import { introSheet } from '../lib/theatre'

export function useIntroAnimation() {
  const headerRef = useRef<HTMLElement>(null)
  const searchBarRef = useRef<HTMLDivElement>(null)
  const filterChipsRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (process.env.NODE_ENV === 'test') return

    const headerObj = introSheet.object('Header', { opacity: 0, y: -18 })
    const searchObj = introSheet.object('Search Bar', { opacity: 0, y: 12 })
    const filterObj = introSheet.object('Filter Chips', { opacity: 0, y: 10 })
    const resultsObj = introSheet.object('Results', { opacity: 0 })

    const unsubs = [
      onChange(headerObj.props, ({ opacity, y }) => {
        if (headerRef.current) {
          headerRef.current.style.opacity = String(opacity)
          headerRef.current.style.transform = `translateY(${y}px)`
        }
      }),
      onChange(searchObj.props, ({ opacity, y }) => {
        if (searchBarRef.current) {
          searchBarRef.current.style.opacity = String(opacity)
          searchBarRef.current.style.transform = `translateY(${y}px)`
        }
      }),
      onChange(filterObj.props, ({ opacity, y }) => {
        if (filterChipsRef.current) {
          filterChipsRef.current.style.opacity = String(opacity)
          filterChipsRef.current.style.transform = `translateY(${y}px)`
        }
      }),
      onChange(resultsObj.props, ({ opacity }) => {
        if (resultsRef.current) {
          resultsRef.current.style.opacity = String(opacity)
        }
      }),
    ]

    void introSheet.sequence.play({ iterationCount: 1 })

    return () => {
      unsubs.forEach((fn) => fn())
    }
  }, [])

  return { headerRef, searchBarRef, filterChipsRef, resultsRef }
}
