"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { formatNumber, extractDigits } from "@/lib/format";

interface PriceInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function PriceInput({
  value,
  onChange,
  placeholder = "0",
  className,
}: PriceInputProps) {
  const [displayValue, setDisplayValue] = useState(() => formatNumber(value));

  // Sincronizar cuando el valor externo cambia
  useEffect(() => {
    setDisplayValue(formatNumber(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Extraer solo digitos
    const digits = extractDigits(inputValue);

    // Formatear para mostrar
    const formatted = formatNumber(digits);
    setDisplayValue(formatted);

    // Pasar el valor sin formato al padre
    onChange(digits);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
}
