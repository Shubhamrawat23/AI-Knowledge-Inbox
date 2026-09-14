import React from "react";

export default function TopBar() {
  return (
    <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-sm font-bold text-black">
          AI
        </div>
        <h1 className="text-sm font-semibold text-white sm:text-base">
          Knowledge Inbox
        </h1>
      </div>
    </header>
  );
}