import { Suspense } from "react";
import { Chat } from "@/components/chat/Chat";
import { ScreenSkeleton } from "@/components/ui/Screen";

export default function ChatPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <Chat />
    </Suspense>
  );
}
