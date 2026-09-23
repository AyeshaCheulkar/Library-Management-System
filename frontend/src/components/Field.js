export default function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  hint,
  children,
  ...rest
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>

      {children ? (
        children
      ) : (
        <input
          id={id}
          className={`input${error ? " input--invalid" : ""}`}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy || undefined}
          {...rest}
        />
      )}

      {hint ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
