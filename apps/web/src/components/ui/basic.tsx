import { PropsWithChildren } from "react";
export const Card = ({ children }: PropsWithChildren) => <div className="surface-card rounded-md border p-4">{children}</div>;
export const Button = ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} className={`btn-gold h-11 rounded border px-4 text-sm font-medium disabled:opacity-40 ${props.className ?? ""}`}>{children}</button>;
export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`field-warm h-11 w-full rounded border px-3 text-sm outline-none focus:ring-2 focus:ring-[#bb9645]/25 ${props.className ?? ""}`} />;
