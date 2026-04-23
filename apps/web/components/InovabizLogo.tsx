interface InovabizLogoProps {
  className?: string;
  variant?: "white" | "dark";
}

export function InovabizLogo({ className, variant = "dark" }: InovabizLogoProps) {
  const color = variant === "white" ? "#ffffff" : "#1F3864";
  const accentColor = variant === "white" ? "#8BA4C4" : "#2E5FA3";

  return (
    <svg
      viewBox="0 0 140 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Inovabiz"
    >
      {/* "i" dot */}
      <circle cx="3.5" cy="3.5" r="2.5" fill={accentColor} />
      {/* Main wordmark */}
      <text
        x="0"
        y="24"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="18"
        letterSpacing="-0.5"
        fill={color}
      >
        inovabiz
      </text>
    </svg>
  );
}
