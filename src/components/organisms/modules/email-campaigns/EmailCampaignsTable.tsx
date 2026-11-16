'use client';

import { useEffect, useState } from 'react';
import { useDebounce } from 'use-debounce';

import { PageHeaderWithAction } from '@/components/molecules/common/PageHeaderWithAction';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { DataTable } from '@/components/ui/data-table';
import { CampaignStatus } from '@/lib/prisma/generated/browser';
import { CampaignWithRelations } from '@/types/campaign';
import { Pagination } from '../../../molecules/common/Pagination';
import { UnifiedSearchBar } from '../../../molecules/common/UnifiedSearchBar';

import { emailCampaignsTableColumns } from './emailCampaignsTableColumns';

type StatusFilterValue = 'ALL' | CampaignStatus | 'DRAFT';
const STATUS_OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: 'ALL', label: 'All Status' },
  { value: 'SENT', label: 'Sent' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'PARTIALLYSUCCESS', label: 'Partial Success' },
  { value: 'DRAFT', label: 'Draft' },
];

interface EmailCampaignsTableProps {
  onEdit: (_campaign: CampaignWithRelations) => void;
  onDelete: (_campaignId: number, _campaignName: string) => void;
  onView: (_campaignId: number) => void;
  onAdd: () => void;
  onPageChange?: (_page: number) => void;
  campaigns: CampaignWithRelations[];
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
}

export function EmailCampaignsTable({
  onEdit,
  onDelete,
  onView,
  onAdd,
  onPageChange,
  campaigns,
  isLoading = false,
  error: _error = null,
  className,
}: EmailCampaignsTableProps) {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebounce(searchInput, 400);
  const [filterStatus, setFilterStatus] = useState<StatusFilterValue>('ALL');

  // Filter campaigns based on search and status
  const filteredCampaigns = (campaigns || []).filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(debouncedSearch.toLowerCase());

    const matchesStatus = filterStatus === 'ALL' || campaign.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Pagination
  const total = filteredCampaigns.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedCampaigns = filteredCampaigns.slice(startIndex, endIndex);

  // Handle smart pagination after deletion
  if (paginatedCampaigns.length === 0 && page > 1 && !isLoading && totalPages >= 1) {
    setPage(prev => Math.max(1, prev - 1));
  }


  // Notify parent of page changes
  useEffect(() => {
    if (onPageChange) {
      onPageChange(page);
    }
  }, [page, onPageChange]);

  return (
    <div className={`min-h-screen overflow-x-hidden ${className || ''}`}>
      <PageHeaderWithAction
        title="Email Campaigns"
        description="Manage your email marketing campaigns"
        onAdd={onAdd}
        addButtonText="New Campaign"
        actions={
          <div className="flex items-center gap-2">
            <Combobox
              items={STATUS_OPTIONS}
              value={
                STATUS_OPTIONS.find((o) => o.value === filterStatus) ?? STATUS_OPTIONS[0]
              }
              onValueChange={(item) => setFilterStatus(item?.value ?? 'ALL')}
              itemToStringValue={(item) => item.label}
            >
              <ComboboxInput placeholder="All Status" className="w-40 min-w-0" />
              <ComboboxContent>
                <ComboboxEmpty>No items found.</ComboboxEmpty>
                <ComboboxList>
                  {(item) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        }
      />
      <div className="h-full space-y-4 p-4 max-sm:p-3">
        {/* Mobile controls: Status + New Campaign (only on small screens) */}
        <div className="mb-4 flex flex-col gap-3 sm:hidden">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Status:
              </label>
              <Combobox
                items={STATUS_OPTIONS}
                value={
                  STATUS_OPTIONS.find((o) => o.value === filterStatus) ?? STATUS_OPTIONS[0]
                }
                onValueChange={(item) => setFilterStatus(item?.value ?? 'ALL')}
                itemToStringValue={(item) => item.label}
              >
                <ComboboxInput placeholder="All Status" className="w-40 min-w-0" />
                <ComboboxContent>
                  <ComboboxEmpty>No items found.</ComboboxEmpty>
                  <ComboboxList>
                    {(item) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            <Button onClick={onAdd} className="w-auto shrink-0 justify-center px-4 py-2">
              + New Campaign
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="">
          <UnifiedSearchBar
            placeholder="Search by name..."
            value={searchInput}
            onChange={setSearchInput}
            className="flex-1"
          />
        </div>

        {/* Desktop Table */}
        <div className="relative overflow-hidden overflow-x-auto rounded-md bg-background">
          <DataTable<CampaignWithRelations, unknown>
            columns={emailCampaignsTableColumns}
            data={paginatedCampaigns}
            meta={{ onView, onEdit, onDelete }}
            emptyMessage="No email campaigns found."
            isLoading={isLoading || searchInput !== debouncedSearch}
            loadingMessage={
              searchInput !== debouncedSearch ? 'Searching...' : 'Loading email campaigns...'
            }
          />
        </div>

        {/* Pagination */}
        {paginatedCampaigns.length > 0 && (
          <Pagination
            pagination={{
              page,
              limit,
              totalCount: total,
              totalPages,
            }}
            onPageChange={setPage}
          />
        )}
      </div>
    </div>
  );
}
