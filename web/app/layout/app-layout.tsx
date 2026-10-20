import { classNames } from 'primereact/utils'
import { type ReactNode, useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import type { MenuSection } from '../lib/menu'
import { AppMenu } from './app-menu'
import { AppTopbar } from './app-topbar'

type Props = {
  menu: MenuSection[]
  userLabel: string
  homePath: string
  children: ReactNode
}

// Matches Sakai's desktop/mobile breakpoint in styles/layout/_responsive.scss.
const DESKTOP_QUERY = '(min-width: 992px)'
const SIDEBAR_ID = 'layout-sidebar'

// Ported from Sakai's layout.tsx + LayoutContext, fixed to Sakai's default "static" menu mode
// (sidebar always shown on desktop, collapsible; off-canvas on mobile). Sakai's overlay mode,
// theme-switcher panel (AppConfig) and footer aren't ported. The state below is all that's
// left, so it lives here instead of in a shared context.
export function AppLayout({ menu, userLabel, homePath, children }: Props) {
  const [desktopMenuHidden, setDesktopMenuHidden] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // Assumes desktop for the server render and first client render (no `window` during SSR),
  // then follows the real viewport. Only affects aria-expanded and which flag a toggle flips —
  // the visible layout itself is driven by CSS media queries.
  const [isDesktop, setIsDesktop] = useState(true)
  const location = useLocation()

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const update = () => setIsDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const onMenuToggle = () => {
    if (isDesktop) setDesktopMenuHidden((hidden) => !hidden)
    else setMobileMenuOpen((open) => !open)
  }

  useEffect(() => setMobileMenuOpen(false), [location.pathname])

  // While the mobile menu is open, the page behind it shouldn't scroll, and Escape closes it.
  useEffect(() => {
    if (!mobileMenuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    document.body.classList.add('blocked-scroll')
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('blocked-scroll')
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileMenuOpen])

  const wrapperClass = classNames('layout-wrapper', 'layout-static', {
    'layout-static-inactive': desktopMenuHidden,
    'layout-mobile-active': mobileMenuOpen,
  })

  return (
    <div className={wrapperClass}>
      <AppTopbar
        userLabel={userLabel}
        homePath={homePath}
        onMenuToggle={onMenuToggle}
        menuExpanded={isDesktop ? !desktopMenuHidden : mobileMenuOpen}
        sidebarId={SIDEBAR_ID}
      />
      <nav id={SIDEBAR_ID} className="layout-sidebar" aria-label="Main">
        <AppMenu model={menu} />
      </nav>
      <div className="layout-main-container">
        <main className="layout-main">{children}</main>
      </div>
      {/* Only visible on mobile while the menu is open (see _responsive.scss); a click on it is
          the "click outside the menu" that closes it — Sakai uses a document listener instead. */}
      <div className="layout-mask" onClick={() => setMobileMenuOpen(false)} />
    </div>
  )
}
