import { Transfer } from '@/lib/api';
import TransferCard from './TransferCard';

interface TransfersViewProps {
  transfers: Transfer[];
  onNewTransfer: () => void;
}

export default function TransfersView({ transfers, onNewTransfer }: TransfersViewProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Transfer History</h2>
          <p className="text-sm text-gray-600 mt-1">
            {transfers.length} total transfer{transfers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onNewTransfer}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
        >
          New Transfer
        </button>
      </div>

      {transfers.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No transfers</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new transfer.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {transfers.map((transfer) => (
            <TransferCard key={transfer.id} transfer={transfer} />
          ))}
        </div>
      )}
    </div>
  );
}