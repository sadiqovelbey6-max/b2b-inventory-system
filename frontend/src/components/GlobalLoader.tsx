import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export const GlobalLoader = () => {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const active = isFetching + isMutating > 0;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[9998] h-1 transition-all duration-300 ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="h-full w-full animate-pulse bg-primary-500" />
    </div>
  );
};

export default GlobalLoader;

