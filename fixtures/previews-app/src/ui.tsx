import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
} from "react";

export function Button({
  primary,
  pending,
  block,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  primary?: boolean;
  pending?: boolean;
  block?: boolean;
}) {
  const classes = ["button", primary && "primary", block && "block"];
  return (
    <button
      type="button"
      {...rest}
      className={classes.filter(Boolean).join(" ")}
      disabled={rest.disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({
  label,
  error,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : `${id}-error`}
        {...input}
      />
      {error !== undefined && (
        <span id={`${id}-error`} className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "danger" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`banner ${tone}`}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { status: response.status, data };
}
