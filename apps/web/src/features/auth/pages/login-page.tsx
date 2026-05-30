import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import { Button, Card, Input } from "../../../components/ui/basic";
export const LoginPage = () => {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("admin@supermarket.test");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  if (user) return <Navigate to="/" replace />;
  const submit = async (e: FormEvent) => { e.preventDefault(); try { setError(""); await login(email, password); } catch (err) { setError((err as Error).message); } };
  return <div className="min-h-screen grid place-items-center p-4"><Card><form className="w-[320px] space-y-3" onSubmit={submit}><h1 className="font-semibold">Login</h1><Input value={email} onChange={(e) => setEmail(e.target.value)} /><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />{error && <p className="text-sm text-red-600">{error}</p>}<Button type="submit">Sign in</Button></form></Card></div>;
};
