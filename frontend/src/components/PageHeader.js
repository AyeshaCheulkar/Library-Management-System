export default function PageHeader({ eyebrow, title, lead, children }) {
  return (
    <header className="page-head">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1 className="page__title">{title}</h1>
      {lead ? <p className="page__lead">{lead}</p> : null}
      {children}
    </header>
  );
}
