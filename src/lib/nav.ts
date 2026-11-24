"use client";
// Tracks in-app history so "back" never leaves the app on a deep link (e.g. a scanned /q link).
const stack: string[] = [];

export function recordPath(path: string) {
  if (stack[stack.length - 1] === path) return;
  if (stack[stack.length - 2] === path) stack.pop();
  else stack.push(path);
}

export function canGoBack(): boolean {
  return stack.length > 1;
}
