import { PropsWithChildren } from "react";
export const Card = ({ children }: PropsWithChildren) => <div className="rounded-md border bg-white p-4">{children}</div>;
export const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} className={`h-11 px-4 rounded bg-slate-900 text-white text-sm disabled:opacity-40 ${props.className ?? ""}`}>{children}</button>;
export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`h-11 w-full rounded border px-3 text-sm ${props.className ?? ""}`} />;
