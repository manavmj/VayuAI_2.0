import React from 'react';
import { Wind } from 'lucide-react';
import type { WorkspaceStep } from '../types/vayu.ts';

interface VayuWordmarkProps {
  variant: WorkspaceStep;
}

export const VayuWordmark: React.FC<VayuWordmarkProps> = ({ variant }) => {
  if (variant === 'landing' || variant === 'ingest') {
    return (
      <div className="inline-flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-[0.75rem_0.25rem_0.75rem_0.25rem] bg-[#dcfce7] text-[#00652c] border border-[#16a34a]/20">
          <Wind className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <span className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.03em] text-[#131b2e]">
            Vayu <span className="text-[#15803d]">AI</span>
          </span>
        </div>
      </div>
    );
  }

  if (variant === 'hygiene') {
    return (
      <div className="inline-flex items-baseline gap-2.5">
        <span className="font-display text-2xl font-bold tracking-[0.06em] uppercase text-[#00652c]">
          VAYU
        </span>
        <span aria-hidden="true" className="text-[#16a34a] font-mono text-lg">
          ·
        </span>
        <span className="font-mono text-base font-semibold tracking-wider text-[#131b2e]">
          AI
        </span>
      </div>
    );
  }

  if (variant === 'briefs') {
    return (
      <div className="inline-flex flex-wrap items-baseline gap-2.5">
        <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#131b2e]">
          Vayu AI
        </span>
        <span aria-hidden="true" className="text-slate-300 font-light">
          /
        </span>
        <span className="font-display text-xl sm:text-2xl font-semibold text-[#15803d]">
          वायु AI
        </span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span className="font-display text-2xl font-semibold tracking-tight text-[#131b2e]">
        Vayu
      </span>
      <span aria-hidden="true" className="font-mono text-sm font-semibold text-[#15803d]">
        ⇄
      </span>
      <span className="font-display text-2xl font-bold tracking-tight text-[#00652c]">
        AI
      </span>
    </div>
  );
};
