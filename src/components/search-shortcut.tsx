"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const SEARCH_INPUT_SELECTOR = "[data-primary-search-input='true']";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function focusPrimarySearchInput() {
  const input = document.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR);
  if (!input) {
    return false;
  }

  input.focus();
  input.select();
  return true;
}

export function SearchShortcut() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/") {
      window.requestAnimationFrame(() => {
        const shouldFocusSearch =
          window.sessionStorage.getItem("focus-primary-search") === "true";
        if (!shouldFocusSearch) {
          return;
        }

        window.sessionStorage.removeItem("focus-primary-search");
        focusPrimarySearchInput();
      });
    }
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key !== "/" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      if (focusPrimarySearchInput()) {
        return;
      }

      window.sessionStorage.setItem("focus-primary-search", "true");
      router.push("/");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
