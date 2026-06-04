import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth-context";
import { Button, Card, Input } from "../../../components/ui/basic";
export const LoginPage = () => {
  const { user, login } = useAuth();
  const location = useLocation();
  const from = typeof location.state?.from === "string" ? location.state.from : "/";
  const [email, setEmail] = useState("admin@supermarket.test");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  if (user) return <Navigate to={from} replace />;
  const submit = async (e: FormEvent) => { e.preventDefault(); try { setError(""); await login(email, password); } catch (err) { setError((err as Error).message); } };
  return <div className="grid min-h-screen place-items-center bg-[var(--color-page)] p-4"><Card><form className="w-[320px] space-y-3" onSubmit={submit}><h1 className="font-semibold text-[#15371f]">Login</h1><Input value={email} onChange={(e) => setEmail(e.target.value)} /><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />{error && <p className="text-sm text-[#9c4326]">{error}</p>}<Button type="submit">Sign in</Button></form></Card></div>;
};
