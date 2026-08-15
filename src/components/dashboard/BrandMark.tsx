type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 28, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="#2563eb" />
      <path
        d="M10 16c0-3.6 2.7-6.2 6.3-6.2 2.4 0 4.3 1 5.4 2.6l-2.7 1.6c-.6-.9-1.6-1.4-2.7-1.4-2 0-3.4 1.5-3.4 3.4s1.4 3.4 3.4 3.4c1.1 0 2.1-.5 2.7-1.4l2.7 1.6c-1.1 1.6-3 2.6-5.4 2.6C12.7 22.2 10 19.6 10 16Z"
        fill="white"
      />
      <circle cx="23.2" cy="10.4" r="1.6" fill="#93c5fd" />
    </svg>
  );
}
