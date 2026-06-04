import { Card } from "../../components/ui/basic";
export const StubPage = ({ title, todo }: { title: string; todo: string }) => <div className="space-y-4"><h1 className="text-xl font-semibold text-[#15371f]">{title}</h1><Card><p className="text-sm text-[#6d5935]">{todo}</p></Card></div>;
