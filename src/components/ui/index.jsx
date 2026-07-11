import { buttonClass } from "./styles.js";

export function Button({ variant = "secondary", loading = false, className = "", disabled, children, ...props }) {
  return <button type="button" className={`${buttonClass(variant)} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>{loading ? "Working…" : children}</button>;
}

export function IconButton({ label, className = "", children, ...props }) {
  return <button type="button" className={`ts-icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

export function Card({ variant = "standard", className = "", children }) {
  return <section className={`ts-card ts-card--${variant} ${className}`}>{children}</section>;
}

export function SectionHeader({ title, description, meta, actions }) {
  return <div className="ts-section-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><div className="ts-section-header__actions">{meta}{actions}</div></div>;
}

export function Input({ invalid = false, className = "", ...props }) {
  return <input className={`ts-control ${invalid ? "ts-control--invalid" : ""} ${className}`} aria-invalid={invalid || undefined} {...props} />;
}

export function Select({ invalid = false, className = "", children, ...props }) {
  return <select className={`ts-control ${invalid ? "ts-control--invalid" : ""} ${className}`} aria-invalid={invalid || undefined} {...props}>{children}</select>;
}

export function Textarea({ invalid = false, className = "", ...props }) {
  return <textarea className={`ts-control ${invalid ? "ts-control--invalid" : ""} ${className}`} aria-invalid={invalid || undefined} {...props} />;
}

export function Badge({ variant = "default", children }) {
  return <span className={`ts-badge ts-badge--${variant}`}>{children}</span>;
}

export function SegmentedControl({ children, label }) {
  return <div className="ts-segmented" role="group" aria-label={label}>{children}</div>;
}

export function ModalShell({ title, description, onClose, children, footer, maxWidth = "42rem" }) {
  return <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="ts-modal-title"><button type="button" className="modal-backdrop border-0 bg-transparent" onClick={onClose} aria-label="Close modal" /><div className="modal-positioner"><div className="ts-modal modal-panel" style={{ maxWidth }}><header className="ts-modal__header"><div><h2 id="ts-modal-title">{title}</h2>{description && <p>{description}</p>}</div><IconButton label="Close" onClick={onClose}>×</IconButton></header><div className="ts-modal__body">{children}</div>{footer && <footer className="ts-modal__footer">{footer}</footer>}</div></div></div>;
}

export function EmptyState({ title, description, action }) {
  return <div className="ts-empty-state"><div className="ts-empty-state__icon" aria-hidden="true">•</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function StatCard({ label, value, detail }) {
  return <div className="ts-stat"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}

export function AlertBanner({ variant = "info", title, children, actions, className = "" }) {
  return <div className={`ts-alert ts-alert--${variant} ${className}`} role={variant === "danger" ? "alert" : "status"}><div><strong>{title}</strong><div>{children}</div></div>{actions && <div className="ts-alert__actions">{actions}</div>}</div>;
}

export function Divider() { return <div className="ts-divider" role="separator" />; }
