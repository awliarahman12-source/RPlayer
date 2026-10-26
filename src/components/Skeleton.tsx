export function SkeletonCard() {
  return (
    <div className="glass rounded-2xl p-3 flex flex-col gap-2">
      <div className="w-full aspect-square rounded-xl skeleton" />
      <div className="h-4 skeleton rounded w-3/4 mt-1" />
      <div className="h-3 skeleton rounded w-1/2" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <div className="w-11 h-11 skeleton rounded-md" />
      <div className="flex-1 space-y-1">
        <div className="h-4 skeleton rounded w-1/2" />
        <div className="h-3 skeleton rounded w-1/4" />
      </div>
    </div>
  );
}