import { useState } from "react";
import { Banner, Button, Field, postJson } from "../ui";

export function passwordStrength(password: string) {
  if (password.length === 0) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((kind) =>
    kind.test(password),
  ).length;
  if (password.length >= 12 && kinds >= 3) return 3;
  if (password.length >= 8 && kinds >= 2) return 2;
  return 1;
}

const strengthLabel = ["", "Too weak", "Okay", "Strong"];

export function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string>();
  const strength = passwordStrength(password);

  if (sentTo !== undefined)
    return (
      <div className="card center" key="verify">
        <div className="big-check" aria-hidden>
          ✉
        </div>
        <h1>Verify your email</h1>
        <p className="lede">
          We sent a link to {sentTo}. Open it to finish creating your account.
        </p>
        <Button block>Resend email</Button>
      </div>
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(undefined);
    setEmailError(undefined);
    setPending(true);
    const { status } = await postJson("/api/signup", { name, email, password });
    setPending(false);
    if (status === 201) setSentTo(email);
    else if (status === 409)
      setEmailError(
        "An account with this email already exists. Log in instead?",
      );
    else setServerError("Something went wrong on our side. Try again.");
  };

  return (
    <form className="card" key="signup" onSubmit={submit} noValidate>
      <h1>Create your account</h1>
      <p className="lede">Free for teams up to 5 people.</p>
      <div className="stack">
        {serverError !== undefined && (
          <Banner tone="danger">{serverError}</Banner>
        )}
        <Field
          label="Full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          label="Work email"
          type="email"
          value={email}
          error={emailError}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Field
          label="Password"
          type="text"
          className="masked"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <div className="stack" style={{ gap: 6 }}>
          <div className="meter" data-strength={strength} aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <span className="hint" aria-live="polite">
            {strength === 0
              ? "Use 12 or more characters with a mix of letters, numbers, and symbols."
              : strengthLabel[strength]}
          </span>
        </div>
        <Button
          primary
          block
          type="submit"
          pending={pending}
          disabled={strength < 2}
        >
          Create account
        </Button>
      </div>
    </form>
  );
}
