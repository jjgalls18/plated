export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-cream dark:bg-stone-900 flex flex-col items-center justify-center">
      <div className="mb-6">
        <span className="font-display text-5xl font-bold text-primary">Plated</span>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary opacity-60 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}
