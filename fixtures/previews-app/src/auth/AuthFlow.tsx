import { useState } from "react";
import { Banner, Button, Field, postJson } from "../ui";

type Screen =
  | { name: "login" }
  | { name: "two-factor"; email: string }
  | { name: "forgot" }
  | { name: "reset-sent"; email: string }
  | { name: "signed-in"; user: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The app's sign-in: log in, a 2-factor code when the account needs one, and password reset. */
export function AuthFlow() {
  const [screen, setScreen] = useState<Screen>({ name: "login" });
  if (screen.name === "two-factor")
    return (
      <TwoFactor
        email={screen.email}
        onVerified={(user) => setScreen({ name: "signed-in", user })}
      />
    );
  if (screen.name === "forgot")
    return (
      <Forgot
        onBack={() => setScreen({ name: "login" })}
        onSent={(email) => setScreen({ name: "reset-sent", email })}
      />
    );
  if (screen.name === "reset-sent")
    return (
      <div className="card center" key="reset-sent">
        <div className="big-check" aria-hidden>
          ✓
        </div>
        <h1>Check your email</h1>
        <p className="lede">
          We sent a reset link to {screen.email}. It expires in an hour.
        </p>
        <Button block onClick={() => setScreen({ name: "login" })}>
          Back to log in
        </Button>
      </div>
    );
  if (screen.name === "signed-in")
    return (
      <div className="card center" key="signed-in">
        <div className="big-check" aria-hidden>
          ✓
        </div>
        <h1>Welcome back, {screen.user}</h1>
        <p className="lede">Taking you to your dashboard…</p>
      </div>
    );
  return (
    <LogIn
      onTwoFactor={(email) => setScreen({ name: "two-factor", email })}
      onSignedIn={(user) => setScreen({ name: "signed-in", user })}
      onForgot={() => setScreen({ name: "forgot" })}
    />
  );
}

function LogIn(props: {
  onTwoFactor: (email: string) => void;
  onSignedIn: (user: string) => void;
  onForgot: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [serverError, setServerError] = useState<string>();
  const [pending, setPending] = useState(false);

  const checkEmail = () =>
    setEmailError(
      email === "" || emailPattern.test(email)
        ? undefined
        : "Enter an email like name@company.com",
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!emailPattern.test(email)) {
      setEmailError("Enter an email like name@company.com");
      return;
    }
    setServerError(undefined);
    setPending(true);
    const { status, data } = await postJson("/api/login", { email, password });
    setPending(false);
    if (status === 200) props.onSignedIn(String(data.name));
    else if (status === 202) props.onTwoFactor(email);
    else if (status === 429)
      setServerError("Too many attempts. Try again in 5 minutes.");
    else setServerError("That email and password don't match.");
  };

  return (
    <form className="card" key="login" onSubmit={submit} noValidate>
      <h1>Log in to Acme</h1>
      <p className="lede">Welcome back. Use your work email.</p>
      <div className="stack">
        {serverError !== undefined && (
          <Banner tone="danger">{serverError}</Banner>
        )}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          error={emailError}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={checkEmail}
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
        <Button primary block type="submit" pending={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
        <button type="button" className="link" onClick={props.onForgot}>
          Forgot password?
        </button>
      </div>
    </form>
  );
}

function TwoFactor(props: {
  email: string;
  onVerified: (user: string) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    const { status, data } = await postJson("/api/login/verify", {
      email: props.email,
      code,
    });
    setPending(false);
    if (status === 200) props.onVerified(String(data.name));
    else setError("That code didn't work. Check your authenticator app.");
  };
  return (
    <form className="card" key="two-factor" onSubmit={submit}>
      <h1>Enter your code</h1>
      <p className="lede">
        Open your authenticator app and enter the 6-digit code for {props.email}
        .
      </p>
      <div className="stack">
        <Field
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          error={error}
          onChange={(event) => setCode(event.target.value)}
        />
        <Button primary block type="submit" pending={pending}>
          Verify
        </Button>
      </div>
    </form>
  );
}

function Forgot(props: {
  onBack: () => void;
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    await postJson("/api/password-reset", { email });
    setPending(false);
    props.onSent(email);
  };
  return (
    <form className="card" key="forgot" onSubmit={submit}>
      <h1>Reset your password</h1>
      <p className="lede">We'll email you a link to choose a new one.</p>
      <div className="stack">
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button primary block type="submit" pending={pending}>
          Send reset link
        </Button>
        <button type="button" className="link" onClick={props.onBack}>
          Back to log in
        </button>
      </div>
    </form>
  );
}
