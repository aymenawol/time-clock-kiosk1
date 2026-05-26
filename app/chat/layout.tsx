export default function ChatLayout({ children }: { children: React.ReactNode }) {
  // Chat has its own full-height layout — no inner padding wrapper needed
  return <div className="bg-gray-950 text-white">{children}</div>
}
