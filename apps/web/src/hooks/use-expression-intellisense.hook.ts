import { useState, useCallback, useMemo } from "react";
import { FUNCTION_METADATA, FunctionMetadata } from "@repo/engine";

export interface SuggestionItem {
  id: string;
  kind: "variable" | "function" | "keyword";
  name: string;
  display: string;
  detail?: string;
  description?: string;
  snippet?: string;
}

const KEYWORD_SUGGESTIONS: SuggestionItem[] = [
  {
    id: "kw_true",
    kind: "keyword",
    name: "true",
    display: "true",
    detail: "Boolean true",
  },
  {
    id: "kw_false",
    kind: "keyword",
    name: "false",
    display: "false",
    detail: "Boolean false",
  },
  {
    id: "kw_null",
    kind: "keyword",
    name: "null",
    display: "null",
    detail: "Null value",
  },
  {
    id: "kw_in",
    kind: "keyword",
    name: "in",
    display: "in",
    detail: "Member search operator",
  },
  {
    id: "kw_contains",
    kind: "keyword",
    name: "contains",
    display: "contains",
    detail: "Inclusion operator",
  },
];

export interface UseIntellisenseOptions {
  availableVariables?: string[];
  mode?: "condition" | "expression" | "mutation";
}

export function useExpressionIntellisense({
  availableVariables = [],
  mode = "expression",
}: UseIntellisenseOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterText, setFilterText] = useState("");
  const [wordRange, setWordRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const allSuggestions = useMemo(() => {
    const list: SuggestionItem[] = [];

    // Variables (Inputs / Preceding Cell Outputs)
    availableVariables.forEach((v) => {
      list.push({
        id: `var_${v}`,
        kind: "variable",
        name: v,
        display: v,
        detail: "Variable / Input",
      });
    });

    // Built-in TEL Functions
    FUNCTION_METADATA.forEach((fn: FunctionMetadata) => {
      list.push({
        id: `fn_${fn.name}`,
        kind: "function",
        name: fn.name,
        display: `${fn.name}()`,
        detail: fn.signature,
        description: fn.description,
        snippet: fn.name + "(",
      });
    });

    // Keywords (only if in expression or condition mode)
    if (mode !== "mutation") {
      list.push(...KEYWORD_SUGGESTIONS);
    }

    return list;
  }, [availableVariables, mode]);

  const filteredSuggestions = useMemo(() => {
    if (!filterText.trim()) return allSuggestions.slice(0, 12);
    const query = filterText.toLowerCase();
    return allSuggestions
      .filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query)),
      )
      .slice(0, 15);
  }, [allSuggestions, filterText]);

  const updateSearchFromInput = useCallback(
    (text: string, cursorPos: number) => {
      // Find word boundaries around cursor
      let start = cursorPos;
      while (start > 0 && /[A-Za-z0-9_$]/.test(text[start - 1] ?? "")) {
        start--;
      }
      let end = cursorPos;
      while (end < text.length && /[A-Za-z0-9_$]/.test(text[end] ?? "")) {
        end++;
      }

      const word = text.slice(start, cursorPos);
      setWordRange({ start, end });
      setFilterText(word);

      if (word.length >= 1) {
        setIsOpen(true);
        setSelectedIndex(0);
      } else {
        setIsOpen(false);
      }
    },
    [],
  );

  const applySuggestion = useCallback(
    (
      item: SuggestionItem,
      text: string,
    ): { newText: string; newCursor: number } => {
      const insertion = item.kind === "function" ? `${item.name}(` : item.name;
      const before = text.slice(0, wordRange.start);
      const after = text.slice(wordRange.end);
      const newText = before + insertion + after;
      const newCursor = wordRange.start + insertion.length;
      setIsOpen(false);
      return { newText, newCursor };
    },
    [wordRange],
  );

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLElement>,
      currentText: string,
      onApply: (newText: string, cursor: number) => void,
    ) => {
      if (!isOpen || filteredSuggestions.length === 0) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredSuggestions.length);
        return true;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) =>
            (prev - 1 + filteredSuggestions.length) %
            filteredSuggestions.length,
        );
        return true;
      }

      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = filteredSuggestions[selectedIndex];
        if (selected) {
          const res = applySuggestion(selected, currentText);
          onApply(res.newText, res.newCursor);
        }
        return true;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        return true;
      }

      return false;
    },
    [isOpen, filteredSuggestions, selectedIndex, applySuggestion],
  );

  return {
    isOpen,
    setIsOpen,
    selectedIndex,
    setSelectedIndex,
    suggestions: filteredSuggestions,
    updateSearchFromInput,
    applySuggestion,
    handleKeyDown,
  };
}
