import { useEffect, useState } from "react";

interface T { id: number; text: string; color?: string }
let push: ((t: T) => void) | null = null;
let nextId = 1;

export function toast(text: string, color?: string) {
  push?.({ id: nextId++, text, color });
}

export function Toasts() {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    push = (t) => {
      setList((l) => [...l.slice(-3), t]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), 2200);
    };
    return () => { push = null; };
  }, []);
  return (
    <div className="toasts">
      {list.map((t) => (
        <div key={t.id} className="toast" style={t.color ? { borderColor: t.color, color: t.color } : undefined}>{t.text}</div>
      ))}
    </div>
  );
}
