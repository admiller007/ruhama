import { useLayoutEffect, useRef } from 'react'
import { onChange } from '@theatre/core'
import { introSheet } from '../lib/theatre'

export function useIntroAnimation() {
  const headerRef = useRef<HTMLElement>(null)
  const searchBarRef = useRef<HTMLDivElement>(null)
  const filterChipsRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const headerObj = introSheet.object('Header', { opacity: 0, y: -25 })
    const searchObj = introSheet.object('Search Bar', { opacity: 0, y: 20 })
    const filterObj = introSheet.object('Filter Chips', { opacity: 0, y: 15 })

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
    ]

    void introSheet.sequence.play({ iterationCount: 1 })

    return () => {
      unsubs.forEach((fn) => fn())
    }
  }, [])

  return { headerRef, searchBarRef, filterChipsRef }
}
