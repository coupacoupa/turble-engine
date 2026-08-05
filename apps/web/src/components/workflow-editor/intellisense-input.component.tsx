import React, { useRef, useState, useCallback, useEffect } from "react";
import { useExpressionIntellisense } from "@/hooks/use-expression-intellisense.hook";
import { IntellisensePopup } from "./intellisense-popup.component";

export interface IntellisenseInputProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  className?: string;
  availableVariables?: string[];
  mode?: "condition" | "expression" | "mutation";
  multiline?: boolean;
}

export function IntellisenseInput({
  value,
  onChange,
  placeholder,
  className = "",
  availableVariables = [],
  mode = "expression",
  multiline = false,
}: IntellisenseInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
  }>({
    top: 0,
    left: 0,
    width: 280,
  });

  const {
    isOpen,
    setIsOpen,
    selectedIndex,
    suggestions,
    updateSearchFromInput,
    applySuggestion,
    handleKeyDown,
  } = useExpressionIntellisense({ availableVariables, mode });

  const updateCoords = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(280, rect.width),
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
      return () => {
        window.removeEventListener("scroll", updateCoords, true);
        window.removeEventListener("resize", updateCoords);
      };
    }
  }, [isOpen, updateCoords]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const val = e.target.value;
    onChange(val);
    const cursor = e.target.selectionStart ?? val.length;
    updateSearchFromInput(val, cursor);
    updateCoords();
  };

  const handleSelect = (item: any) => {
    const res = applySuggestion(item, value);
    onChange(res.newText);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(res.newCursor, res.newCursor);
      }
    }, 10);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const handled = handleKeyDown(e, value, (newText, newCursor) => {
      onChange(newText);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursor, newCursor);
        }
      }, 10);
    });
    if (handled) return;
  };

  return (
    <div className="w-full">
      {multiline ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onFocus={updateCoords}
          onBlur={() => setIsOpen(false)}
          placeholder={placeholder}
          className={className}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          onFocus={updateCoords}
          onBlur={() => setIsOpen(false)}
          placeholder={placeholder}
          className={className}
        />
      )}

      <IntellisensePopup
        isOpen={isOpen}
        suggestions={suggestions}
        selectedIndex={selectedIndex}
        onSelect={handleSelect}
        coords={coords}
      />
    </div>
  );
}
