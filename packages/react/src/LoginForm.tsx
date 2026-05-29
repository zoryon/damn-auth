import { FormEvent, useState } from "react";
import { useAuth } from "./useAuth.js";

export interface LoginFormProps {
  providers?: string[];
  showCredentials?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  classNames?: Partial<Record<"root" | "input" | "button" | "providerButton" | "error", string>>;
}

export function LoginForm({ providers = [], showCredentials = true, onSuccess, onError, classNames = {} }: LoginFormProps) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      // The headless form only manages state; apps decide what to do after success.
      await auth.signIn(undefined, { email, password });
      onSuccess?.();
    } catch (cause) {
      // Normalize unknown throw values before showing or forwarding the error.
      const next = cause instanceof Error ? cause : new Error("Sign in failed.");
      setError(next.message);
      onError?.(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={classNames.root} onSubmit={submit}>
      {providers.map((provider) => (
        <button className={classNames.providerButton} key={provider} type="button" onClick={() => void auth.signIn(provider)}>
          {provider}
        </button>
      ))}
      {showCredentials && (
        <>
          <input className={classNames.input} autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} required />
          <input className={classNames.input} autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} required />
          <button className={classNames.button} type="submit" disabled={pending}>
            {pending ? "Signing in..." : "Sign in"}
          </button>
        </>
      )}
      {error && <p className={classNames.error}>{error}</p>}
    </form>
  );
}
