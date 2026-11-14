/** The original folded-map artwork, retained through the Productdoc rename. */
export function Logo(props: { size?: number }) {
  const size = props.size ?? 20;
  return (
    <svg
      width={size}
      height={size}
      viewBox="4 -8 108 108"
      strokeWidth={5}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 22 41 10v58L8 80z" fill="#b5e3cc" stroke="#5fae8a" />
      <path d="M41 10l34 12v58L41 68z" fill="#fbf7ef" stroke="#d9cdb4" />
      <path d="M75 22l33-12v58L75 80z" fill="#f7a99c" stroke="#e2725f" />
    </svg>
  );
}
