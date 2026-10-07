import { classNames } from 'primereact/utils'
import { Link } from 'react-router'

type Props = {
  to: string
  label?: string
  icon?: string
  text?: boolean
  rounded?: boolean
  severity?: 'secondary' | 'success' | 'info' | 'warning' | 'danger' | 'help'
  'aria-label'?: string
}

// A router link styled as a PrimeReact Button. Wrapping <Button> in <Link> instead nests a
// <button> inside an <a> — invalid HTML, and two tab stops for one action. PrimeReact 10's
// Button can't render as a link itself, so this reuses the class names it would generate
// (see primereact/button's `classes` map) on a real <Link>.
export function LinkButton({ to, label, icon, text, rounded, severity, 'aria-label': ariaLabel }: Props) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={classNames('p-button p-component', {
        'p-button-icon-only': icon && !label,
        'p-button-text': text,
        'p-button-rounded': rounded,
        [`p-button-${severity}`]: severity,
      })}
    >
      {icon && <span className={classNames('p-button-icon p-c', icon, { 'p-button-icon-left': label })} />}
      {label && <span className="p-button-label p-c">{label}</span>}
    </Link>
  )
}
