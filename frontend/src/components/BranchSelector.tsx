import type { ChangeEvent } from 'react';
import useAuth from '../hooks/useAuth';
import { useBranches } from '../hooks/useBranches';
import type { Branch } from '../types';

interface BranchSelectorProps {
  value?: string | null;
  onChange: (branchId: string | null) => void;
  includeAllOption?: boolean;
  label?: string;
}

export const BranchSelector = ({ value, onChange, includeAllOption = false, label = 'Filial' }: BranchSelectorProps) => {
  const { user } = useAuth();
  const { data: branches, isLoading } = useBranches();

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newValue = event.target.value || null;
    onChange(newValue);
  };

  const availableBranches = branches ?? [];
  const isBranchLocked = user?.role === 'branch_manager' || user?.role === 'user';

  const selectedValue = isBranchLocked ? user?.branch?.id ?? null : value ?? null;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
      <select
        value={selectedValue ?? ''}
        onChange={handleChange}
        disabled={isLoading || isBranchLocked}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-slate-100"
      >
        {includeAllOption ? <option value="">Hamısı</option> : null}
        {availableBranches.map((branch: Branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default BranchSelector;

