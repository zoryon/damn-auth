import { FormEvent, useState } from "react";

export interface RegisterFormProps {
  signupUrl?: string;
  onSuccess?: (user: unknown) => void;
  onError?: (error: Error) => void;
  classNames?: Partial<Record<"root" | "input" | "button" | "error", string>>;
}

export function RegisterForm({ signupUrl = "/auth/signup", onSuccess, onError, classNames = {} }: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      // Registration is kept separate from sign-in so apps can choose the next step.
      const response = await fetch(signupUrl, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      if (!response.ok) throw new Error("Registration failed.");
      const payload = await response.json();
      onSuccess?.(payload.user);
    } catch (cause) {
      // Normalize unknown throw values before showing or forwarding the error.
      const next = cause instanceof Error ? cause : new Error("Registration failed.");
      setError(next.message);
      onError?.(next);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={classNames.root} onSubmit={submit}>
      <input className={classNames.input} autoComplete="name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
      <input className={classNames.input} autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} required />
      <input className={classNames.input} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} required />
      <button className={classNames.button} type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create account"}
      </button>
      {error && <p className={classNames.error}>{error}</p>}
    </form>
  );
}
