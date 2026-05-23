import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "../hooks/useTheme";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
});

describe("useTheme", () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.classList.remove("light");
  });

  it("démarre en mode sombre par défaut (sans préférence système)", () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });

  it("toggle passe de dark à light", () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggle(); });
    expect(result.current.theme).toBe("light");
  });

  it("toggle remet en dark après deux appels", () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggle(); });
    act(() => { result.current.toggle(); });
    expect(result.current.theme).toBe("dark");
  });

  it("ajoute la classe 'light' sur <html> en mode clair", () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggle(); });
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("retire la classe 'light' sur <html> en mode sombre", () => {
    document.documentElement.classList.add("light");
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggle(); }); // → light (part de dark)
    act(() => { result.current.toggle(); }); // → dark
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("persiste le thème dans localStorage", () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggle(); });
    expect(localStorageMock.setItem).toHaveBeenCalledWith("comptaos_theme", "light");
  });

  it("lit le thème sauvegardé depuis localStorage", () => {
    localStorageMock.getItem.mockReturnValueOnce("light");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
  });
});
