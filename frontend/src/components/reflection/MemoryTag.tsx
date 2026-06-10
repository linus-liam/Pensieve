interface MemoryTagProps {
  label: string;
}

export function MemoryTag({ label }: MemoryTagProps) {
  return <span className="memory-tag">{label}</span>;
}
