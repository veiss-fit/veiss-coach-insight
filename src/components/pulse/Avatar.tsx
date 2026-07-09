interface AvatarProps {
  name: string;
  size?: "sm" | "lg" | "xl";
  color?: string;
}

export function Avatar({ name, size = "sm", color }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const cls = "v-avatar" + (size === "lg" ? " lg" : size === "xl" ? " xl" : "");
  return (
    <span className={cls} style={color ? { background: color + "22", color } : undefined}>
      {initials}
    </span>
  );
}
