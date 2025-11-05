import type { ReactNode } from "react";

import "./IconButton.scss";

interface IconButtonProps {
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

const IconButton = ({
  onClick,
  className,
  disabled = false,
  icon
}: IconButtonProps) => {
  return (
    <button
      className={`icon-button ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
    >
      {icon}
    </button>
  )
}

export default IconButton;
