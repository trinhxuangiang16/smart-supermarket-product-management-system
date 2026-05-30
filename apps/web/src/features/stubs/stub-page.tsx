import { Card } from "../../components/ui/basic";
export const StubPage = ({ title, todo }: { title: string; todo: string }) => <div className="space-y-4"><h1 className="text-xl font-semibold">{title}</h1><Card><p className="text-sm text-slate-600">{todo}</p></Card></div>;
