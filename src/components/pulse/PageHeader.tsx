interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 16, padding: "0 0 16px" }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="v-label" style={{ marginBottom: 4 }}>{eyebrow}</div>}
        <h1 className="v-h1">{title}</h1>
        {subtitle && <div className="v-meta" style={{ marginTop: 4, fontSize: 13 }}>{subtitle}</div>}
      </div>
      {actions && <div className="row" style={{ gap: 6, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
