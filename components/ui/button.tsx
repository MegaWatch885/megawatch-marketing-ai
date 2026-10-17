import {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {

  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus:outline-none focus:ring-2 focus:ring-black/20 disabled:cursor-not-allowed disabled:opacity-50";

  const variants = {
    primary:
      "bg-black text-white hover:bg-gray-800",

    secondary:
      "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",

    danger:
      "bg-red-600 text-white hover:bg-red-700",

    ghost:
      "text-gray-700 hover:bg-gray-100",
  };

  const sizes = {
    sm:
      "px-3 py-2 text-sm",

    md:
      "px-4 py-2.5 text-sm",

    lg:
      "px-5 py-3 text-base",
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}

      {loading ? "Loading..." : children}
    </button>
  );
}