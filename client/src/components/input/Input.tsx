import type { ChangeEvent } from "react";

import "./Input.scss";

interface InputProps {
  id: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}

const Input = ({
  id,
  value,
  onChange,
  placeholder,
  maxLength = 50,
  className,
}: InputProps) => {
  return (
    <input
      type="text"
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`input ${className}`}
    />
  )
}

export default Input;
